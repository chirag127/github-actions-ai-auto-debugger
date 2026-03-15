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

@pytest.mark.asyncio
async def test_get_installation_token():
    from unittest.mock import MagicMock
    with patch("httpx.AsyncClient.post") as mock_post:
        mock_response = MagicMock()
        mock_response.status_code = 201
        mock_response.json.return_value = {"token": "ghs_test"}
        mock_post.return_value = mock_response
        
        token = await get_installation_token("jwt", 456)
        assert token == "ghs_test"
