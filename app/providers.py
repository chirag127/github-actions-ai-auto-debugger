"""LLM Provider Registry and Factory for multi-provider support."""

from dataclasses import dataclass
from typing import Optional
from langchain_core.language_models.chat_models import BaseChatModel


@dataclass
class ProviderConfig:
    """Configuration for an LLM provider."""
    package: str
    class_name: str
    env_key: str
    default_model: str
    emoji: str
    description: str


PROVIDER_REGISTRY: dict[str, ProviderConfig] = {
    "google_gemini": ProviderConfig(
        package="langchain_google_genai",
        class_name="ChatGoogleGenerativeAI",
        env_key="GOOGLE_API_KEY",
        default_model="gemini-2.0-flash",
        emoji="💎",
        description="Google Gemini models"
    ),
    "cohere": ProviderConfig(
        package="langchain_cohere",
        class_name="ChatCohere",
        env_key="COHERE_API_KEY",
        default_model="command-r-plus",
        emoji="🔮",
        description="Cohere Command models"
    ),
    "mistral": ProviderConfig(
        package="langchain_mistralai",
        class_name="ChatMistralAI",
        env_key="MISTRAL_API_KEY",
        default_model="mistral-large-latest",
        emoji="🌬️",
        description="Mistral AI models"
    ),
    "groq": ProviderConfig(
        package="langchain_groq",
        class_name="ChatGroq",
        env_key="GROQ_API_KEY",
        default_model="llama-3.3-70b-versatile",
        emoji="⚡",
        description="Groq fast inference"
    ),
    "nvidia": ProviderConfig(
        package="langchain_nvidia_ai_endpoints",
        class_name="ChatNVIDIA",
        env_key="NVIDIA_API_KEY",
        default_model="meta/llama-3.1-8b-instruct",
        emoji="🟢",
        description="NVIDIA NIM endpoints"
    ),
    "cerebras": ProviderConfig(
        package="langchain_cerebras",
        class_name="ChatCerebras",
        env_key="CEREBRAS_API_KEY",
        default_model="qwen-3-235b-a22b-instruct-2507",
        emoji="🧠",
        description="Cerebras ultra-fast inference"
    ),
    "huggingface": ProviderConfig(
        package="langchain_huggingface",
        class_name="ChatHuggingFace",
        env_key="HUGGINGFACE_API_KEY",
        default_model="Qwen/Qwen2.5-Coder-32B-Instruct",
        emoji="🤗",
        description="Hugging Face Inference API"
    ),
    "openrouter": ProviderConfig(
        package="langchain_openrouter",
        class_name="ChatOpenRouter",
        env_key="OPENROUTER_API_KEY",
        default_model="meta-llama/llama-3-70b-instruct",
        emoji="🌐",
        description="OpenRouter multi-model gateway"
    ),
    "github_models": ProviderConfig(
        package="langchain_openai",
        class_name="ChatOpenAI",
        env_key="GITHUB_MODELS_TOKEN",
        default_model="gpt-4o",
        emoji="🐙",
        description="GitHub Models (via OpenAI-compatible API)"
    ),
}


def get_llm(provider: str, model: Optional[str] = None, api_key: Optional[str] = None) -> BaseChatModel:
    """
    Factory function to instantiate an LLM from the provider registry.
    
    Args:
        provider: Provider name (e.g., 'groq', 'cerebras', 'nvidia')
        model: Model name (optional, uses provider default if not specified)
        api_key: API key (optional, reads from env if not specified)
    
    Returns:
        A BaseChatModel instance configured for the specified provider
    
    Raises:
        ValueError: If provider is not in the registry
        ImportError: If the required package is not installed
    """
    if provider not in PROVIDER_REGISTRY:
        available = ", ".join(PROVIDER_REGISTRY.keys())
        raise ValueError(f"Unknown provider '{provider}'. Available: {available}")
    
    config = PROVIDER_REGISTRY[provider]
    
    # Get API key from env if not provided
    if api_key is None:
        import os
        api_key = os.environ.get(config.env_key)
        if api_key is None:
            raise ValueError(f"API key not found. Set {config.env_key} environment variable.")
    
    # Import the provider class dynamically
    try:
        module = __import__(config.package, fromlist=[config.class_name])
        chat_class = getattr(module, config.class_name)
    except ImportError as e:
        raise ImportError(
            f"Package '{config.package}' not installed. "
            f"Run: pip install {config.package}"
        ) from e
    
    # Build kwargs for the chat model
    kwargs = {"api_key": api_key}
    
    if model:
        kwargs["model"] = model
    else:
        kwargs["model"] = config.default_model
    
    # Special handling for GitHub Models (uses custom base_url)
    if provider == "github_models":
        kwargs["base_url"] = "https://models.inference.ai.azure.com"
    
    return chat_class(**kwargs)


def list_providers() -> dict[str, ProviderConfig]:
    """
    Returns the provider registry for display purposes.
    
    Returns:
        Dict mapping provider names to their configurations
    """
    return PROVIDER_REGISTRY.copy()
