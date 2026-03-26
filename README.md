# GitHub Actions AI Auto-Debugger

A Python-based GitHub App backend that automatically fixes failed workflows using LangGraph with multi-provider LLM support.

## 🚀 Features
- **Multi-Provider LLM Selection:** Choose from 9 different LLM providers (Cerebras, Groq, NVIDIA, Google, and more)
- **LangSmith Observability:** Built-in tracing and monitoring for all LLM calls
- **Stateless & Lightweight:** Runs perfectly on a free Azure B1s VM (1GB RAM)
- **LangGraph Driven:** Modular state machine for robust debugging logic
- **Secure:** HMAC webhook verification and JWT-based GitHub App authentication

## 🛠️ Tech Stack
- **Python 3.11+**
- **FastAPI** (Web server)
- **LangGraph** (Agent orchestration)
- **LangChain** (Multi-provider LLM abstraction)
- **LangSmith** (Observability and tracing)

## 🤖 LLM Provider Selection

This project supports multiple LLM providers through LangChain-native integrations. Configure your provider via environment variables:

```bash
AI_PROVIDER=cerebras
AI_MODEL=qwen-3-235b-a22b-instruct-2507
```

### Available Providers

| Provider | Package | Chat Class | Env Key | Default Model |
|----------|---------|------------|---------|---------------|
| 💎 Google Gemini | `langchain-google-genai` | `ChatGoogleGenerativeAI` | `GOOGLE_API_KEY` | `gemini-2.0-flash` |
| 🔮 Cohere | `langchain-cohere` | `ChatCohere` | `COHERE_API_KEY` | `command-r-plus` |
| 🌬️ Mistral AI | `langchain-mistralai` | `ChatMistralAI` | `MISTRAL_API_KEY` | `mistral-large-latest` |
| ⚡ Groq | `langchain-groq` | `ChatGroq` | `GROQ_API_KEY` | `llama-3.3-70b-versatile` |
| 🟢 NVIDIA NIM | `langchain-nvidia-ai-endpoints` | `ChatNVIDIA` | `NVIDIA_API_KEY` | `meta/llama-3.1-8b-instruct` |
| 🧠 Cerebras | `langchain-cerebras` | `ChatCerebras` | `CEREBRAS_API_KEY` | `qwen-3-235b-a22b-instruct-2507` |
| 🤗 HuggingFace | `langchain-huggingface` | `ChatHuggingFace` | `HUGGINGFACE_API_KEY` | `Qwen/Qwen2.5-Coder-32B-Instruct` |
| 🌐 OpenRouter | `langchain-openrouter` | `ChatOpenRouter` | `OPENROUTER_API_KEY` | `meta-llama/llama-3-70b-instruct` |
| 🐙 GitHub Models | `langchain-openai` | `ChatOpenAI` | `GITHUB_MODELS_TOKEN` | `gpt-4o` |

> **Default:** `cerebras` / `qwen-3-235b-a22b-instruct-2507`

## 📋 Configuration

### Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
# AI Provider Selection (default: cerebras)
AI_PROVIDER=cerebras
AI_MODEL=qwen-3-235b-a22b-instruct-2507

# Your chosen provider's API key
CEREBRAS_API_KEY=your_cerebras_api_key_here

# Langfuse Observability (FREE - unlimited traces)
LANGFUSE_PUBLIC_KEY=pk-lf-...
LANGFUSE_SECRET_KEY=sk-lf-...
```

## 🔭 Langfuse Observability (FREE - Unlimited Traces)

Langfuse provides **unlimited free traces** (vs LangSmith's 1,000/month limit) with tracing, monitoring, and analytics for all LLM calls:

1. **Create a Langfuse account** at [cloud.langfuse.com](https://cloud.langfuse.com) (free, no credit card required)
2. **Get your API keys** from Project Settings → API Keys
3. **Set environment variables:**
   ```bash
   LANGFUSE_PUBLIC_KEY=pk-lf-...
   LANGFUSE_SECRET_KEY=sk-lf-...
   ```
4. **View traces** in your Langfuse dashboard to debug issues and analyze performance

> 💡 **Why Langfuse?** Unlimited free traces, open-source, self-hostable option

## 🚀 Fully Automated Deployment (Azure VM)

This project is designed to be **Zero-Touch**. Once configured, every push to `main` will automatically redeploy the service to your Azure VM and restart the background tasks.

### 1. GitHub Repository Secrets
Go to **Settings → Secrets and variables → Actions** and add the following secrets:

| Secret | Description |
|---|---|
| `VM_HOST` | The public IP address of your Azure VM. |
| `VM_USERNAME` | The SSH username (e.g., `azureuser`). |
| `SSH_PRIVATE_KEY` | Your SSH private key (to log into the VM). |
| `TUNNEL_TOKEN` | Your Cloudflare Tunnel Token (from Zero Trust dashboard). |
| `GITHUB_APP_ID` | Your GitHub App ID. |
| `GITHUB_PRIVATE_KEY` | The App's private `.pem` content. |
| `WEBHOOK_SECRET` | Your webhook signing secret. |
| `AI_PROVIDER` | Your chosen LLM provider (e.g., `cerebras`, `groq`). |
| `AI_MODEL` | Your chosen model (e.g., `qwen-3-235b-a22b-instruct-2507`). |
| `<PROVIDER>_API_KEY` | The API key for your chosen provider (e.g., `CEREBRAS_API_KEY`). |
| `LANGFUSE_PUBLIC_KEY` | Your Langfuse public key for observability. |
| `LANGFUSE_SECRET_KEY` | Your Langfuse secret key for observability. |

### 2. How it Works
1. **GitHub Action:** The `Deployment` workflow SSHs into your VM.
2. **Setup Script:** It runs `scripts/setup-vm.sh`, which:
   - Installs Python 3.11+ and `cloudflared`.
   - Creates a **systemd service** for the FastAPI app.
   - Creates a **systemd service** for the Cloudflare Tunnel.
   - Configures `.env` automatically from your repo secrets.
3. **Auto-Start:** The app and tunnel start automatically on boot and restart if they crash.

## 🧪 Testing Your Deployment
Once deployed, you can test the entire flow using the included script:
```bash
python scripts/test-webhook.py https://your-tunnel-url.com your_webhook_secret
```

## 🧪 Running Tests

```bash
pytest tests/ -v
```

## 📄 License
MIT
