from app.models import WebhookPayload, AgentState

def test_webhook_payload():
    payload = WebhookPayload(
        action="completed",
        workflow_run={"conclusion": "failure", "id": 123, "head_branch": "main", "head_sha": "abc"},
        repository={"name": "test-repo", "owner": {"login": "test-owner"}},
        sender={"login": "test-user"},
        installation={"id": 456}
    )
    assert payload.action == "completed"
