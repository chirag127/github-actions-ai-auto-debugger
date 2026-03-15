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
