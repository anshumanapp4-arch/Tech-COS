from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .api import upload, chat, agent, chatbot_manager, auth, billing
from .database import init_db

app = FastAPI(
    title="AuraOS — AI Business Automation Platform",
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
    print("SUCCESS: AuraOS v2.0 - Database initialized. All systems online.")


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
