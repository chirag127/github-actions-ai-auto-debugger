#!/bin/bash
set -e

# ============================================
# GitHub Actions AI Auto-Debugger
# VM Automation & Service Setup Script
# ============================================

echo "🤖 Starting Automation Script..."

# 1. Update and install dependencies
sudo apt-get update -y
sudo apt-get install -y python3 python3-pip python3-venv curl wget

# 2. Setup Python environment
if [ ! -d "venv" ]; then
    python3 -m venv venv
fi
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

# 3. Create .env file from environment variables passed by GitHub Actions
# (These are injected during the SSH deployment step)
cat <<EOF > .env
WEBHOOK_SECRET="${WEBHOOK_SECRET}"
GITHUB_APP_ID="${GITHUB_APP_ID}"
GITHUB_PRIVATE_KEY="${GITHUB_PRIVATE_KEY}"
NVIDIA_API_KEY="${NVIDIA_API_KEY}"
EOF

# 4. Install Cloudflare Tunnel (cloudflared)
if [ ! -f "/usr/local/bin/cloudflared" ]; then
    echo "☁️ Installing Cloudflare Tunnel..."
    curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
    sudo dpkg -i cloudflared.deb
    rm cloudflared.deb
fi

# 5. Setup AI Auto-Debugger Systemd Service
echo "⚙️ Creating AI Auto-Debugger Service..."
sudo tee /etc/systemd/system/ai-debugger.service > /dev/null <<EOF
[Unit]
Description=GitHub Actions AI Auto-Debugger
After=network.target

[Service]
User=$(whoami)
WorkingDirectory=$(pwd)
ExecStart=$(pwd)/venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=10
EnvironmentFile=$(pwd)/.env

[Install]
WantedBy=multi-user.target
EOF

# 6. Setup Cloudflare Tunnel Systemd Service (if token is provided)
if [ ! -z "$TUNNEL_TOKEN" ]; then
    echo "☁️ Setting up Cloudflare Tunnel Service..."
    sudo cloudflared service install "$TUNNEL_TOKEN" || true
    sudo systemctl enable cloudflared
    sudo systemctl start cloudflared
fi

# 7. Enable and restart the debugger service
sudo systemctl daemon-reload
sudo systemctl enable ai-debugger
sudo systemctl restart ai-debugger

echo "✅ AUTOMATION COMPLETE!"
echo "🚀 The AI Auto-Debugger is now running as a background service."
echo "🔗 Check your Cloudflare Dashboard for the tunnel URL."
