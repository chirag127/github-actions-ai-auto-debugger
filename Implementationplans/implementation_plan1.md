# Multi-Provider LLM Selection + LangSmith Tracing

Add user-configurable LLM provider/model selection using
LangChain-native integrations, plus LangSmith observability.

## Providers (LangChain-native only)

| Provider | Package | Chat Class | Env Key |
|---|---|---|---|
| Google Gemini | `langchain-google-genai` | `ChatGoogleGenerativeAI` | `GOOGLE_API_KEY` |
| Cohere | `langchain-cohere` | `ChatCohere` | `COHERE_API_KEY` |
| Mistral AI | `langchain-mistralai` | `ChatMistralAI` | `MISTRAL_API_KEY` |
| Groq | `langchain-groq` | `ChatGroq` | `GROQ_API_KEY` |
| NVIDIA NIM | `langchain-nvidia-ai-endpoints` | `ChatNVIDIA` | `NVIDIA_API_KEY` |
| Cerebras | `langchain-cerebras` | `ChatCerebras` | `CEREBRAS_API_KEY` |
| HuggingFace | `langchain-huggingface` | `ChatHuggingFace` | `HUGGINGFACE_API_KEY` |
| OpenRouter | `langchain-openrouter` | `ChatOpenRouter` | `OPENROUTER_API_KEY` |
| GitHub Models | `langchain-openai` | `ChatOpenAI` (custom base_url) | `GITHUB_MODELS_TOKEN` |

> [!IMPORTANT]
> The user selects a provider via the `AI_PROVIDER` and
> `AI_MODEL` environment variables. If not set, defaults to
> `groq` / `llama-3.3-70b-versatile` (free tier).

## Proposed Changes

### Provider System

#### [NEW] [providers.py](file:///c:/AM/GitHub/github-actions-ai-auto-debugger/app/providers.py)

- `PROVIDER_REGISTRY`: dict mapping provider name →
  `ProviderConfig` dataclass (package, class, env key,
  default model, flag emoji, description)
- `get_llm(provider, model, api_key=None)`: factory function
  returning a `BaseChatModel` instance
- `list_providers()`: returns the registry for display

---

### LangSmith Tracing

#### [NEW] [tracing.py](file:///c:/AM/GitHub/github-actions-ai-auto-debugger/app/tracing.py)

- `configure_tracing()`: reads `LANGSMITH_API_KEY`,
  `LANGSMITH_PROJECT`, `LANGSMITH_ENDPOINT` from env;
  sets `LANGCHAIN_TRACING_V2=true` and related env vars
- Called once at app startup in [main.py](file:///c:/AM/GitHub/github-actions-ai-auto-debugger/app/main.py)

---

### Model Updates

#### [MODIFY] [models.py](file:///c:/AM/GitHub/github-actions-ai-auto-debugger/app/models.py)

- Add `ai_provider: str` and `ai_model: str` fields to
  [AgentState](file:///c:/AM/GitHub/github-actions-ai-auto-debugger/app/models.py#11-25)

---

### Agent Updates

#### [MODIFY] [ai_agent.py](file:///c:/AM/GitHub/github-actions-ai-auto-debugger/app/ai_agent.py)

- Remove duplicate imports at top
- Replace hardcoded `ChatNVIDIA(...)` calls in
  [analyze_error_node](file:///c:/AM/GitHub/github-actions-ai-auto-debugger/app/ai_agent.py#49-69) and [generate_fix_node](file:///c:/AM/GitHub/github-actions-ai-auto-debugger/app/ai_agent.py#85-102) with
  `get_llm(state["ai_provider"], state["ai_model"])`
- Remove direct `NVIDIA_API_KEY` reads

---

### Entry Point

#### [MODIFY] [main.py](file:///c:/AM/GitHub/github-actions-ai-auto-debugger/app/main.py)

- Import and call `configure_tracing()` at startup
- Read `AI_PROVIDER` and `AI_MODEL` from env
- Pass them into `initial_state` dict

---

### Configuration

#### [MODIFY] [.env.example](file:///c:/AM/GitHub/github-actions-ai-auto-debugger/.env.example)

Add sections for:
- `AI_PROVIDER` / `AI_MODEL` selection
- All provider API keys (one per provider)
- LangSmith keys (`LANGSMITH_API_KEY`,
  `LANGSMITH_PROJECT`, `LANGSMITH_ENDPOINT`)

#### [MODIFY] [requirements.txt](file:///c:/AM/GitHub/github-actions-ai-auto-debugger/requirements.txt)

Add all LangChain provider packages + `langsmith`.

---

### Tests

#### [MODIFY] [test_ai_agent.py](file:///c:/AM/GitHub/github-actions-ai-auto-debugger/tests/test_ai_agent.py)

- Update mock path from `langchain_nvidia_ai_endpoints`
  to use the new `providers.get_llm` factory
- Update [AgentState](file:///c:/AM/GitHub/github-actions-ai-auto-debugger/app/models.py#11-25) construction to include
  `ai_provider` / `ai_model`

#### [NEW] [test_providers.py](file:///c:/AM/GitHub/github-actions-ai-auto-debugger/tests/test_providers.py)

- Test `list_providers()` returns all 9 providers
- Test `get_llm()` with valid provider returns correct
  class type (mocked)
- Test `get_llm()` with invalid provider raises
  `ValueError`

---

### Documentation

#### [MODIFY] [README.md](file:///c:/AM/GitHub/github-actions-ai-auto-debugger/README.md)

- Add provider selection table
- Add LangSmith setup section

## Verification Plan

### Automated Tests

```bash
pytest tests/ -v
```

- Existing tests updated to pass with new [AgentState](file:///c:/AM/GitHub/github-actions-ai-auto-debugger/app/models.py#11-25)
  fields
- New `test_providers.py` covers the provider registry
  and factory function
- [test_ai_agent.py](file:///c:/AM/GitHub/github-actions-ai-auto-debugger/tests/test_ai_agent.py) updated to mock `get_llm` instead
  of `ChatNVIDIA` directly

### Manual Verification

1. Set `AI_PROVIDER=groq` and `AI_MODEL=llama-3.3-70b-versatile`
   in [.env](file:///c:/AM/GitHub/github-actions-ai-auto-debugger/.env), run the app, and observe the correct Groq
   model being instantiated in logs
2. Set invalid `AI_PROVIDER=xyz`, observe the app raising
   a clear `ValueError`
