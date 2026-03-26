from pydantic import BaseModel
from typing import Dict, Any, Optional, List, TypedDict

class WebhookPayload(BaseModel):
    action: str
    workflow_run: Dict[str, Any]
    repository: Dict[str, Any]
    sender: Dict[str, Any]
    installation: Optional[Dict[str, Any]] = None

class AgentState(TypedDict):
    repo_owner: str
    repo_name: str
    branch: str
    head_sha: str
    run_id: int
    installation_id: int
    github_token: str
    failure_logs: str
    files_to_fix: List[str]
    file_contents: Dict[str, str]
    fixed_contents: Dict[str, str]
    status: str
    error_message: str
    ai_provider: str
    ai_model: str
