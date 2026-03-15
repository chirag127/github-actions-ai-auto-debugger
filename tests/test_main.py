# tests/test_main.py
from fastapi.testclient import TestClient
from app.main import app
import hmac
import hashlib
import json
import pytest

client = TestClient(app)

def test_webhook_unauthorized():
    response = client.post("/webhook", json={"action": "completed"})
    assert response.status_code == 401

def test_webhook_authorized():
    import os
    os.environ["WEBHOOK_SECRET"] = "testsecret"
    payload = {
        "action": "completed", 
        "workflow_run": {"conclusion": "failure", "id": 1, "head_branch": "main", "head_sha": "abc"}, 
        "repository": {"name": "repo", "owner": {"login": "owner"}}, 
        "sender": {"login": "user"}, 
        "installation": {"id": 1}
    }
    body = json.dumps(payload).encode()
    signature = hmac.new("testsecret".encode(), body, hashlib.sha256).hexdigest()
    
    response = client.post(
        "/webhook", 
        content=body, 
        headers={
            "X-Hub-Signature-256": f"sha256={signature}", 
            "X-GitHub-Event": "workflow_run"
        }
    )
    # The current implementation returns a 202 as a tuple ({"message": "Accepted"}, 202)
    # FastAPI handles this by converting it to a response.
    assert response.status_code == 202
