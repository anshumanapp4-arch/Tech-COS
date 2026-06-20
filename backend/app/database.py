"""
Database engine and session management.
Uses SQLite for local development. Switch to PostgreSQL in production by
changing the DATABASE_URL environment variable.
"""

import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./auraos.db")
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# Fallback to pg8000 dialect if psycopg2 is not installed (e.g. newer Python versions)
if DATABASE_URL.startswith("postgresql://"):
    try:
        import psycopg2
    except ImportError:
        DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+pg8000://", 1)

# For SQLite we need check_same_thread=False to allow FastAPI's threaded access
connect_args = {"check_same_thread": False} if "sqlite" in DATABASE_URL else {}

engine = create_engine(DATABASE_URL, connect_args=connect_args, echo=False)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def init_db():
    """Create all tables. Call this at application startup."""
    Base.metadata.create_all(bind=engine)
