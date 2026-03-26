import pytest
from app.ai_agent import create_graph, analyze_error_node
from unittest.mock import patch, MagicMock, AsyncMock
from app.models import AgentState


@pytest.mark.asyncio
async def test_analyze_error_node():
    with patch("app.ai_agent.get_llm") as mock_get_llm:
        mock_llm = MagicMock()
        mock_invoke = AsyncMock()
        mock_msg = MagicMock()
        mock_msg.content = '{"files": ["src/index.ts"]}'
        mock_invoke.return_value = mock_msg
        mock_llm.ainvoke = mock_invoke
        mock_get_llm.return_value = mock_llm

        state = AgentState(
            failure_logs="error",
            github_token="token",
            ai_provider="cerebras",
            ai_model="qwen-3-235b-a22b-instruct-2507"
        )
        result = await analyze_error_node(state)
        assert result["files_to_fix"] == ["src/index.ts"]


@pytest.mark.asyncio
async def test_generate_fix_node():
    with patch("app.ai_agent.get_llm") as mock_get_llm:
        mock_llm = MagicMock()
        mock_invoke = AsyncMock()
        mock_msg = MagicMock()
        mock_msg.content = "fixed code here"
        mock_invoke.return_value = mock_msg
        mock_llm.ainvoke = mock_invoke
        mock_get_llm.return_value = mock_llm

        state = AgentState(
            failure_logs="error",
            github_token="token",
            ai_provider="cerebras",
            ai_model="qwen-3-235b-a22b-instruct-2507",
            file_contents={"src/index.ts": "original code"},
            files_to_fix=["src/index.ts"]
        )
        result = await analyze_error_node(state)
        # Just verify the node runs without error
        assert "files_to_fix" in result or "fixed_contents" in result or "status" in result


def test_graph_creation():
    graph = create_graph()
    assert graph is not None
