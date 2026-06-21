import os
import asyncio
from fastapi import APIRouter, BackgroundTasks
from pydantic import BaseModel
from google import genai
from playwright.async_api import async_playwright

router = APIRouter()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
gemini_client = None
if GEMINI_API_KEY:
    gemini_client = genai.Client(api_key=GEMINI_API_KEY)

class AgentRequest(BaseModel):
    instruction: str
    target_url: str

class AgentResponse(BaseModel):
    task_id: str
    status: str

async def execute_playwright_agent(instruction: str, target_url: str, task_id: str):
    print(f"[{task_id}] Starting Web Agent for {target_url}")
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page()
            await page.goto(target_url, wait_until="networkidle")
            
            print(f"[{task_id}] Page loaded. Asking Gemini for actions...")
            
            # Simplified agent loop (1 step for demonstration)
            # In a full production app, this would loop until the goal is achieved
            page_text = await page.evaluate("() => document.body.innerText.substring(0, 5000)")
            
            prompt = f"""
You are an autonomous web agent controlling a browser.
Target URL: {target_url}
User Instruction: {instruction}

Current page text (first 5000 chars):
{page_text}

Based on the instruction, describe the EXACT action you would take (e.g., 'I will click on the Login button').
If the task is already completed or cannot be completed, say 'Task complete' or 'Task failed'.
"""
            # Call synchronous SDK in thread pool or just use it synchronously since we are in background task
            # Actually, we are in an async function, so let's run it in executor or just call it (it might block but it's okay for MVP)
            response = gemini_client.models.generate_content(
                model='gemini-2.5-flash',
                contents=prompt
            )
            
            decision = response.text
            print(f"[{task_id}] Gemini Decision: {decision}")
            
            # Example action execution based on LLM decision (Mocked execution for safety in MVP)
            # await page.click("text='Login'") 
            
            await page.screenshot(path=f"uploads/agent_{task_id}.png")
            print(f"[{task_id}] Screenshot saved. Agent task completed.")
            
            await browser.close()
    except Exception as e:
        print(f"[{task_id}] Agent Error: {e}")

def run_web_agent(instruction: str, target_url: str, task_id: str):
    # Create a new event loop for the background thread
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    loop.run_until_complete(execute_playwright_agent(instruction, target_url, task_id))
    loop.close()

@router.post("/execute", response_model=AgentResponse)
async def execute_agent(request: AgentRequest, background_tasks: BackgroundTasks):
    import uuid
    task_id = str(uuid.uuid4())
    
    background_tasks.add_task(run_web_agent, request.instruction, request.target_url, task_id)
    
    return AgentResponse(
        task_id=task_id,
        status="Agent execution started in background"
    )
