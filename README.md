<div align="center">
  <h1>🤖 GitHub Actions AI Auto-Debugger</h1>
  <p><strong>A Deploy-it-Yourself Cloudflare Worker that
  automatically fixes failed GitHub Actions workflows
  using Nvidia NIM AI.</strong></p>

  [![CI](https://github.com/chirag127/github-actions-ai-auto-debugger/actions/workflows/ci.yml/badge.svg)](https://github.com/chirag127/github-actions-ai-auto-debugger/actions/workflows/ci.yml)
</div>

---

## 🌟 Overview

When a GitHub Actions workflow fails, developers
usually dig through logs, find the broken file,
figure out the fix, and push a new commit.

This **Deploy-it-Yourself GitHub App receiver**
automates the entire process:

1. Receives `workflow_run` failure webhooks.
2. Authenticates as a GitHub App (JWT → token).
3. Downloads & extracts workflow failure logs.
4. Identifies the broken source files.
5. Sends logs + code to **Nvidia NIM** for a fix.
6. Commits the fixed code back to your branch!

### Architecture

- **Runtime**: Cloudflare Workers (TypeScript)
- **AI Model**: Nvidia NIM `minimaxai/minimax-m2.5`
  with automatic fallback to `z-ai/glm5` and
  `moonshotai/kimi-k2.5`.
- **Security**: Web Crypto API for HMAC-SHA256
  signature verification and RS256 JWT generation.
- **Zero Heavy Dependencies**: No LangChain,
  no databases, no KV storage. Fully stateless.

---

## 🚀 Quick Setup Guide

### 1. Clone & Install

```bash
git clone \
  https://github.com/chirag127/github-actions-ai-auto-debugger.git
cd github-actions-ai-auto-debugger
npm install
```

### 2. Create the GitHub App

1. Go to **Settings → Developer settings →
   GitHub Apps → New GitHub App**.
2. **Name**: AI Auto-Debugger (or your choice).
3. **Webhook URL**: Update after deploying.
4. **Webhook Secret**: Generate a random string.
5. **Permissions**:
   - **Actions**: Read-only
   - **Contents**: Read & write
6. **Subscribe to events**: Check `Workflow run`.
7. Click **Create GitHub App**.
8. Note your **App ID**.
9. Click **Generate a private key** (downloads
   a `.pem` file).

### 3. Install the App

On your GitHub App's "Install App" page, install
it on the repositories you want the AI to debug.

### 4. Configure Cloudflare Secrets

```bash
npx wrangler secret put WEBHOOK_SECRET
npx wrangler secret put GITHUB_APP_ID
npx wrangler secret put GITHUB_PRIVATE_KEY
npx wrangler secret put NVIDIA_API_KEY
```

### 5. Deploy to Cloudflare

```bash
npm run deploy
```

Note the Worker URL printed in your terminal.

### 6. Link the Webhook

1. Go back to your GitHub App settings.
2. Set the **Webhook URL** to your Worker URL.
3. Save changes.

---

## 🧪 Testing

### Unit Tests

Run the full test suite locally:

```bash
npm run test
```

### E2E Tests

Run the end-to-end tests that verify the full
webhook → auth → fix → commit flow:

```bash
npm run test:e2e
```

### Manual E2E Test (against deployed Worker)

Use the included script to send a mock webhook
payload to your deployed Worker:

```bash
npx tsx scripts/test-e2e.ts
```

This sends a signed `workflow_run` failure event.
A `500` about "Failed to get installation token"
means the Worker correctly validated the signature
and attempted GitHub authentication (expected with
a mock installation ID).

### AI Integration Test

Test the Nvidia NIM AI directly with a mock bug:

```bash
npx tsx scripts/test-ai.ts
```

---

## 💻 Local Development

Create a `.env` file in the project root:

```env
WEBHOOK_SECRET=your_webhook_secret
GITHUB_APP_ID=your_app_id
GITHUB_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----
...your key here...
-----END RSA PRIVATE KEY-----"
NVIDIA_API_KEY=nvapi-your-key-here
CLOUDFLARE_ACCOUNT_ID=your_account_id
CLOUDFLARE_API_TOKEN=your_api_token
```

> ⚠️ **NEVER commit `.env` to version control.**
> It is already in `.gitignore`.

Run the local dev server:

```bash
npm run dev
```

Lint and format:

```bash
npm run lint
npm run lint:fix
npm run format
```

Type check:

```bash
npm run typecheck
```

---

## 🛡️ Protections Built-In

- **Infinite Loop Protection**: Ignores failures
  triggered by bot accounts (`[bot]`,
  `github-actions`, `dependabot`, `renovate`).
- **Context Window Management**: Logs truncated
  to 15,000 characters to fit AI context windows.
- **Resiliency**: Exponential backoff with jitter
  for Nvidia API rate limits and server errors.
- **Multi-Model Fallback**: Automatically tries
  alternate AI models if the primary one fails.

---

## 🔧 Debugging Guide

If the bot doesn't fix a failing workflow, follow
these steps to diagnose the issue:

### Step 1: Check GitHub App Webhook Deliveries

1. Go to **Settings → Developer settings →
   GitHub Apps → Your App → Advanced**.
2. Look at **Recent Deliveries**.
3. Check the **Response** tab for each delivery.
   - `200` = Worker processed successfully.
   - `401` = Signature mismatch. Verify your
     `WEBHOOK_SECRET` matches in both GitHub
     App settings and Cloudflare Worker secrets.
   - `500` = Worker error. Check the response
     body for the error message.

### Step 2: Check Cloudflare Worker Logs

```bash
npx wrangler tail
```

This streams real-time logs from the deployed
Worker. Look for `❌` or `💥` error prefixes.

### Step 3: Verify Secrets Are Set

```bash
npx wrangler secret list
```

Ensure all 4 secrets are listed:
- `WEBHOOK_SECRET`
- `GITHUB_APP_ID`
- `GITHUB_PRIVATE_KEY`
- `NVIDIA_API_KEY`

### Step 4: Verify GitHub App Permissions

Your GitHub App needs:
- **Actions**: Read-only (to download logs)
- **Contents**: Read & write (to commit fixes)
- **Metadata**: Read (automatic)

### Step 5: Check the Private Key Format

The `GITHUB_PRIVATE_KEY` must be the full PEM
including `-----BEGIN RSA PRIVATE KEY-----` and
`-----END RSA PRIVATE KEY-----` lines.

If stored with `\n` escapes, ensure they are
actual newlines when set via `wrangler secret`.

### Step 6: Verify Nvidia NIM API Key

Test your API key directly:

```bash
curl -s https://integrate.api.nvidia.com/v1/models \
  -H "Authorization: Bearer YOUR_NVIDIA_API_KEY" \
  | head -c 200
```

If you get a `401`, your key is invalid or
expired. Get a new one from
[build.nvidia.com](https://build.nvidia.com).

### Step 7: Test Locally

```bash
npm run dev
```

Then send a test webhook from another terminal:

```bash
npx tsx scripts/test-e2e.ts
```

(Update `WORKER_URL` in the script to
`http://localhost:8787` for local testing.)

### Step 8: Check CI Pipeline

If the GitHub Actions CI fails:

1. Check the **Actions** tab on GitHub.
2. Click the failed run.
3. Common failures:
   - **Lint errors**: Run `npm run lint:fix`.
   - **Type errors**: Run `npm run typecheck`.
   - **Test failures**: Run `npm run test`.
   - **Deploy fails**: Ensure
     `CLOUDFLARE_API_TOKEN` and
     `CLOUDFLARE_ACCOUNT_ID` are set as
     GitHub repository secrets.

### Step 9: Common Error Messages

| Error | Cause | Fix |
|---|---|---|
| `Missing signature` | No `X-Hub-Signature-256` header | Ensure webhook secret is configured in GitHub App |
| `Invalid signature` | Secret mismatch | Re-set `WEBHOOK_SECRET` in both GitHub and Cloudflare |
| `Missing installation ID` | App not installed on repo | Install the GitHub App on the target repo |
| `Failed to get installation token` | Bad JWT or key | Re-upload the private key via `wrangler secret put` |
| `Nvidia API error (401)` | Invalid API key | Get a new key from build.nvidia.com |
| `No error files identified` | Logs didn't contain recognizable file paths | The AI couldn't parse the error — check log format |

---

## 📄 License

MIT License
