# app/ai_agent.py
import json
import os
from langchain_nvidia_ai_endpoints import ChatNVIDIA
from langchain_core.messages import SystemMessage, HumanMessage

async def analyze_logs_for_files(logs: str) -> list[str]:
    api_key = os.environ.get("NVIDIA_API_KEY", "mock_key")
    llm = ChatNVIDIA(model="meta/llama-3.1-8b-instruct", api_key=api_key)
    sys_msg = SystemMessage(content="Analyze the logs and output a JSON array of file paths that caused the error. Example: [\"src/main.py\"]. Return ONLY JSON.")
    hum_msg = HumanMessage(content=logs[-5000:])
    
    try:
        response = await llm.ainvoke([sys_msg, hum_msg])
        content = response.content.strip()
        if content.startswith("```json"): content = content[7:-3]
        if content.startswith("```"): content = content[3:-3]
        return json.loads(content)
    except Exception as e:
        print(f"Error in log analysis: {e}")
        return []

from langgraph.graph import StateGraph, END
from app.models import AgentState

async def fetch_logs_node(state: AgentState):
    # This will be wired up to github_api later
    return {"status": "logs_fetched"}

async def analyze_error_node(state: AgentState):
    return {"status": "analyzed"}

def create_graph():
    workflow = StateGraph(AgentState)
    
    workflow.add_node("fetch_logs", fetch_logs_node)
    workflow.add_node("analyze_error", analyze_error_node)
    
    workflow.set_entry_point("fetch_logs")
    workflow.add_edge("fetch_logs", "analyze_error")
    workflow.add_edge("analyze_error", END)
    
    return workflow.compile()
