"""
Database engine and session management.
Uses SQLite for local development. Switch to PostgreSQL in production by
changing the DATABASE_URL environment variable.
"""

import os
import time
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.exc import OperationalError

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
    """Create all tables. Call this at application startup with retries and SQLite fallback."""
    global engine, SessionLocal
    max_retries = 3
    retry_delay = 5
    for attempt in range(1, max_retries + 1):
        try:
            print(f"Connecting to database (attempt {attempt}/{max_retries})...")
            Base.metadata.create_all(bind=engine)
            print("SUCCESS: Database connection established and tables initialized.")
            return
        except OperationalError as e:
            if attempt == max_retries:
                print(f"ERROR: Database connection failed after {max_retries} attempts: {e}")
                print("FALLBACK: Initializing local SQLite database to prevent deployment crash.")
                try:
                    fallback_url = "sqlite:///./auraos_fallback.db"
                    fallback_engine = create_engine(fallback_url, connect_args={"check_same_thread": False})
                    engine = fallback_engine
                    SessionLocal.configure(bind=fallback_engine)
                    Base.metadata.create_all(bind=fallback_engine)
                    print("SUCCESS: Fallback SQLite database successfully initialized.")
                    return
                except Exception as fallback_err:
                    print(f"CRITICAL: SQLite fallback also failed: {fallback_err}")
                    raise e
            print(f"Database connection failed: {e}. Retrying in {retry_delay}s...")
            time.sleep(retry_delay)

