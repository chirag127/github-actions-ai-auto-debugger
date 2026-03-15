# app/main.py
from fastapi import FastAPI, Request, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse
import hmac
import hashlib
import os
import json
from app.models import WebhookPayload

app = FastAPI()

def verify_signature(secret: str, payload: bytes, signature: str) -> bool:
    if not signature or not signature.startswith("sha256="): return False
    mac = hmac.new(secret.encode(), msg=payload, digestmod=hashlib.sha256)
    return hmac.compare_digest(f"sha256={mac.hexdigest()}", signature)

from app.ai_agent import create_graph

async def process_webhook_background(payload: WebhookPayload):
    print(f"--- STARTING AI AGENT FOR RUN {payload.workflow_run.get('id')} ---")
    graph = create_graph()
    
    initial_state = {
        "repo_owner": payload.repository["owner"]["login"],
        "repo_name": payload.repository["name"],
        "branch": payload.workflow_run["head_branch"],
        "head_sha": payload.workflow_run["head_sha"],
        "run_id": payload.workflow_run["id"],
        "installation_id": payload.installation["id"],
        "github_token": "",
        "failure_logs": "",
        "files_to_fix": [],
        "file_contents": {},
        "fixed_contents": {},
        "status": "started",
        "error_message": ""
    }
    
    try:
        await graph.ainvoke(initial_state)
        print("--- AI AGENT COMPLETED ---")
    except Exception as e:
        print(f"--- AI AGENT FAILED: {e} ---")

@app.post("/webhook")
async def handle_webhook(request: Request, background_tasks: BackgroundTasks):
    body = await request.body()
    signature = request.headers.get("X-Hub-Signature-256", "")
    secret = os.environ.get("WEBHOOK_SECRET", "")
    
    if not secret:
        # For testing purposes if env is not set
        secret = "testsecret"

    if not verify_signature(secret, body, signature):
        raise HTTPException(status_code=401, detail="Invalid signature")
        
    event = request.headers.get("X-GitHub-Event")
    if event != "workflow_run":
        return JSONResponse(content={"message": "Ignored event"}, status_code=200)
        
    try:
        payload_dict = json.loads(body)
        payload = WebhookPayload(**payload_dict)
    except Exception as e:
        print(f"Payload error: {e}")
        raise HTTPException(status_code=400, detail="Invalid payload")
        
    if payload.action != "completed" or payload.workflow_run.get("conclusion") != "failure":
        return JSONResponse(content={"message": "Ignored run"}, status_code=200)
        
    if "[bot]" in payload.sender.get("login", ""):
        return JSONResponse(content={"message": "Ignored bot sender"}, status_code=200)
        
    background_tasks.add_task(process_webhook_background, payload)
    return JSONResponse(content={"message": "Accepted"}, status_code=202)
