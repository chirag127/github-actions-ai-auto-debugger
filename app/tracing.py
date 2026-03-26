"""LangSmith Tracing Configuration for observability."""

import os


def configure_tracing() -> bool:
    """
    Configure LangSmith tracing for LLM observability.
    
    Reads the following environment variables:
    - LANGSMITH_API_KEY: Required. Your LangSmith API key.
    - LANGSMITH_PROJECT: Optional. Project name (default: "github-actions-ai-auto-debugger").
    - LANGSMITH_ENDPOINT: Optional. Endpoint URL (default: "https://api.smith.langchain.com").
    
    Returns:
        True if tracing was configured successfully, False if LANGSMITH_API_KEY is not set.
    """
    api_key = os.environ.get("LANGSMITH_API_KEY")
    
    if not api_key:
        print("⚠️  LangSmith tracing disabled: LANGSMITH_API_KEY not set")
        return False
    
    # Set required LangSmith environment variables
    os.environ["LANGCHAIN_TRACING_V2"] = "true"
    os.environ["LANGCHAIN_API_KEY"] = api_key
    os.environ["LANGCHAIN_PROJECT"] = os.environ.get(
        "LANGSMITH_PROJECT", "github-actions-ai-auto-debugger"
    )
    os.environ["LANGCHAIN_ENDPOINT"] = os.environ.get(
        "LANGSMITH_ENDPOINT", "https://api.smith.langchain.com"
    )
    
    project = os.environ["LANGCHAIN_PROJECT"]
    print(f"✅ LangSmith tracing enabled for project: {project}")
    return True
