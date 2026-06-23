"""
Chat API — multi-tenant edition with graceful fallback.
When Gemini/Pinecone are available: full RAG pipeline.
When unavailable: falls back to SQL-based context search + built-in response engine.
"""

import os
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import List, Optional
from sqlalchemy.orm import Session

from ..models import Chatbot, Subscription, Document, hash_api_key
from .deps import get_db
from ..config import GEMINI_API_KEY, PINECONE_API_KEY, PINECONE_INDEX_NAME

router = APIRouter()

# ---------------------------------------------------------------------------
# External service initialization (graceful)
# ---------------------------------------------------------------------------

gemini_client = None
if GEMINI_API_KEY:
    try:
        from google import genai
        gemini_client = genai.Client(api_key=GEMINI_API_KEY)
        print("[OK] Chat: Gemini AI client initialized.")
    except Exception as e:
        print(f"[WARN] Chat: Gemini client init failed: {e}")

pinecone_index = None
if PINECONE_API_KEY:
    try:
        from pinecone import Pinecone
        pc = Pinecone(api_key=PINECONE_API_KEY)
        pinecone_index = pc.Index(PINECONE_INDEX_NAME)
        print(f"[OK] Chat: Pinecone index '{PINECONE_INDEX_NAME}' connected.")
    except Exception as e:
        print(f"[WARN] Chat: Pinecone connection failed: {e}")
else:
    print("[INFO] Chat: No PINECONE_API_KEY -- using SQL-based context search.")


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    chatbot_id: Optional[str] = "default"
    api_key: Optional[str] = None
    temperature: Optional[float] = 0.7
    system_prompt: Optional[str] = "You are a helpful assistant."
    enable_escalation: Optional[bool] = False


class ChatResponse(BaseModel):
    response: str
    context_used: List[str] = []
    requires_human: bool = False


# ---------------------------------------------------------------------------
# Fallback: SQL-based context search
# ---------------------------------------------------------------------------

def search_context_sql(
    db: Session,
    query: str,
    organization_id: Optional[str] = None,
    file_id: Optional[str] = None,
    limit: int = 3,
) -> List[str]:
    """Search for relevant context in the documents table using SQL LIKE."""
    q = db.query(Document).filter(
        Document.status == "completed",
        Document.transcription.isnot(None),
    )
    if organization_id:
        q = q.filter(Document.organization_id == organization_id)
    if file_id and file_id != "default":
        q = q.filter(Document.file_id == file_id)

    docs = q.all()
    if not docs:
        return []

    # Simple keyword matching: score documents by how many query words they contain
    query_words = [w.lower() for w in query.split() if len(w) > 2]
    scored = []
    for doc in docs:
        text = (doc.transcription or "").lower()
        score = sum(1 for word in query_words if word in text)
        if score > 0:
            # Extract a relevant snippet (first 500 chars around the match)
            snippet = doc.transcription[:500] if doc.transcription else ""
            scored.append((score, snippet))

    scored.sort(key=lambda x: x[0], reverse=True)
    return [s[1] for s in scored[:limit]]


# ---------------------------------------------------------------------------
# Fallback: Built-in response engine (no Gemini needed)
# ---------------------------------------------------------------------------

def generate_fallback_response(
    user_query: str,
    context_texts: List[str],
    system_prompt: str,
    enable_escalation: bool,
) -> tuple[str, bool]:
    """
    Generate a response without Gemini.
    Uses context from DB if available, otherwise gives a helpful response.
    """
    requires_human = False

    if context_texts:
        # We have context — create a response referencing it
        combined_context = "\n".join(context_texts)

        # Check if query words appear in context
        query_words = [w.lower() for w in user_query.split() if len(w) > 2]
        relevant_sentences = []
        for ctx in context_texts:
            sentences = ctx.replace(".", ".\n").split("\n")
            for sentence in sentences:
                sentence = sentence.strip()
                if not sentence:
                    continue
                if any(word in sentence.lower() for word in query_words):
                    relevant_sentences.append(sentence)

        if relevant_sentences:
            response = "Based on the knowledge base, here's what I found:\n\n"
            for i, sent in enumerate(relevant_sentences[:5], 1):
                response += f"• {sent}\n"
            response += "\n_This response was generated from your uploaded documents._"
        else:
            response = (
                "I found some related documents in the knowledge base, but I couldn't locate "
                "a specific answer to your question. Here's a summary of what's available:\n\n"
                f"_{combined_context[:300]}..._\n\n"
                "Try rephrasing your question or asking about specific topics covered in your uploads."
            )
    else:
        # No context at all
        if enable_escalation:
            requires_human = True
            return (
                "I don't have any relevant context to answer this question. "
                "Escalating to a human operator for assistance.",
                True,
            )

        response = (
            "👋 I'm your AuraOS AI Assistant! I'm currently running in **local mode** "
            "(without external AI services).\n\n"
            "Here's what I can do:\n"
            "• **Answer questions** based on uploaded documents in the knowledge base\n"
            "• **Search** through transcriptions and uploaded media\n"
            "• **Escalate** complex queries to human operators\n\n"
            "To get started, upload some media files through the **Media Processing** section, "
            "then I'll be able to answer questions about that content!\n\n"
            "_To enable full AI responses, configure your `GEMINI_API_KEY` in the backend `.env` file._"
        )

    return response, requires_human


# ---------------------------------------------------------------------------
# Main endpoint
# ---------------------------------------------------------------------------

@router.post("/", response_model=ChatResponse)
async def chat_with_bot(
    request: ChatRequest,
    db: Session = Depends(get_db)
):
    """
    Chat endpoint with graceful degradation.
    - Full mode: Gemini + Pinecone (RAG)
    - Fallback mode: SQL context search + built-in response engine
    """

    organization_id = None

    # Resolve chatbot from database
    if request.api_key:
        key_hash = hash_api_key(request.api_key)
        bot = db.query(Chatbot).filter(Chatbot.api_key_hash == key_hash).first()
        if bot:
            request.chatbot_id = bot.file_id
            request.system_prompt = bot.system_prompt
            request.temperature = bot.temperature
            request.enable_escalation = bot.enable_escalation
            organization_id = bot.organization_id
    elif request.chatbot_id and request.chatbot_id != "default":
        bot = db.query(Chatbot).filter(Chatbot.bot_id == request.chatbot_id).first()
        if bot:
            request.chatbot_id = bot.file_id
            request.system_prompt = bot.system_prompt
            request.temperature = bot.temperature
            request.enable_escalation = bot.enable_escalation
            organization_id = bot.organization_id

    # Track usage against subscription
    if organization_id:
        sub = db.query(Subscription).filter(
            Subscription.organization_id == organization_id
        ).first()
        if sub:
            if sub.queries_used >= sub.max_queries_per_month:
                return ChatResponse(
                    response="Query limit reached for this billing period. Please upgrade your plan or wait for the next cycle.",
                    context_used=[],
                    requires_human=False,
                )
            sub.queries_used += 1
            db.commit()

    try:
        user_query = request.messages[-1].content

        # -------------------------------------------------------------------
        # FULL MODE: Gemini + Pinecone available
        # -------------------------------------------------------------------
        if gemini_client:
            try:
                # 1. Embed user query
                embed_result = gemini_client.models.embed_content(
                    model="gemini-embedding-2",
                    contents=user_query
                )
                query_embedding = embed_result.embeddings[0].values

                # 2. Search Vector DB for context — scoped to organization
                context_texts = []
                if pinecone_index:
                    try:
                        filter_clause = None
                        if organization_id and request.chatbot_id and request.chatbot_id != "default":
                            filter_clause = {
                                "file_id": request.chatbot_id,
                                "organization_id": organization_id,
                            }
                        elif organization_id:
                            filter_clause = {"organization_id": organization_id}
                        elif request.chatbot_id and request.chatbot_id != "default":
                            filter_clause = {"file_id": request.chatbot_id}

                        results = pinecone_index.query(
                            vector=query_embedding,
                            top_k=3,
                            include_metadata=True,
                            filter=filter_clause
                        )

                        context_texts = [
                            match['metadata']['text']
                            for match in results.get('matches', [])
                            if 'text' in match.get('metadata', {})
                        ]
                    except Exception as query_err:
                        print(f"Pinecone query error (falling back to SQL): {query_err}")
                        context_texts = search_context_sql(
                            db, user_query, organization_id, request.chatbot_id
                        )
                else:
                    # No Pinecone — use SQL fallback for context
                    context_texts = search_context_sql(
                        db, user_query, organization_id, request.chatbot_id
                    )

                context_str = "\n".join(context_texts) if context_texts else "[No context available]"

                # 3. Call LLM (Gemini) with context
                escalation_rule = ""
                if request.enable_escalation:
                    escalation_rule = """
CRITICAL ESCALATION RULE: If the user's question represents a complex support issue or a complaint that cannot be answered using the provided context, you MUST halt automation and output EXACTLY the token: [ESCALATE]
"""

                prompt = f"""
System Guardrails: {request.system_prompt}

You are a helpful AI assistant. If context is provided below, prioritize answering the user's question using that context.
If the user's message is a greeting or general conversational query (e.g., "hello", "hi", "who are you?", "tell me a joke"), respond politely, naturally, and helpfully.
If the user's message asks for specific information, facts, or instructions that are missing from the context, respond with: "I cannot answer this based on my current knowledge base."
{escalation_rule}

Context extracted from media:
{context_str}

User Question: {user_query}
"""

                response = gemini_client.models.generate_content(
                    model='gemini-2.5-flash',
                    contents=prompt,
                    config={"temperature": request.temperature}
                )

                reply_text = response.text
                requires_human = False

                if "[ESCALATE]" in reply_text:
                    requires_human = True
                    reply_text = "Unrecognized issue detected. Halting automation. Connecting you to a live human operator..."

                return ChatResponse(
                    response=reply_text,
                    context_used=context_texts,
                    requires_human=requires_human
                )

            except Exception as gemini_err:
                print(f"Gemini API error, falling back to built-in engine: {gemini_err}")
                # Fall through to fallback mode below

        # -------------------------------------------------------------------
        # FALLBACK MODE: No Gemini or Gemini failed
        # -------------------------------------------------------------------
        context_texts = search_context_sql(
            db, user_query, organization_id, request.chatbot_id
        )
        reply_text, requires_human = generate_fallback_response(
            user_query, context_texts, request.system_prompt, request.enable_escalation
        )

        return ChatResponse(
            response=reply_text,
            context_used=context_texts,
            requires_human=requires_human,
        )

    except Exception as e:
        print(f"Error in chat endpoint: {e}")
        return ChatResponse(
            response="I encountered an error processing your message. Please try again in a moment.",
            context_used=[]
        )
