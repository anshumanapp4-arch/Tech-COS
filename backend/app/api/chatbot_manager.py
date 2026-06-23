"""
Chatbot (AI Agent) CRUD — fully backed by SQLAlchemy.
All operations are scoped to the authenticated user's Organization,
enforcing strict multi-tenant data isolation.
"""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import List, Optional
from sqlalchemy.orm import Session

from ..models import (
    Chatbot, Subscription, User,
    generate_uuid, generate_api_key, hash_api_key
)
from .deps import get_db, get_current_user

router = APIRouter()


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class ChatbotCreate(BaseModel):
    name: str
    description: Optional[str] = ""
    department: Optional[str] = ""
    tags: Optional[str] = ""
    file_id: str
    system_prompt: Optional[str] = "You are a helpful assistant."
    temperature: Optional[float] = 0.7
    enable_escalation: Optional[bool] = False
    whatsapp_enabled: Optional[bool] = False
    whatsapp_token: Optional[str] = ""
    whatsapp_phone_number_id: Optional[str] = ""
    telegram_enabled: Optional[bool] = False
    telegram_token: Optional[str] = ""


class ChatbotResponse(BaseModel):
    bot_id: str
    name: str
    description: str
    department: str
    tags: str
    file_id: str
    system_prompt: str
    temperature: float
    enable_escalation: bool
    api_key: Optional[str] = None  # Only returned on create
    api_key_prefix: str
    status: str
    created_at: str
    organization_id: str
    whatsapp_enabled: bool
    whatsapp_token: Optional[str] = None
    whatsapp_phone_number_id: Optional[str] = None
    telegram_enabled: bool
    telegram_token: Optional[str] = None

    class Config:
        from_attributes = True


class ChatbotListResponse(BaseModel):
    bot_id: str
    name: str
    description: str
    department: str
    tags: str
    file_id: str
    status: str
    api_key_prefix: str
    created_at: str
    whatsapp_enabled: bool
    telegram_enabled: bool

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/", response_model=ChatbotResponse, status_code=status.HTTP_201_CREATED)
def create_chatbot(
    body: ChatbotCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new AI chatbot scoped to the user's organization."""

    # Check subscription limits
    sub = db.query(Subscription).filter(
        Subscription.organization_id == user.organization_id
    ).first()

    current_count = db.query(Chatbot).filter(
        Chatbot.organization_id == user.organization_id
    ).count()

    if sub and current_count >= sub.max_chatbots:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Chatbot limit reached ({sub.max_chatbots}). Upgrade your plan to create more."
        )

    # Generate secure API key
    raw_api_key = generate_api_key()
    bot_id = f"bot_{uuid.uuid4().hex[:8]}"

    chatbot = Chatbot(
        id=generate_uuid(),
        bot_id=bot_id,
        name=body.name,
        description=body.description or "",
        department=body.department or "",
        tags=body.tags or "",
        file_id=body.file_id,
        system_prompt=body.system_prompt or "You are a helpful assistant.",
        temperature=body.temperature or 0.7,
        enable_escalation=body.enable_escalation or False,
        api_key_hash=hash_api_key(raw_api_key),
        api_key_prefix=raw_api_key[:12],
        status="Active",
        organization_id=user.organization_id,
        whatsapp_enabled=body.whatsapp_enabled or False,
        whatsapp_token=body.whatsapp_token or "",
        whatsapp_phone_number_id=body.whatsapp_phone_number_id or "",
        telegram_enabled=body.telegram_enabled or False,
        telegram_token=body.telegram_token or "",
    )

    db.add(chatbot)
    db.commit()
    db.refresh(chatbot)

    return ChatbotResponse(
        bot_id=chatbot.bot_id,
        name=chatbot.name,
        description=chatbot.description,
        department=chatbot.department,
        tags=chatbot.tags,
        file_id=chatbot.file_id,
        system_prompt=chatbot.system_prompt,
        temperature=chatbot.temperature,
        enable_escalation=chatbot.enable_escalation,
        api_key=raw_api_key,  # Only exposed once at creation time
        api_key_prefix=chatbot.api_key_prefix,
        status=chatbot.status,
        created_at=chatbot.created_at.isoformat(),
        organization_id=chatbot.organization_id,
        whatsapp_enabled=chatbot.whatsapp_enabled,
        whatsapp_token=chatbot.whatsapp_token,
        whatsapp_phone_number_id=chatbot.whatsapp_phone_number_id,
        telegram_enabled=chatbot.telegram_enabled,
        telegram_token=chatbot.telegram_token,
    )


@router.get("/", response_model=List[ChatbotListResponse])
def get_chatbots(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all chatbots belonging to the user's organization."""
    bots = db.query(Chatbot).filter(
        Chatbot.organization_id == user.organization_id
    ).order_by(Chatbot.created_at.desc()).all()

    return [
        ChatbotListResponse(
            bot_id=b.bot_id,
            name=b.name,
            description=b.description or "",
            department=b.department or "",
            tags=b.tags or "",
            file_id=b.file_id,
            status=b.status,
            api_key_prefix=b.api_key_prefix,
            created_at=b.created_at.isoformat(),
            whatsapp_enabled=b.whatsapp_enabled,
            telegram_enabled=b.telegram_enabled,
        )
        for b in bots
    ]


@router.get("/{bot_id}", response_model=ChatbotResponse)
def get_chatbot(
    bot_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a single chatbot (scoped to the user's org)."""
    bot = db.query(Chatbot).filter(
        Chatbot.bot_id == bot_id,
        Chatbot.organization_id == user.organization_id,
    ).first()

    if not bot:
        raise HTTPException(status_code=404, detail="Chatbot not found.")

    return ChatbotResponse(
        bot_id=bot.bot_id,
        name=bot.name,
        description=bot.description or "",
        department=bot.department or "",
        tags=bot.tags or "",
        file_id=bot.file_id,
        system_prompt=bot.system_prompt,
        temperature=bot.temperature,
        enable_escalation=bot.enable_escalation,
        api_key=None,
        api_key_prefix=bot.api_key_prefix,
        status=bot.status,
        created_at=bot.created_at.isoformat(),
        organization_id=bot.organization_id,
        whatsapp_enabled=bot.whatsapp_enabled,
        whatsapp_token=bot.whatsapp_token,
        whatsapp_phone_number_id=bot.whatsapp_phone_number_id,
        telegram_enabled=bot.telegram_enabled,
        telegram_token=bot.telegram_token,
    )


class ChatbotIntegrationsUpdate(BaseModel):
    whatsapp_enabled: bool
    whatsapp_token: Optional[str] = ""
    whatsapp_phone_number_id: Optional[str] = ""
    telegram_enabled: bool
    telegram_token: Optional[str] = ""


@router.put("/{bot_id}/integrations", response_model=ChatbotResponse)
def update_chatbot_integrations(
    bot_id: str,
    body: ChatbotIntegrationsUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update chatbot's WhatsApp & Telegram settings."""
    bot = db.query(Chatbot).filter(
        Chatbot.bot_id == bot_id,
        Chatbot.organization_id == user.organization_id,
    ).first()

    if not bot:
        raise HTTPException(status_code=404, detail="Chatbot not found.")

    bot.whatsapp_enabled = body.whatsapp_enabled
    bot.whatsapp_token = body.whatsapp_token
    bot.whatsapp_phone_number_id = body.whatsapp_phone_number_id
    bot.telegram_enabled = body.telegram_enabled
    bot.telegram_token = body.telegram_token

    db.commit()
    db.refresh(bot)
    return bot


@router.delete("/{bot_id}")
def delete_chatbot(
    bot_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a chatbot (admin only)."""
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can delete chatbots.")

    bot = db.query(Chatbot).filter(
        Chatbot.bot_id == bot_id,
        Chatbot.organization_id == user.organization_id,
    ).first()

    if not bot:
        raise HTTPException(status_code=404, detail="Chatbot not found.")

    db.delete(bot)
    db.commit()
    return {"message": f"Chatbot {bot_id} deleted successfully."}


@router.post("/{bot_id}/regenerate-key")
def regenerate_api_key(
    bot_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Regenerate the API key for a chatbot (admin only)."""
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can regenerate API keys.")

    bot = db.query(Chatbot).filter(
        Chatbot.bot_id == bot_id,
        Chatbot.organization_id == user.organization_id,
    ).first()

    if not bot:
        raise HTTPException(status_code=404, detail="Chatbot not found.")

    new_key = generate_api_key()
    bot.api_key_hash = hash_api_key(new_key)
    bot.api_key_prefix = new_key[:12]
    db.commit()

    return {"api_key": new_key, "message": "API key regenerated. Store it securely."}


# ---------------------------------------------------------------------------
# Telegram & WhatsApp Webhooks
# ---------------------------------------------------------------------------
import os
import requests

@router.post("/webhook/telegram/{bot_id}")
async def telegram_webhook(bot_id: str, payload: dict, db: Session = Depends(get_db)):
    """Webhook for Telegram messages."""
    bot = db.query(Chatbot).filter(Chatbot.bot_id == bot_id).first()
    if not bot or not bot.telegram_enabled or not bot.telegram_token:
        return {"status": "ignored"}

    message = payload.get("message", {})
    chat_id = message.get("chat", {}).get("id")
    text = message.get("text")

    if chat_id and text:
        from .chat import chat_with_bot, ChatRequest, ChatMessage
        try:
            chat_req = ChatRequest(
                messages=[ChatMessage(role="user", content=text)],
                chatbot_id=bot.bot_id,
                system_prompt=bot.system_prompt,
                temperature=bot.temperature,
                enable_escalation=bot.enable_escalation
            )
            chat_res = await chat_with_bot(chat_req, db)
            reply = chat_res.response

            telegram_url = f"https://api.telegram.org/bot{bot.telegram_token}/sendMessage"
            requests.post(telegram_url, json={
                "chat_id": chat_id,
                "text": reply
            })
        except Exception as e:
            print(f"Telegram webhook error: {e}")

    return {"status": "ok"}


@router.post("/{bot_id}/setup-telegram-webhook")
def setup_telegram_webhook(
    bot_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Register the Webhook URL with Telegram."""
    bot = db.query(Chatbot).filter(
        Chatbot.bot_id == bot_id,
        Chatbot.organization_id == user.organization_id
    ).first()
    if not bot:
        raise HTTPException(status_code=404, detail="Chatbot not found.")
    if not bot.telegram_token:
        raise HTTPException(status_code=400, detail="Telegram token not configured.")

    host_url = os.getenv("NEXT_PUBLIC_API_URL", "https://auraos-backend-anshuman.onrender.com")
    webhook_url = f"{host_url}/api/chatbots/webhook/telegram/{bot_id}"
    
    telegram_url = f"https://api.telegram.org/bot{bot.telegram_token}/setWebhook"
    res = requests.post(telegram_url, json={"url": webhook_url})
    
    if res.status_code == 200:
        return {"status": "success", "message": f"Webhook set to {webhook_url}", "details": res.json()}
    else:
        raise HTTPException(status_code=400, detail=f"Telegram API error: {res.text}")


@router.get("/webhook/whatsapp/{bot_id}")
def verify_whatsapp_webhook(
    bot_id: str,
    hub_mode: Optional[str] = None,
    hub_challenge: Optional[int] = None,
    hub_verify_token: Optional[str] = None
):
    """WhatsApp Webhook Verification (required by Meta)."""
    expected_verify_token = f"auraos_verify_{bot_id}"
    if hub_mode == "subscribe" and hub_verify_token in [expected_verify_token, "auraos_whatsapp_verify"]:
        from fastapi.responses import Response
        return Response(content=str(hub_challenge), media_type="text/plain")
    raise HTTPException(status_code=403, detail="Verification failed.")


@router.post("/webhook/whatsapp/{bot_id}")
async def whatsapp_webhook(bot_id: str, payload: dict, db: Session = Depends(get_db)):
    """Handle incoming messages from WhatsApp."""
    bot = db.query(Chatbot).filter(Chatbot.bot_id == bot_id).first()
    if not bot or not bot.whatsapp_enabled or not bot.whatsapp_token:
        return {"status": "ignored"}

    try:
        entry = payload.get("entry", [{}])[0]
        changes = entry.get("changes", [{}])[0]
        value = changes.get("value", {})
        messages = value.get("messages", [])
        
        if messages:
            message = messages[0]
            from_phone = message.get("from")
            text_body = message.get("text", {}).get("body")
            
            if from_phone and text_body:
                from .chat import chat_with_bot, ChatRequest, ChatMessage
                chat_req = ChatRequest(
                    messages=[ChatMessage(role="user", content=text_body)],
                    chatbot_id=bot.bot_id,
                    system_prompt=bot.system_prompt,
                    temperature=bot.temperature,
                    enable_escalation=bot.enable_escalation
                )
                chat_res = await chat_with_bot(chat_req, db)
                reply = chat_res.response

                whatsapp_url = f"https://graph.facebook.com/v17.0/{bot.whatsapp_phone_number_id}/messages"
                headers = {
                    "Authorization": f"Bearer {bot.whatsapp_token}",
                    "Content-Type": "application/json"
                }
                requests.post(whatsapp_url, headers=headers, json={
                    "messaging_product": "whatsapp",
                    "to": from_phone,
                    "type": "text",
                    "text": {"body": reply}
                })
    except Exception as e:
        print(f"WhatsApp webhook error: {e}")

    return {"status": "ok"}
