"""
Authentication API endpoints.
Handles user registration (with automatic Organization creation),
login (JWT issuance), and current-user retrieval.
"""

import os
import re
import uuid
import jwt
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from passlib.context import CryptContext

from ..database import SessionLocal
from ..models import Organization, User, Subscription, generate_uuid
from .deps import get_db, get_current_user, JWT_SECRET, JWT_ALGORITHM

router = APIRouter()

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

JWT_EXPIRATION_HOURS = int(os.getenv("JWT_EXPIRATION_HOURS", "72"))


# ---------------------------------------------------------------------------
# Request / Response Schemas
# ---------------------------------------------------------------------------

class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str
    organization_name: str


class LoginRequest(BaseModel):
    email: str
    password: str


class UserResponse(BaseModel):
    id: str
    name: str
    email: str
    role: str
    organization_id: str
    organization_name: str

    class Config:
        from_attributes = True


class AuthResponse(BaseModel):
    token: str
    user: UserResponse


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def create_access_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def slugify(text: str) -> str:
    """Convert organization name to a URL-safe slug."""
    slug = re.sub(r"[^\w\s-]", "", text.lower())
    slug = re.sub(r"[\s_]+", "-", slug).strip("-")
    return slug or f"org-{uuid.uuid4().hex[:8]}"


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def register(body: RegisterRequest, db: Session = Depends(get_db)):
    """Register a new user and create their organization."""
    # Validate
    if len(body.password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 6 characters."
        )

    existing = db.query(User).filter(User.email == body.email.lower()).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists."
        )

    # Create Organization
    org_slug = slugify(body.organization_name)
    existing_org = db.query(Organization).filter(Organization.slug == org_slug).first()
    if existing_org:
        org_slug = f"{org_slug}-{uuid.uuid4().hex[:6]}"

    org = Organization(
        id=generate_uuid(),
        name=body.organization_name,
        slug=org_slug,
    )
    db.add(org)
    db.flush()

    # Create User (admin of the new org)
    user = User(
        id=generate_uuid(),
        email=body.email.lower(),
        hashed_password=pwd_context.hash(body.password),
        name=body.name,
        role="admin",
        organization_id=org.id,
    )
    db.add(user)

    # Create free-tier Subscription
    subscription = Subscription(
        id=generate_uuid(),
        organization_id=org.id,
        plan="free",
        status="active",
        max_chatbots=2,
        max_documents=5,
        max_queries_per_month=500,
    )
    db.add(subscription)

    db.commit()
    db.refresh(user)
    db.refresh(org)

    token = create_access_token(user.id)

    return AuthResponse(
        token=token,
        user=UserResponse(
            id=user.id,
            name=user.name,
            email=user.email,
            role=user.role,
            organization_id=org.id,
            organization_name=org.name,
        )
    )


@router.post("/login", response_model=AuthResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    """Authenticate and return a JWT token."""
    user = db.query(User).filter(User.email == body.email.lower()).first()
    if not user or not pwd_context.verify(body.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password."
        )

    org = db.query(Organization).filter(Organization.id == user.organization_id).first()

    token = create_access_token(user.id)

    return AuthResponse(
        token=token,
        user=UserResponse(
            id=user.id,
            name=user.name,
            email=user.email,
            role=user.role,
            organization_id=user.organization_id,
            organization_name=org.name if org else "Unknown",
        )
    )


@router.get("/me", response_model=UserResponse)
def get_me(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Return the currently authenticated user."""
    org = db.query(Organization).filter(Organization.id == user.organization_id).first()
    return UserResponse(
        id=user.id,
        name=user.name,
        email=user.email,
        role=user.role,
        organization_id=user.organization_id,
        organization_name=org.name if org else "Unknown",
    )
