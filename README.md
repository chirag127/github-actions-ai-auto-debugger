<div align="center">
  <h1>🤖 GitHub Actions AI Auto-Debugger</h1>
  <p><strong>A Deploy-it-Yourself Cloudflare Worker template that automatically fixes failed GitHub Actions workflows using Nvidia NIM (MiniMax-2.5).</strong></p>

  [![CI](https://github.com/chirag127/github-actions-ai-auto-debugger/actions/workflows/ci.yml/badge.svg)](https://github.com/chirag127/github-actions-ai-auto-debugger/actions/workflows/ci.yml)
</div>

---

## 🌟 Overview

When a GitHub Actions workflow fails, developers usually have to dig through logs, find the broken file, figure out the fix, and push a new commit.

This **Deploy-it-Yourself GitHub App receiver** automates the entire process:
1. Receives `workflow_run` failure webhooks from your repositories.
2. Authenticates seamlessly as a GitHub App using an Installation Token.
3. Downloads & extracts the workflow failure logs (ZIP).
4. Identifies the broken source files.
5. Sends the logs and broken code to **Nvidia NIM (minimax-2.5)** for a pure-code fix.
6. Automatically commits the fixed code back to your broken branch!

### Architecture
- **Environment**: Cloudflare Workers (TypeScript)
- **AI Model**: Nvidia NIM `minimax/minimax-2.5` via native `fetch` with exponential backoff.
- **Security**: Web Crypto API for GitHub webhook HMAC-SHA256 signature verification and RS256 JWT generation (PKCS#1 auto-converted to PKCS#8).
- **Zero Heavy Dependencies**: No LangChain, no databases, no KV storage. Fully stateless.

---

## 🚀 Quick Setup Guide

### 1. Clone & Install
```bash
git clone https://github.com/chirag127/github-actions-ai-auto-debugger.git
cd github-actions-ai-auto-debugger
npm install
```

### 2. Create the GitHub App
1. Go to your GitHub account/organization Settings → Developer settings → GitHub Apps → **New GitHub App**.
2. **Name**: AI Auto-Debugger (or whatever you prefer)
3. **Webhook URL**: *(We will update this after deploying our Cloudflare Worker)*
4. **Webhook Secret**: Generate a random secure string (save this for later).
5. **Permissions**:
   - **Actions**: Read-only
   - **Contents**: Read & write
6. **Subscribe to events**: Check `Workflow run`.
7. Click **Create GitHub App**.
8. On the general page, note down your **App ID**.
9. Scroll down and click **Generate a private key**. A `.pem` file will download to your computer.

### 3. Install the App
1. On your GitHub App's "Install App" page, install it on the repositories you want the AI to debug.

### 4. Configure Cloudflare Secrets
You need to provide your secrets to Cloudflare securely using Wrangler.

```bash
# Provide the random Webhook Secret string you created in Step 2:
npx wrangler secret put WEBHOOK_SECRET

# Provide the App ID from Step 2:
npx wrangler secret put GITHUB_APP_ID

# Provide the contents of the downloaded .pem file from Step 2:
# (Copy the ENTIRE file, including BEGIN and END lines)
npx wrangler secret put GITHUB_PRIVATE_KEY

# Provide your Nvidia NIM API key (from build.nvidia.com):
npx wrangler secret put NVIDIA_API_KEY
```

### 5. Deploy to Cloudflare
```bash
npm run deploy
```
*Note the Cloudflare Worker URL printed in your terminal (e.g., `https://github-actions-ai-auto-debugger.chirag127.workers.dev`).*

### 6. Link the Webhook
1. Go back to your GitHub App settings.
2. Under "General", set the **Webhook URL** to your newly deployed Cloudflare Worker URL.
3. Save changes.

---

## 🧪 Testing it Out

1. In an installed repository, intentionally break a build (e.g., introduce a TypeScript type error).
2. Push the commit.
3. Watch the GitHub Actions run fail.
4. Give it a few seconds...
5. Refresh the branch! You should see a brand new commit from your bot: `fix: AI auto-fix for workflow failure` resolving the issue.

---

## 💻 Local Development

Ensure you have a `.env` file in the root directory that contains your GitHub App Secrets and Cloudflare configuration variables before starting local development.

**Required keys for your `.env` file:**
- `WEBHOOK_SECRET`
- `GITHUB_APP_ID`
- `GITHUB_PRIVATE_KEY`
- `NVIDIA_API_KEY`
- `ENABLE_CLOUDFLARE`
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`

Run the local development server (uses `dotenv-cli` to inject `.env`):
```bash
npm run dev
```

Run tests explicitly:
```bash
npm run test
```

---

## 🛡️ Protections Built-In

- **Infinite Loop Protection**: Intelligently ignores any failures triggered by commits made by bot accounts (`[bot]`, `github-actions`, etc.) to prevent recursive debugging loops.
- **Context Window Management**: Workflow ZIP logs can be massive. This Worker selectively extracts text logs and intelligently truncates them to 15,000 characters to ensure it never overloads the AI token limits.
- **Resiliency**: Built-in exponential backoff with jitter natively in TypeScript if the Nvidia API rate-limits or throws server errors.

---

## 📄 License
MIT License
