# GitHub Actions AI Auto-Debugger

A Python-based GitHub App backend that automatically fixes failed workflows using LangGraph and Nvidia NIM.

## 🚀 Features
- **Stateless & Lightweight:** Runs perfectly on a free Azure B1s VM (1GB RAM).
- **LangGraph Driven:** Modular state machine for robust debugging logic.
- **Multi-Model Support:** Uses Nvidia NIM for high-performance LLM inference.
- **Secure:** HMAC webhook verification and JWT-based GitHub App authentication.

## 🛠️ Tech Stack
- **Python 3.11+**
- **FastAPI** (Web server)
- **LangGraph** (Agent orchestration)
- **Nvidia NIM** (LLM provider)
- **Langfuse** (Observability)
- **Cloudflare Tunnels** (Public exposure)

## 🤖 Fully Automated Deployment (Azure VM)

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
| `NVIDIA_API_KEY` | Your Nvidia NIM API key. |

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

## 📄 License
MIT
