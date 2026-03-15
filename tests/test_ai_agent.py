import pytest
from app.ai_agent import create_graph, analyze_error_node
from unittest.mock import patch, MagicMock, AsyncMock
from app.models import AgentState

@pytest.mark.asyncio
async def test_analyze_error_node():
    with patch("langchain_nvidia_ai_endpoints.ChatNVIDIA.ainvoke") as mock_invoke:
        mock_msg = MagicMock()
        mock_msg.content = '{"files": ["src/index.ts"]}'
        mock_invoke.return_value = mock_msg
        
        state = AgentState(failure_logs="error", github_token="token")
        result = await analyze_error_node(state)
        assert result["files_to_fix"] == ["src/index.ts"]

def test_graph_creation():
    graph = create_graph()
    assert graph is not None
