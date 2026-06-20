"""
SQLAlchemy ORM models for the AuraOS B2B SaaS platform.
All tenant-scoped resources carry an organization_id foreign key
to enforce strict data isolation between client companies.
"""

import uuid
import hashlib
import secrets
from datetime import datetime, timezone

from sqlalchemy import (
    Column, String, Integer, Float, Boolean, Text, DateTime,
    ForeignKey
)
from sqlalchemy.orm import relationship
from .database import Base


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def generate_uuid() -> str:
    return uuid.uuid4().hex


def generate_api_key() -> str:
    return f"sk_live_{secrets.token_hex(24)}"


def hash_api_key(key: str) -> str:
    return hashlib.sha256(key.encode()).hexdigest()


# ---------------------------------------------------------------------------
# Organization (Tenant)
# ---------------------------------------------------------------------------

class Organization(Base):
    __tablename__ = "organizations"

    id = Column(String(32), primary_key=True, default=generate_uuid)
    name = Column(String(255), nullable=False)
    slug = Column(String(255), unique=True, nullable=False)
    logo_url = Column(String(512), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationships
    users = relationship("User", back_populates="organization", cascade="all, delete-orphan")
    chatbots = relationship("Chatbot", back_populates="organization", cascade="all, delete-orphan")
    documents = relationship("Document", back_populates="organization", cascade="all, delete-orphan")
    subscription = relationship("Subscription", back_populates="organization", uselist=False, cascade="all, delete-orphan")


# ---------------------------------------------------------------------------
# User
# ---------------------------------------------------------------------------

class User(Base):
    __tablename__ = "users"

    id = Column(String(32), primary_key=True, default=generate_uuid)
    email = Column(String(320), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    name = Column(String(255), nullable=False)
    role = Column(String(20), nullable=False, default="admin")  # admin | editor | viewer
    organization_id = Column(String(32), ForeignKey("organizations.id"), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationships
    organization = relationship("Organization", back_populates="users")


# ---------------------------------------------------------------------------
# Chatbot (AI Agent)
# ---------------------------------------------------------------------------

class Chatbot(Base):
    __tablename__ = "chatbots"

    id = Column(String(32), primary_key=True, default=generate_uuid)
    bot_id = Column(String(20), unique=True, nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True, default="")
    department = Column(String(128), nullable=True, default="")
    tags = Column(String(512), nullable=True, default="")
    file_id = Column(String(255), nullable=False)
    system_prompt = Column(Text, default="You are a helpful assistant.")
    temperature = Column(Float, default=0.7)
    enable_escalation = Column(Boolean, default=False)
    api_key_hash = Column(String(64), nullable=False, index=True)
    api_key_prefix = Column(String(12), nullable=False)  # First 8 chars for display
    status = Column(String(20), default="Active")
    organization_id = Column(String(32), ForeignKey("organizations.id"), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationships
    organization = relationship("Organization", back_populates="chatbots")


# ---------------------------------------------------------------------------
# Document (Uploaded Media / Knowledge Base)
# ---------------------------------------------------------------------------

class Document(Base):
    __tablename__ = "documents"

    id = Column(String(32), primary_key=True, default=generate_uuid)
    file_id = Column(String(64), unique=True, nullable=False, index=True)
    filename = Column(String(512), nullable=False)
    transcription = Column(Text, nullable=True)
    status = Column(String(20), default="processing")  # processing | completed | error
    error_message = Column(Text, nullable=True)
    organization_id = Column(String(32), ForeignKey("organizations.id"), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationships
    organization = relationship("Organization", back_populates="documents")


# ---------------------------------------------------------------------------
# Subscription (Billing)
# ---------------------------------------------------------------------------

class Subscription(Base):
    __tablename__ = "subscriptions"

    id = Column(String(32), primary_key=True, default=generate_uuid)
    organization_id = Column(String(32), ForeignKey("organizations.id"), unique=True, nullable=False)
    plan = Column(String(50), default="free")  # free | starter | growth | enterprise
    status = Column(String(30), default="active")  # active | past_due | cancelled
    payment_gateway = Column(String(30), nullable=True)  # razorpay | stripe
    gateway_subscription_id = Column(String(255), nullable=True)
    gateway_customer_id = Column(String(255), nullable=True)
    current_period_end = Column(DateTime, nullable=True)
    max_chatbots = Column(Integer, default=2)
    max_documents = Column(Integer, default=5)
    max_queries_per_month = Column(Integer, default=500)
    queries_used = Column(Integer, default=0)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationships
    organization = relationship("Organization", back_populates="subscription")
