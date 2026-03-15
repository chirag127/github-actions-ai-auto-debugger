# tests/test_ai_agent.py
import pytest
from app.ai_agent import analyze_logs_for_files
from unittest.mock import patch, MagicMock, AsyncMock

from app.ai_agent import create_graph
from app.models import AgentState

def test_graph_creation():
    graph = create_graph()
    assert graph is not None
