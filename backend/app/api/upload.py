"""
Media upload & transcription API — multi-tenant edition.
Stores document metadata in SQL and tags ChromaDB embeddings with org_id.
"""

import os
import uuid
import glob
import json
import subprocess
import requests
from datetime import datetime, timezone

from fastapi import APIRouter, File, UploadFile, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from dotenv import load_dotenv
from google import genai
from pinecone import Pinecone
from sqlalchemy.orm import Session

from ..models import Document, Subscription, User, generate_uuid
from .deps import get_db, get_current_user, get_optional_user

load_dotenv()

router = APIRouter()
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

SARVAM_API_KEY = os.getenv("SARVAM_API_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
gemini_client = None
if GEMINI_API_KEY:
    gemini_client = genai.Client(api_key=GEMINI_API_KEY)

PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
PINECONE_INDEX_NAME = os.getenv("PINECONE_INDEX_NAME", "auraos")

if PINECONE_API_KEY:
    try:
        pc = Pinecone(api_key=PINECONE_API_KEY)
        pinecone_index = pc.Index(PINECONE_INDEX_NAME)
    except Exception as e:
        print(f"WARNING: Could not connect to Pinecone index '{PINECONE_INDEX_NAME}': {e}")
        print("Please ensure you have created a Pinecone index with 768 dimensions (for gemini-embedding-2) and cosine metric.")
        pinecone_index = None
else:
    pinecone_index = None


class UploadResponse(BaseModel):
    file_id: str
    filename: str
    message: str


def chunk_text(text, chunk_size=500):
    words = text.split()
    chunks = []
    current_chunk = []
    current_len = 0
    for word in words:
        if current_len + len(word) > chunk_size:
            chunks.append(" ".join(current_chunk))
            current_chunk = [word]
            current_len = len(word)
        else:
            current_chunk.append(word)
            current_len += len(word) + 1
    if current_chunk:
        chunks.append(" ".join(current_chunk))
    return chunks


import imageio_ffmpeg


def process_audio(file_path: str, file_id: str, original_filename: str, organization_id: str):
    """Process audio in the background: transcribe, chunk, embed, and store in DB."""
    from ..database import SessionLocal

    db = SessionLocal()
    print(f"Starting processing for {file_id} (org: {organization_id})")

    try:
        ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()

        print(f"[{file_id}] Slicing media into 30s chunks using ffmpeg...")

        chunk_pattern = f"{file_path}_chunk_%03d.mp3"
        subprocess.run([
            ffmpeg_exe, "-y", "-i", file_path,
            "-f", "segment", "-segment_time", "30",
            "-c:a", "libmp3lame", "-q:a", "0", "-map", "a",
            chunk_pattern
        ], check=True)

        full_transcription = ""
        url = "https://api.sarvam.ai/speech-to-text"
        headers = {"api-subscription-key": SARVAM_API_KEY}

        chunk_files = sorted(glob.glob(f"{file_path}_chunk_*.mp3"))

        for idx, chunk_path in enumerate(chunk_files):
            print(f"[{file_id}] Transcribing chunk {idx+1}/{len(chunk_files)}...")
            files = {"file": ("audio.mp3", open(chunk_path, "rb"), "audio/mpeg")}
            data = {"model": "saaras:v3", "mode": "transcribe"}

            response = requests.post(url, headers=headers, files=files, data=data)

            if response.status_code == 200:
                transcript = response.json().get("transcript", "")
                full_transcription += transcript + " "
            else:
                raise Exception(f"Sarvam API Error on chunk: {response.text}")

        transcription = full_transcription.strip()
        print(f"Full Transcription successful for {file_id}: {transcription[:100]}...")

        # Also save JSON for legacy compatibility
        with open(f"uploads/{file_id}.json", "w") as f:
            json.dump({
                "transcription": transcription,
                "filename": original_filename,
                "file_id": file_id
            }, f)

        # Update document record in SQL
        doc = db.query(Document).filter(Document.file_id == file_id).first()
        if doc:
            doc.transcription = transcription
            doc.status = "completed"
            db.commit()

        # Chunk and Embed with Gemini — tag with organization_id for multi-tenant isolation
        text_chunks = chunk_text(transcription)
        vectors_to_upsert = []
        for i, chunk in enumerate(text_chunks):
            if not chunk.strip():
                continue
            embed_result = gemini_client.models.embed_content(
                model="gemini-embedding-2",
                contents=chunk
            )
            embedding = embed_result.embeddings[0].values

            vectors_to_upsert.append({
                "id": f"{file_id}_chunk_{i}",
                "values": embedding,
                "metadata": {
                    "text": chunk,
                    "file_id": file_id,
                    "organization_id": organization_id,
                }
            })
            
        if vectors_to_upsert and pinecone_index:
            pinecone_index.upsert(vectors=vectors_to_upsert)
            
        print(f"[{file_id}] Successfully embedded into Pinecone with org isolation.")

    except Exception as e:
        print(f"[{file_id}] Processing error: {e}")
        # Update document status to error
        doc = db.query(Document).filter(Document.file_id == file_id).first()
        if doc:
            doc.status = "error"
            doc.error_message = str(e)
            db.commit()

        with open(f"uploads/{file_id}.json", "w") as f:
            json.dump({"error": f"Processing Error: {str(e)}"}, f)
    finally:
        db.close()


@router.post("/", response_model=UploadResponse)
async def upload_audio(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Upload media for transcription. Requires authentication."""
    # Check subscription limits
    sub = db.query(Subscription).filter(
        Subscription.organization_id == user.organization_id
    ).first()

    doc_count = db.query(Document).filter(
        Document.organization_id == user.organization_id
    ).count()

    if sub and doc_count >= sub.max_documents:
        raise HTTPException(
            status_code=403,
            detail=f"Document limit reached ({sub.max_documents}). Upgrade your plan."
        )

    file_id = str(uuid.uuid4())
    file_path = os.path.join(UPLOAD_DIR, f"{file_id}_{file.filename}")

    with open(file_path, "wb") as buffer:
        buffer.write(await file.read())

    # Create document record in SQL
    doc = Document(
        id=generate_uuid(),
        file_id=file_id,
        filename=file.filename,
        status="processing",
        organization_id=user.organization_id,
    )
    db.add(doc)
    db.commit()

    background_tasks.add_task(
        process_audio, file_path, file_id, file.filename, user.organization_id
    )

    return UploadResponse(
        file_id=file_id,
        filename=file.filename,
        message="File uploaded successfully and is being processed in the background."
    )


@router.get("/{file_id}/transcription")
def get_transcription(
    file_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get transcription status/result — scoped to user's org."""
    doc = db.query(Document).filter(
        Document.file_id == file_id,
        Document.organization_id == user.organization_id,
    ).first()

    if doc:
        if doc.status == "error":
            return {"error": doc.error_message}
        if doc.status == "completed" and doc.transcription:
            return {
                "transcription": doc.transcription,
                "filename": doc.filename,
                "file_id": doc.file_id,
            }
        return {"transcription": None, "status": doc.status}

    # Fallback to legacy JSON file
    file_path = f"uploads/{file_id}.json"
    if os.path.exists(file_path):
        with open(file_path, "r") as f:
            return json.load(f)
    return {"transcription": None}


@router.get("/files")
def list_files(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all uploaded documents for the user's organization."""
    docs = db.query(Document).filter(
        Document.organization_id == user.organization_id,
        Document.status == "completed",
    ).order_by(Document.created_at.desc()).all()

    files_data = []
    for doc in docs:
        files_data.append({
            "file_id": doc.file_id,
            "filename": doc.filename,
            "snippet": (doc.transcription[:100] + "...") if doc.transcription else "",
            "status": doc.status,
            "created_at": doc.created_at.isoformat() if doc.created_at else None,
        })

    # Also include legacy JSON files for backward compat
    if not files_data:
        for filepath in glob.glob("uploads/*.json"):
            try:
                with open(filepath, "r") as f:
                    data = json.load(f)
                    if "transcription" in data and data["transcription"]:
                        files_data.append({
                            "file_id": data.get("file_id", os.path.basename(filepath).replace(".json", "")),
                            "filename": data.get("filename", "Unknown File"),
                            "snippet": data["transcription"][:100] + "...",
                        })
            except Exception:
                pass

    return {"files": files_data}
