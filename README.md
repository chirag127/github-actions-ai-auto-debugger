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

## 📦 Setup

### 1. Requirements
```bash
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### 2. Environment Variables (`.env`)
Create a `.env` file from `.env.example`:
- `GITHUB_APP_ID`: Your GitHub App ID.
- `GITHUB_PRIVATE_KEY`: Your App's private RSA key.
- `WEBHOOK_SECRET`: Your webhook signing secret.
- `NVIDIA_API_KEY`: Your Nvidia NIM API key.
- `LANGFUSE_PUBLIC_KEY`: (Optional) Langfuse public key.
- `LANGFUSE_SECRET_KEY`: (Optional) Langfuse secret key.

### 3. Running Locally
```bash
uvicorn app.main:app --reload
```

### 4. Deployment (Azure VM)
1. Provision a **B1s (Free)** VM with Ubuntu or Windows.
2. Clone this repo and install dependencies.
3. Install `cloudflared` and create a tunnel:
   ```bash
   cloudflared tunnel login
   cloudflared tunnel run <your-tunnel-name>
   ```
4. Point your GitHub App Webhook URL to the tunnel URL.

## 📄 License
MIT
