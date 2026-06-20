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
    )


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
