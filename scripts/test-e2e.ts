import { subtle } from "node:crypto";

const WEBHOOK_SECRET =
  "We will update this after deploying our Cloudflare Worker";
const WORKER_URL =
  "https://github-actions-ai-auto-debugger.whyiswhen.workers.dev";

async function runTest() {
  console.log("🚀 Testing the deployed AI Auto-Debugger Worker...\n");

  const payload = {
    action: "completed",
    workflow_run: {
      id: 999999999,
      name: "CI/CD Test",
      conclusion: "failure",
      head_branch: "main",
      head_sha: "mock_sha_12345",
      head_commit: {
        id: "mock_sha_12345",
        message: "Introduce bug",
        author: { name: "chirag127", email: "hi@chirag127.in" },
      },
      html_url: "https://github.com/chirag127/apis/actions/runs/999999999",
    },
    repository: {
      full_name: "chirag127/apis",
      name: "apis",
      owner: { login: "chirag127" },
    },
    sender: {
      login: "chirag127",
      type: "User",
    },
    installation: {
      id: 1234567, // Mock installation ID
    },
  };

  const body = JSON.stringify(payload);

  // Generate HMAC-SHA256 signature
  const encoder = new TextEncoder();
  const key = await subtle.importKey(
    "raw",
    encoder.encode(WEBHOOK_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signatureBuffer = await subtle.sign("HMAC", key, encoder.encode(body));
  const hex = Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const signature = `sha256=${hex}`;

  console.log("📤 Sending mock workflow_run failure payload...");
  console.log(`🔑 Signature: ${signature}\n`);

  try {
    const res = await fetch(WORKER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-GitHub-Event": "workflow_run",
        "X-Hub-Signature-256": signature,
      },
      body,
    });

    const text = await res.text();
    console.log(`📥 Response Status: ${res.status} ${res.statusText}`);
    console.log(`📄 Response Body: ${text}\n`);

    if (
      res.status === 500 &&
      text.includes("Failed to get installation token")
    ) {
      console.log("✅ TEST SUCCESSFUL!");
      console.log(
        "The Worker successfully validated the Webhook Signature and tried to authenticate to GitHub.",
      );
      console.log(
        "It threw a 500 only because the mock installation ID (1234567) does not exist.",
      );
    } else {
      console.log("⚠️ Unexpected outcome. Check logs.");
    }
  } catch (error) {
    console.error("💥 Error connecting to Worker:", error);
  }
}

runTest();
