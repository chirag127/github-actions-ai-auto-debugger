# app/github_api.py
import jwt
import time
import httpx

def generate_jwt(app_id: str, private_key_pem: str) -> str:
    now = int(time.time())
    payload = {
        "iat": now - 60,
        "exp": now + (10 * 60),
        "iss": app_id
    }
    return jwt.encode(payload, private_key_pem, algorithm="RS256")

async def get_installation_token(jwt_token: str, installation_id: int) -> str:
    url = f"https://api.github.com/app/installations/{installation_id}/access_tokens"
    headers = {
        "Authorization": f"Bearer {jwt_token}",
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "AI-Auto-Debugger"
    }
    async with httpx.AsyncClient() as client:
        response = await client.post(url, headers=headers)
        # response.raise_for_status() # Not async
        # return response.json()["token"] # Not async
        if response.status_code >= 400:
             raise Exception(f"GitHub API Error: {response.status_code}")
        return response.json()["token"]

import base64
import zipfile
import io

async def get_workflow_logs(token: str, owner: str, repo: str, run_id: int) -> str:
    url = f"https://api.github.com/repos/{owner}/{repo}/actions/runs/{run_id}/logs"
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "AI-Auto-Debugger"
    }
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(url, headers=headers, follow_redirects=True)
            if response.status_code >= 400:
                return f"Failed to get logs: {response.status_code}"
            
            if response.headers.get("content-type") == "application/zip":
                with zipfile.ZipFile(io.BytesIO(response.content)) as z:
                    logs = ""
                    for filename in z.namelist():
                        with z.open(filename) as f:
                            logs += f.read().decode('utf-8', errors='ignore') + "\n"
                    return logs[:15000]
            return response.text[:15000]
        except Exception as e:
            return f"Failed to get logs: {e}"

async def get_file_content(token: str, owner: str, repo: str, path: str, ref: str) -> str:
    url = f"https://api.github.com/repos/{owner}/{repo}/contents/{path}?ref={ref}"
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "AI-Auto-Debugger"
    }
    async with httpx.AsyncClient() as client:
        response = await client.get(url, headers=headers)
        if response.status_code == 404:
            return ""
        if response.status_code >= 400:
            return ""
        data = response.json()
        if "content" in data:
            return base64.b64decode(data["content"]).decode('utf-8')
        return ""
