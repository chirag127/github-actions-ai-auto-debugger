"""Tests for the LLM provider registry and factory."""

import pytest
from unittest.mock import patch, MagicMock
from app.providers import get_llm, list_providers, PROVIDER_REGISTRY, ProviderConfig


class TestListProviders:
    """Tests for the list_providers function."""

    def test_list_providers_returns_all_providers(self):
        """Test that list_providers returns all 9 providers."""
        providers = list_providers()
        assert len(providers) == 9

    def test_list_providers_contains_expected_providers(self):
        """Test that all expected providers are in the registry."""
        expected_providers = {
            "google_gemini",
            "cohere",
            "mistral",
            "groq",
            "nvidia",
            "cerebras",
            "huggingface",
            "openrouter",
            "github_models",
        }
        providers = list_providers()
        assert set(providers.keys()) == expected_providers

    def test_list_providers_returns_copy(self):
        """Test that list_providers returns a copy, not the original registry."""
        providers = list_providers()
        providers["test"] = ProviderConfig(
            package="test",
            class_name="Test",
            env_key="TEST_KEY",
            default_model="test-model",
            emoji="🧪",
            description="Test provider"
        )
        assert "test" not in PROVIDER_REGISTRY


class TestGetLLM:
    """Tests for the get_llm factory function."""

    def test_get_llm_invalid_provider_raises_value_error(self):
        """Test that get_llm raises ValueError for invalid provider."""
        with pytest.raises(ValueError, match="Unknown provider"):
            get_llm(provider="xyz", api_key="fake-key")

    def test_get_llm_valid_provider_returns_chat_model(self):
        """Test that get_llm returns correct class type for valid provider."""
        with patch("builtins.__import__") as mock_import:
            mock_module = MagicMock()
            mock_class = MagicMock()
            mock_instance = MagicMock()
            mock_class.return_value = mock_instance
            mock_module.ChatGroq = mock_class
            mock_import.return_value = mock_module

            llm = get_llm(provider="groq", model="llama-3.3-70b-versatile", api_key="test-key")

            mock_class.assert_called_once_with(
                api_key="test-key",
                model="llama-3.3-70b-versatile"
            )
            assert llm is mock_instance

    def test_get_llm_uses_default_model_when_not_specified(self):
        """Test that get_llm uses provider default model when not specified."""
        with patch("builtins.__import__") as mock_import:
            mock_module = MagicMock()
            mock_class = MagicMock()
            mock_instance = MagicMock()
            mock_class.return_value = mock_instance
            mock_module.ChatGroq = mock_class
            mock_import.return_value = mock_module

            llm = get_llm(provider="groq", api_key="test-key")

            mock_class.assert_called_once_with(
                api_key="test-key",
                model="llama-3.3-70b-versatile"
            )

    def test_get_llm_reads_api_key_from_env(self):
        """Test that get_llm reads API key from environment when not provided."""
        import builtins
        original_import = builtins.__import__

        def mock_import(name, *args, **kwargs):
            if name.startswith("langchain_"):
                mock_module = MagicMock()
                mock_class = MagicMock()
                mock_instance = MagicMock()
                mock_class.return_value = mock_instance
                if "Groq" in name:
                    mock_module.ChatGroq = mock_class
                else:
                    mock_module.ChatCohere = mock_class
                return mock_module
            return original_import(name, *args, **kwargs)

        with patch("builtins.__import__", side_effect=mock_import):
            with patch.dict("os.environ", {"GROQ_API_KEY": "env-key"}):
                llm = get_llm(provider="groq")

                # Verify the chat class was called with the env key
                for call in llm.call_args_list:
                    if call[1].get("api_key") == "env-key":
                        assert call[1]["model"] == "llama-3.3-70b-versatile"
                        break
                else:
                    pytest.fail("ChatGroq not called with expected api_key")

    def test_get_llm_missing_env_key_raises_value_error(self):
        """Test that get_llm raises ValueError when API key env var is missing."""
        with patch.dict("os.environ", {}, clear=False):
            import os
            original = os.environ.pop("GROQ_API_KEY", None)
            try:
                with pytest.raises(ValueError, match="API key not found"):
                    get_llm(provider="groq")
            finally:
                if original:
                    os.environ["GROQ_API_KEY"] = original

    def test_get_llm_github_models_uses_custom_base_url(self):
        """Test that GitHub Models provider uses custom base_url."""
        with patch("builtins.__import__") as mock_import:
            mock_module = MagicMock()
            mock_class = MagicMock()
            mock_instance = MagicMock()
            mock_class.return_value = mock_instance
            mock_module.ChatOpenAI = mock_class
            mock_import.return_value = mock_module

            llm = get_llm(
                provider="github_models",
                model="gpt-4o",
                api_key="test-token"
            )

            mock_class.assert_called_once_with(
                api_key="test-token",
                model="gpt-4o",
                base_url="https://models.inference.ai.azure.com"
            )


class TestProviderConfig:
    """Tests for ProviderConfig dataclass structure."""

    def test_provider_config_has_required_fields(self):
        """Test that ProviderConfig has all required fields."""
        config = PROVIDER_REGISTRY["groq"]
        assert hasattr(config, "package")
        assert hasattr(config, "class_name")
        assert hasattr(config, "env_key")
        assert hasattr(config, "default_model")
        assert hasattr(config, "emoji")
        assert hasattr(config, "description")

    def test_provider_config_cerebras_default_model(self):
        """Test that Cerebras has the correct default model."""
        config = PROVIDER_REGISTRY["cerebras"]
        assert config.default_model == "qwen-3-235b-a22b-instruct-2507"
