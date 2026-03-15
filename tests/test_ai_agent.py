# tests/test_ai_agent.py
import pytest
from app.ai_agent import analyze_logs_for_files
from unittest.mock import patch, MagicMock, AsyncMock

@pytest.mark.asyncio
async def test_analyze_logs_for_files():
    with patch("langchain_nvidia_ai_endpoints.ChatNVIDIA.ainvoke") as mock_invoke:
        mock_msg = MagicMock()
        mock_msg.content = '["src/index.ts", "package.json"]'
        mock_invoke.return_value = mock_msg
        
        files = await analyze_logs_for_files("error in index.ts")
        assert len(files) == 2
        assert "src/index.ts" in files
