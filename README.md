# GitHub Actions AI Auto-Debugger

A Cloudflare Worker that automatically fixes failed GitHub Actions workflows using multi-provider LLM support.

## Architecture

```
GitHub Webhook → CF Worker (webhook handler) → CF Queue → CF Worker (queue consumer) → LLM Provider → GitHub API
```

- **Webhook handler** — verifies HMAC signature, filters events, returns `202 Accepted`, enqueues to CF Queue
- **Queue consumer** — runs the AI debug pipeline with unlimited CPU time (up to 15 min wall time)
- **Zero hosting cost** — CF Workers Free plan: 100k requests/day, 10M queue operations/month

## Features

- **Multi-Provider LLM:** Choose from 9 providers (Cerebras, Groq, NVIDIA, Google Gemini, Mistral, Cohere, HuggingFace, OpenRouter, GitHub Models)
- **Queue-Based Processing:** Webhook returns instantly; AI pipeline runs in background
- **Secure:** HMAC-SHA256 webhook verification, JWT-based GitHub App authentication
- **Zero Cold Start:** V8 isolates, no container boot time
- **Free Hosting:** Cloudflare Workers Free plan

## Quick Start

### 1. Prerequisites

- Node.js 22+
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) (`npm install -g wrangler`)
- A [Cloudflare account](https://dash.cloudflare.com/sign-up)
- A [GitHub App](https://docs.github.com/en/apps/creating-github-apps) with `actions:read` and `contents:write` permissions

### 2. Install

```bash
npm install
```

### 3. Create CF Queues

```bash
wrangler queues create ai-auto-debugger-queue
wrangler queues create ai-debugger-dlq
```

### 4. Configure Secrets

```bash
wrangler secret put WEBHOOK_SECRET
wrangler secret put GITHUB_APP_ID
wrangler secret put GITHUB_PRIVATE_KEY
wrangler secret put AI_PROVIDER
wrangler secret put AI_MODEL
wrangler secret put CEREBRAS_API_KEY   # or whichever provider you use
wrangler secret put LANGFUSE_PUBLIC_KEY
wrangler secret put LANGFUSE_SECRET_KEY
wrangler secret put LANGFUSE_BASE_URL
```

### 5. Deploy

```bash
npm run deploy
```

The Worker will be available at `https://ai-auto-debugger.<subdomain>.workers.dev`.

### 6. Update GitHub App

Set your GitHub App's webhook URL to:
```
https://ai-auto-debugger.<subdomain>.workers.dev/webhook
```

## LLM Providers

| Provider | Env Key | Default Model |
|----------|---------|---------------|
| Cerebras | `CEREBRAS_API_KEY` | `qwen-3-235b-a22b-instruct-2507` |
| Groq | `GROQ_API_KEY` | `llama-3.3-70b-versatile` |
| Mistral | `MISTRAL_API_KEY` | `mistral-large-latest` |
| Google Gemini | `GOOGLE_API_KEY` | `gemini-2.0-flash` |
| NVIDIA | `NVIDIA_API_KEY` | `meta/llama-3.1-8b-instruct` |
| Cohere | `COHERE_API_KEY` | `command-r-plus` |
| HuggingFace | `HUGGINGFACE_API_KEY` | `Qwen/Qwen2.5-Coder-32B-Instruct` |
| OpenRouter | `OPENROUTER_API_KEY` | `meta-llama/llama-3-70b-instruct` |
| GitHub Models | `GITHUB_MODELS_TOKEN` | `gpt-4o` |

## Development

```bash
# Run locally
npm run dev

# Run tests
npm test

# Lint
npm run lint

# Format
npm run format
```

## Testing Your Deployment

```bash
python scripts/test-webhook.py https://ai-auto-debugger.<subdomain>.workers.dev/webhook <your_webhook_secret>
```

## CF Workers Free Plan Limits

| Resource | Free Plan |
|----------|-----------|
| HTTP requests | 100,000/day |
| Queue operations | 10,000,000/month |
| HTTP handler CPU | 10ms |
| Queue consumer CPU | Unlimited |
| Queue consumer wall time | 15 minutes |

## License

MIT

