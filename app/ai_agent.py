# app/ai_agent.py
import json
import os
import base64
from typing import Dict, Any, List
from langchain_core.messages import SystemMessage, HumanMessage
from langgraph.graph import StateGraph, END
from app.models import AgentState
from app.providers import get_llm
from app.github_api import (
    generate_jwt,
    get_installation_token,
    get_workflow_logs,
    get_file_content
)
import httpx

# --- Nodes ---

async def get_auth_node(state: AgentState):
    print("--- AUTHENTICATING ---")
    app_id = os.environ.get("GITHUB_APP_ID")
    private_key = os.environ.get("GITHUB_PRIVATE_KEY")
    if not app_id or not private_key:
        return {"status": "failed", "error_message": "Missing GITHUB_APP_ID or GITHUB_PRIVATE_KEY"}

    try:
        jwt_token = generate_jwt(app_id, private_key)
        token = await get_installation_token(jwt_token, state["installation_id"])
        return {"github_token": token, "status": "authenticated"}
    except Exception as e:
        return {"status": "failed", "error_message": f"Auth failed: {e}"}

async def fetch_logs_node(state: AgentState):
    print("--- FETCHING LOGS ---")
    logs = await get_workflow_logs(
        state["github_token"],
        state["repo_owner"],
        state["repo_name"],
        state["run_id"]
    )
    return {"failure_logs": logs}

async def analyze_error_node(state: AgentState):
    print("--- ANALYZING ERROR ---")
    llm = get_llm(state["ai_provider"], state["ai_model"])

    sys_msg = SystemMessage(content="""Analyze the logs and identify the file paths that caused the failure.
Return a JSON object with a 'files' key containing a list of strings.
Example: {"files": ["src/index.ts", "package.json"]}
Return ONLY JSON.""")
    hum_msg = HumanMessage(content=state["failure_logs"][-8000:])

    try:
        response = await llm.ainvoke([sys_msg, hum_msg])
        content = response.content.strip()
        if content.startswith("```json"): content = content[7:-3]
        if content.startswith("```"): content = content[3:-3]
        data = json.loads(content)
        return {"files_to_fix": data.get("files", [])}
    except Exception as e:
        return {"status": "failed", "error_message": f"Analysis failed: {e}"}

async def fetch_code_node(state: AgentState):
    print("--- FETCHING CODE ---")
    contents = {}
    for path in state["files_to_fix"]:
        code = await get_file_content(
            state["github_token"],
            state["repo_owner"],
            state["repo_name"],
            path,
            state["head_sha"]
        )
        if code:
            contents[path] = code
    return {"file_contents": contents}

async def generate_fix_node(state: AgentState):
    print("--- GENERATING FIXES ---")
    llm = get_llm(state["ai_provider"], state["ai_model"])

    fixed = {}
    for path, content in state["file_contents"].items():
        sys_msg = SystemMessage(content=f"You are an expert debugger. Fix the provided code based on the error logs. Return ONLY the complete fixed code for {path}. No markdown, no explanations.")
        hum_msg = HumanMessage(content=f"Error Logs:\n{state['failure_logs'][-4000:]}\n\nCode to fix:\n{content}")

        try:
            response = await llm.ainvoke([sys_msg, hum_msg])
            fixed[path] = response.content.strip()
        except Exception as e:
            print(f"Fix failed for {path}: {e}")

    return {"fixed_contents": fixed}

async def commit_fix_node(state: AgentState):
    print("--- COMMITTING FIXES ---")
    token = state["github_token"]
    owner = state["repo_owner"]
    repo = state["repo_name"]
    branch = state["branch"]

    async with httpx.AsyncClient() as client:
        for path, content in state["fixed_contents"].items():
            # Get current SHA
            url = f"https://api.github.com/repos/{owner}/{repo}/contents/{path}?ref={branch}"
            headers = {
                "Authorization": f"Bearer {token}",
                "Accept": "application/vnd.github.v3+json"
            }
            res = await client.get(url, headers=headers)
            if res.status_code != 200: continue
            sha = res.json()["sha"]

            # Commit
            commit_url = f"https://api.github.com/repos/{owner}/{repo}/contents/{path}"
            payload = {
                "message": f"fix: AI auto-patch for {path}",
                "content": base64.b64encode(content.encode()).decode(),
                "sha": sha,
                "branch": branch
            }
            await client.put(commit_url, headers=headers, json=payload)

    return {"status": "success"}

# --- Graph ---

def create_graph():
    workflow = StateGraph(AgentState)

    workflow.add_node("get_auth", get_auth_node)
    workflow.add_node("fetch_logs", fetch_logs_node)
    workflow.add_node("analyze_error", analyze_error_node)
    workflow.add_node("fetch_code", fetch_code_node)
    workflow.add_node("generate_fix", generate_fix_node)
    workflow.add_node("commit_fix", commit_fix_node)

    workflow.set_entry_point("get_auth")
    workflow.add_edge("get_auth", "fetch_logs")
    workflow.add_edge("fetch_logs", "analyze_error")
    workflow.add_edge("analyze_error", "fetch_code")
    workflow.add_edge("fetch_code", "generate_fix")
    workflow.add_edge("generate_fix", "commit_fix")
    workflow.add_edge("commit_fix", END)

    return workflow.compile()
