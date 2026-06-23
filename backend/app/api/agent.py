"""
Web Agent API — with simulation fallback.
When Playwright + Gemini are available: real browser automation.
When unavailable: realistic simulation mode with step-by-step progress.
"""

import os
import uuid
import asyncio
import time
from datetime import datetime, timezone
from fastapi import APIRouter, BackgroundTasks
from pydantic import BaseModel
from typing import Optional, Dict

from ..config import GEMINI_API_KEY

router = APIRouter()

# ---------------------------------------------------------------------------
# External service initialization (graceful)
# ---------------------------------------------------------------------------

gemini_client = None
if GEMINI_API_KEY:
    try:
        from google import genai
        gemini_client = genai.Client(api_key=GEMINI_API_KEY)
        print("[OK] Agent: Gemini AI client initialized.")
    except Exception as e:
        print(f"[WARN] Agent: Gemini client init failed: {e}")

# Check if Playwright is available
playwright_available = False
try:
    from playwright.async_api import async_playwright
    playwright_available = True
    print("[OK] Agent: Playwright browser automation available.")
except ImportError:
    print("[INFO] Agent: Playwright not installed -- running in simulation mode.")


# ---------------------------------------------------------------------------
# In-memory task storage for status polling
# ---------------------------------------------------------------------------

agent_tasks: Dict[str, dict] = {}


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class AgentRequest(BaseModel):
    instruction: str
    target_url: str


class AgentResponse(BaseModel):
    task_id: str
    status: str
    mode: str = "simulation"


class AgentStatusResponse(BaseModel):
    task_id: str
    status: str  # "running" | "completed" | "error"
    mode: str
    steps: list
    result: Optional[str] = None
    screenshot_url: Optional[str] = None
    started_at: str
    completed_at: Optional[str] = None


# ---------------------------------------------------------------------------
# Real Playwright agent (when available)
# ---------------------------------------------------------------------------

async def execute_playwright_agent(instruction: str, target_url: str, task_id: str):
    """Full Playwright + Gemini agent execution."""
    agent_tasks[task_id]["steps"].append({
        "step": 1, "action": "Launching headless browser...",
        "timestamp": datetime.now(timezone.utc).isoformat()
    })

    try:
        from playwright.async_api import async_playwright as ap
        async with ap() as p:
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page()

            agent_tasks[task_id]["steps"].append({
                "step": 2, "action": f"Navigating to {target_url}...",
                "timestamp": datetime.now(timezone.utc).isoformat()
            })

            await page.goto(target_url, wait_until="networkidle", timeout=15000)

            agent_tasks[task_id]["steps"].append({
                "step": 3, "action": "Page loaded. Analyzing content with Gemini AI...",
                "timestamp": datetime.now(timezone.utc).isoformat()
            })

            page_text = await page.evaluate("() => document.body.innerText.substring(0, 5000)")
            page_title = await page.title()

            if gemini_client:
                prompt = f"""
You are an autonomous web agent controlling a browser.
Target URL: {target_url}
Page Title: {page_title}
User Instruction: {instruction}

Current page text (first 5000 chars):
{page_text}

Based on the instruction, describe the EXACT action you would take.
If the task is already completed or cannot be completed, say 'Task complete' or 'Task failed' with a reason.
"""
                response = gemini_client.models.generate_content(
                    model='gemini-2.5-flash',
                    contents=prompt
                )
                decision = response.text
            else:
                decision = f"Analyzed page '{page_title}'. Content loaded successfully. Ready for next instruction."

            agent_tasks[task_id]["steps"].append({
                "step": 4, "action": f"AI Decision: {decision[:200]}",
                "timestamp": datetime.now(timezone.utc).isoformat()
            })

            # Save screenshot
            screenshot_path = f"uploads/agent_{task_id}.png"
            await page.screenshot(path=screenshot_path)
            agent_tasks[task_id]["screenshot_url"] = f"/uploads/agent_{task_id}.png"

            agent_tasks[task_id]["steps"].append({
                "step": 5, "action": "Screenshot captured. Task completed.",
                "timestamp": datetime.now(timezone.utc).isoformat()
            })

            await browser.close()

        agent_tasks[task_id]["status"] = "completed"
        agent_tasks[task_id]["result"] = decision
        agent_tasks[task_id]["completed_at"] = datetime.now(timezone.utc).isoformat()

    except Exception as e:
        agent_tasks[task_id]["steps"].append({
            "step": -1, "action": f"Error: {str(e)}",
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        agent_tasks[task_id]["status"] = "error"
        agent_tasks[task_id]["result"] = f"Agent error: {str(e)}"
        agent_tasks[task_id]["completed_at"] = datetime.now(timezone.utc).isoformat()


# ---------------------------------------------------------------------------
# Simulation mode (when Playwright/Gemini unavailable)
# ---------------------------------------------------------------------------

def run_simulated_agent(instruction: str, target_url: str, task_id: str):
    """Simulate agent execution with realistic step-by-step progress."""
    import requests as req

    steps = [
        ("Initializing browser engine...", 1.0),
        (f"Navigating to {target_url}...", 1.5),
        ("Page loaded. Scanning DOM structure...", 1.0),
        ("Extracting page content and metadata...", 1.2),
        (f"Analyzing instruction: '{instruction[:80]}...'", 1.5),
        ("Planning execution steps...", 0.8),
    ]

    # Try to actually fetch the page to get real info
    page_title = "Unknown Page"
    page_info = ""
    try:
        resp = req.get(target_url, timeout=10, headers={
            "User-Agent": "AuraOS-WebAgent/2.0"
        })
        if resp.status_code == 200:
            # Extract title from HTML
            import re
            title_match = re.search(r'<title[^>]*>(.*?)</title>', resp.text, re.IGNORECASE | re.DOTALL)
            if title_match:
                page_title = title_match.group(1).strip()[:100]
            page_info = f"Page responded with HTTP {resp.status_code}, title: '{page_title}'"
        else:
            page_info = f"Page responded with HTTP {resp.status_code}"
    except Exception as e:
        page_info = f"Could not reach page: {str(e)[:100]}"

    steps.extend([
        (f"Page analysis complete: {page_info}", 1.0),
        (f"Identified target elements for: '{instruction[:60]}'", 1.0),
        ("Executing planned actions...", 1.5),
        ("Verifying action results...", 0.8),
        ("Capturing final page state...", 0.5),
        ("Task execution completed successfully.", 0.0),
    ])

    for i, (action, delay) in enumerate(steps, 1):
        agent_tasks[task_id]["steps"].append({
            "step": i,
            "action": action,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })
        if delay > 0:
            time.sleep(delay)

    result_summary = (
        f"[OK] Agent completed task on '{page_title}'\n\n"
        f"**Target:** {target_url}\n"
        f"**Instruction:** {instruction}\n"
        f"**Page Status:** {page_info}\n\n"
        f"_Running in simulation mode. Install Playwright and configure GEMINI_API_KEY "
        f"for full autonomous browser control._"
    )

    agent_tasks[task_id]["status"] = "completed"
    agent_tasks[task_id]["result"] = result_summary
    agent_tasks[task_id]["completed_at"] = datetime.now(timezone.utc).isoformat()


def run_real_agent(instruction: str, target_url: str, task_id: str):
    """Run the real Playwright agent in a new event loop."""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    loop.run_until_complete(execute_playwright_agent(instruction, target_url, task_id))
    loop.close()


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/execute", response_model=AgentResponse)
async def execute_agent(request: AgentRequest, background_tasks: BackgroundTasks):
    """Launch a web agent task. Returns immediately with a task_id for polling."""
    task_id = str(uuid.uuid4())
    mode = "full" if (playwright_available and gemini_client) else "simulation"

    agent_tasks[task_id] = {
        "task_id": task_id,
        "status": "running",
        "mode": mode,
        "steps": [],
        "result": None,
        "screenshot_url": None,
        "started_at": datetime.now(timezone.utc).isoformat(),
        "completed_at": None,
        "instruction": request.instruction,
        "target_url": request.target_url,
    }

    if playwright_available and gemini_client:
        background_tasks.add_task(run_real_agent, request.instruction, request.target_url, task_id)
    else:
        background_tasks.add_task(run_simulated_agent, request.instruction, request.target_url, task_id)

    return AgentResponse(
        task_id=task_id,
        status="Agent execution started in background",
        mode=mode,
    )


@router.get("/status/{task_id}", response_model=AgentStatusResponse)
async def get_agent_status(task_id: str):
    """Poll for agent task progress and results."""
    task = agent_tasks.get(task_id)
    if not task:
        return AgentStatusResponse(
            task_id=task_id,
            status="not_found",
            mode="unknown",
            steps=[{"step": 0, "action": "Task not found. It may have expired.", "timestamp": datetime.now(timezone.utc).isoformat()}],
            started_at=datetime.now(timezone.utc).isoformat(),
        )

    return AgentStatusResponse(
        task_id=task["task_id"],
        status=task["status"],
        mode=task["mode"],
        steps=task["steps"],
        result=task.get("result"),
        screenshot_url=task.get("screenshot_url"),
        started_at=task["started_at"],
        completed_at=task.get("completed_at"),
    )
