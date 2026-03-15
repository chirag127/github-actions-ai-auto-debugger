import hmac
import hashlib
import json
import requests
import sys
import os
from dotenv import load_dotenv

load_dotenv()

def test_webhook(url, secret):
    payload = {
        "action": "completed",
        "workflow_run": {
            "conclusion": "failure",
            "id": 12345678,
            "head_branch": "main",
            "head_sha": "abc1234567890abcdef1234567890abcdef12345"
        },
        "repository": {
            "name": "test-repo",
            "owner": {"login": "test-owner"}
        },
        "sender": {"login": "test-user"},
        "installation": {"id": 123456}
    }
    
    body = json.dumps(payload).encode()
    signature = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    
    headers = {
        "X-Hub-Signature-256": f"sha256={signature}",
        "X-GitHub-Event": "workflow_run",
        "Content-Type": "application/json"
    }
    
    print(f"🚀 Sending mock webhook to {url}...")
    try:
        response = requests.post(url, data=body, headers=headers)
        print(f"Response Code: {response.status_code}")
        print(f"Response Body: {response.json()}")
        if response.status_code == 202:
            print("✅ TEST PASSED: Webhook accepted and processing in background.")
        else:
            print("❌ TEST FAILED: Unexpected response code.")
    except Exception as e:
        print(f"💥 ERROR: {e}")

if __name__ == "__main__":
    if len(sys.argv) < 3:
        url = os.getenv("WORKER_URL", "http://localhost:8000/webhook")
        secret = os.getenv("WEBHOOK_SECRET", "testsecret")
    else:
        url = sys.argv[1]
        secret = sys.argv[2]
        
    test_webhook(url, secret)
