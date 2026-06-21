"""
Chat API — multi-tenant edition.
Validates API keys against the database and restricts ChromaDB
queries to the chatbot's organization's documents only.
"""

import os
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import List, Optional
from google import genai
from pinecone import Pinecone
from sqlalchemy.orm import Session

from ..models import Chatbot, Subscription, hash_api_key
from .deps import get_db

router = APIRouter()

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

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
gemini_client = None
if GEMINI_API_KEY:
    gemini_client = genai.Client(api_key=GEMINI_API_KEY)


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


@router.post("/", response_model=ChatResponse)
async def chat_with_bot(
    request: ChatRequest,
    db: Session = Depends(get_db)
):
    """
    Chat endpoint.
    Resolves chatbot config from the database using api_key or chatbot_id.
    Scopes ChromaDB retrieval to the chatbot's organization.
    Tracks query usage against subscription limits.
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

        # 1. Embed user query
        embed_result = gemini_client.models.embed_content(
            model="gemini-embedding-2",
            contents=user_query
        )
        query_embedding = embed_result.embeddings[0].values

        # 2. Search Vector DB for context — scoped to organization
        context_texts = []
        try:
            if pinecone_index:
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
                
                context_texts = [match['metadata']['text'] for match in results.get('matches', []) if 'text' in match.get('metadata', {})]
        except Exception as query_err:
            print(f"Pinecone query error: {query_err}")

        context_str = "\n".join(context_texts)

        # 3. Call LLM (Gemini) with context + guardrails + user message
        escalation_rule = ""
        if request.enable_escalation:
            escalation_rule = """
CRITICAL ESCALATION RULE: If the user's question cannot be answered completely and accurately using the provided context, or if it represents a "New Problem Profile", you MUST immediately halt automation and output EXACTLY the following token: [ESCALATE]
Do not guess or invent answers.
"""

        prompt = f"""
System Guardrails: {request.system_prompt}
{escalation_rule}

STRICT DATA GUARDRAIL: You are an AI assistant bound to a specific knowledge base. You MUST ONLY answer the user's question using the information provided in the 'Context extracted from media' below. If the answer is not present in the context, you must reply: "I cannot answer this based on my current knowledge base." Do NOT use external knowledge. Do NOT hallucinate.

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
    except Exception as e:
        print(f"Error in chat endpoint: {e}")
        return ChatResponse(
            response=f"Error processing chat: {e}",
            context_used=[]
        )
