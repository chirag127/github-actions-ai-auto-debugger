// ============================================
// GitHub Actions AI Auto-Debugger
// Cloudflare Worker — Main Entry Point
// ============================================
//
// This is the primary request handler for the
// Cloudflare Worker. It orchestrates:
//   1. Webhook signature verification
//   2. Event filtering (workflow_run failures)
//   3. Bot/loop detection
//   4. GitHub App authentication (JWT → token)
//   5. Workflow log retrieval
//   6. Broken file identification & fetching
//   7. AI-powered fix generation (Nvidia NIM)
//   8. Automated commit to the broken branch
//
// SETUP:
//   1. Create a GitHub App with webhook events:
//      - Workflow runs (read)
//      - Contents (read + write)
//      - Metadata (read)
//   2. Set the webhook URL to your Worker URL
//   3. Configure secrets:
//      npx wrangler secret put WEBHOOK_SECRET
//      npx wrangler secret put GITHUB_APP_ID
//      npx wrangler secret put GITHUB_PRIVATE_KEY
//      npx wrangler secret put NVIDIA_API_KEY
//   4. Deploy: npx wrangler deploy
// ============================================

import { isBotSender } from "./bot-detection";
import {
  commitFix,
  extractErrorFilePaths,
  fetchFileContent,
  fetchWorkflowLogs,
  getInstallationToken,
} from "./github";
import { generateJWT } from "./jwt";
import { callNvidiaAPI } from "./nvidia";
import type { Env, WorkflowRunPayload } from "./types";
import { verifyWebhookSignature } from "./verify";

/**
 * Creates a JSON Response with the given status
 * code and message.
 */
function jsonResponse(message: string, status = 200): Response {
  return new Response(JSON.stringify({ message }), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

/**
 * Main webhook handler — processes GitHub
 * workflow_run failure events end-to-end.
 */
async function handleWebhook(request: Request, env: Env): Promise<Response> {
  // ------ Step 1: Method Check ------
  if (request.method !== "POST") {
    return jsonResponse("Method Not Allowed", 405);
  }

  // ------ Step 2: Read Raw Body ------
  // We must read the raw body BEFORE parsing
  // JSON to ensure signature verification
  // works with the exact bytes GitHub sent.
  const rawBody = await request.text();

  // --- Step 3: Webhook Signature Verify ---
  const signature = request.headers.get("X-Hub-Signature-256");
  if (!signature) {
    console.error("❌ Missing signature header");
    return jsonResponse("Missing signature", 401);
  }

  const isValid = await verifyWebhookSignature(
    env.WEBHOOK_SECRET,
    rawBody,
    signature,
  );
  if (!isValid) {
    console.error("❌ Invalid webhook signature");
    return jsonResponse("Invalid signature", 401);
  }

  // ------ Step 4: Event Filtering ------
  const event = request.headers.get("X-GitHub-Event");
  if (event !== "workflow_run") {
    console.log(`ℹ️ Ignoring event: ${event}`);
    return jsonResponse("Event ignored");
  }

  const payload = JSON.parse(rawBody) as WorkflowRunPayload;
  const { action, workflow_run: run } = payload;

  // Only process completed, failed runs
  if (action !== "completed" || run.conclusion !== "failure") {
    console.log(
      `ℹ️ Ignoring: action=${action}, ` + `conclusion=${run.conclusion}`,
    );
    return jsonResponse("Not a failure event");
  }

  // --- Step 5: Infinite Loop Protection ---
  const senderLogin = payload.sender.login;
  if (isBotSender(senderLogin)) {
    console.log(`🤖 Skipping bot-triggered run: ` + `${senderLogin}`);
    return jsonResponse("Bot sender — skipped");
  }

  // Also check the commit author if available
  const commitAuthor = run.head_commit?.author?.name ?? "";
  if (isBotSender(commitAuthor)) {
    console.log(`🤖 Skipping bot commit author: ` + `${commitAuthor}`);
    return jsonResponse("Bot commit author — skipped");
  }

  // ------ Step 6: Validate Installation ------
  if (!payload.installation?.id) {
    console.error("❌ No installation ID in payload");
    return jsonResponse("Missing installation ID", 400);
  }

  const { owner, repo, branch, runId } = {
    owner: payload.repository.owner.login,
    repo: payload.repository.name,
    branch: run.head_branch,
    runId: run.id,
  };

  console.log(
    `🔧 Processing failed run #${runId} on ` + `${owner}/${repo}@${branch}`,
  );

  // --- Step 7: GitHub App Authentication ---
  const jwt = await generateJWT(env.GITHUB_APP_ID, env.GITHUB_PRIVATE_KEY);
  const token = await getInstallationToken(jwt, payload.installation.id);

  // ------ Step 8: Fetch Logs ------
  const logs = await fetchWorkflowLogs(token, owner, repo, runId);
  console.log(`📋 Retrieved ${logs.length} chars of logs`);

  // --- Step 9: Identify Broken Files ---
  const errorPaths = extractErrorFilePaths(logs);
  if (errorPaths.length === 0) {
    console.warn("⚠️ Could not identify error file paths");
    return jsonResponse("No error files identified");
  }
  console.log(`📂 Found error files: ` + errorPaths.join(", "));

  // --- Step 10: Fetch & Fix Each File ---
  for (const filePath of errorPaths) {
    const fileInfo = await fetchFileContent(
      token,
      owner,
      repo,
      filePath,
      run.head_sha,
    );

    if (!fileInfo) {
      console.warn(`⚠️ Skipping ${filePath} (not found)`);
      continue;
    }

    console.log(`🤖 Requesting AI fix for ${filePath}`);

    // --- Step 11: Get AI Fix ---
    const fixedContent = await callNvidiaAPI(
      env.NVIDIA_API_KEY,
      logs,
      fileInfo.content,
      filePath,
    );

    // Skip if AI returned identical content
    if (fixedContent === fileInfo.content) {
      console.log(`ℹ️ AI returned unchanged ` + `content for ${filePath}`);
      continue;
    }

    // --- Step 12: Commit the Fix ---
    await commitFix(
      token,
      owner,
      repo,
      branch,
      filePath,
      fixedContent,
      fileInfo.sha,
    );
  }

  return jsonResponse("Fix committed ✅");
}

// ============================================
// Cloudflare Worker Export
// ============================================

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      return await handleWebhook(request, env);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      console.error(`💥 Unhandled error: ${msg}`);
      return jsonResponse(`Internal Server Error: ${msg}`, 500);
    }
  },
};
