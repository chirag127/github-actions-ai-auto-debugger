import pytest
from app.github_api import generate_jwt, get_installation_token
from unittest.mock import patch, AsyncMock

def test_generate_jwt():
    import cryptography.hazmat.primitives.asymmetric.rsa as rsa
    from cryptography.hazmat.primitives import serialization
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption()
    ).decode('utf-8')
    
    token = generate_jwt("123", pem)
    assert isinstance(token, str)
    assert len(token) > 0

from app.github_api import get_workflow_logs, get_file_content

@pytest.mark.asyncio
async def test_get_workflow_logs():
    with patch("httpx.AsyncClient.get") as mock_get:
        mock_response = AsyncMock()
        mock_response.status_code = 200
        mock_response.text = "Error: File src/index.ts not found"
        mock_response.headers = {"content-type": "text/plain"}
        mock_get.return_value = mock_response
        logs = await get_workflow_logs("token", "owner", "repo", 123)
        assert "Error" in logs

@pytest.mark.asyncio
async def test_get_file_content():
    from unittest.mock import MagicMock
    with patch("httpx.AsyncClient.get") as mock_get:
        mock_response = MagicMock()
        mock_response.status_code = 200
        # Base64 for "const x = 1;"
        mock_response.json.return_value = {"content": "Y29uc3QgeCA9IDE7\n"}
        mock_get.return_value = mock_response
        content = await get_file_content("token", "owner", "repo", "path/to/file", "main")
        assert content == "const x = 1;"
