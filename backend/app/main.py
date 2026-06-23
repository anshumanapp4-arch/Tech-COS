from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .api import upload, chat, agent, chatbot_manager, auth, billing
from .database import init_db

app = FastAPI(
    title="AuraOS - AI Business Automation Platform",
    description="Multi-tenant B2B SaaS for AI chatbot deployment, media ingestion, and web agent orchestration.",
    version="2.0.0",
)

import os

frontend_url = os.getenv("FRONTEND_URL")
allowed_origins = ["http://localhost:3000", "http://localhost:3001"]
if frontend_url:
    if not frontend_url.startswith("http"):
        frontend_url = f"https://{frontend_url}"
    allowed_origins.append(frontend_url)

# Setup CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?|https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API routers
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(billing.router, prefix="/api/billing", tags=["Billing & Subscriptions"])
app.include_router(upload.router, prefix="/api/upload", tags=["Upload"])
app.include_router(chat.router, prefix="/api/chat", tags=["Chat"])
app.include_router(agent.router, prefix="/api/agent", tags=["Web Agent"])
app.include_router(chatbot_manager.router, prefix="/api/chatbots", tags=["Chatbot Management"])


@app.on_event("startup")
def on_startup():
    """Initialize the database tables on application startup."""
    init_db()

    # Service health report
    print("\n" + "=" * 60)
    print("  AuraOS v2.0 - Service Health Report")
    print("=" * 60)

    gemini_key = os.getenv("GEMINI_API_KEY")
    sarvam_key = os.getenv("SARVAM_API_KEY")
    pinecone_key = os.getenv("PINECONE_API_KEY")

    print(f"  Database     : [OK] Initialized")
    print(f"  Gemini AI    : {'[OK] Configured' if gemini_key else '[WARN] Missing GEMINI_API_KEY (chat/embed fallback active)'}")
    print(f"  Sarvam STT   : {'[OK] Configured' if sarvam_key else '[WARN] Missing SARVAM_API_KEY (transcription fallback active)'}")
    print(f"  Pinecone     : {'[OK] Configured' if pinecone_key else '[WARN] Missing PINECONE_API_KEY (SQL search fallback active)'}")

    try:
        from playwright.async_api import async_playwright
        print(f"  Playwright   : [OK] Available")
    except ImportError:
        print(f"  Playwright   : [WARN] Not installed (agent simulation mode active)")

    print("=" * 60)
    print("  All systems online. Platform ready to serve requests.")
    print("=" * 60 + "\n")


@app.get("/")
def read_root():
    return {
        "message": "AuraOS Platform API is running",
        "version": "2.0.0",
        "docs": "/docs",
    }


@app.get("/api/health")
def health_check():
    return {"status": "healthy", "version": "2.0.0"}
