// ============================================
// GitHub Actions AI Auto-Debugger
// Cloudflare Worker — Type Definitions
// ============================================

/**
 * Cloudflare Worker environment bindings.
 *
 * Configure these secrets before deploying:
 *   npx wrangler secret put WEBHOOK_SECRET
 *   npx wrangler secret put GITHUB_APP_ID
 *   npx wrangler secret put GITHUB_PRIVATE_KEY
 *   npx wrangler secret put NVIDIA_API_KEY
 */
export interface Env {
  /** Secret token for GitHub webhook signature
   *  verification. Set in your GitHub App config
   *  under "Webhook secret". */
  WEBHOOK_SECRET: string;

  /** Numeric App ID from your GitHub App's
   *  "General" settings page. */
  GITHUB_APP_ID: string;

  /** PEM-encoded private key downloaded from
   *  your GitHub App. Can be PKCS#1 or PKCS#8. */
  GITHUB_PRIVATE_KEY: string;

  /** API key from Nvidia's developer portal
   *  (build.nvidia.com). */
  NVIDIA_API_KEY: string;
}

// -------------------------------------------
// GitHub Webhook Payload Types
// -------------------------------------------

export interface Sender {
  login: string;
  type: string;
}

export interface Repository {
  full_name: string;
  name: string;
  owner: { login: string };
}

export interface HeadCommit {
  id: string;
  message: string;
  author: { name: string; email: string };
}

export interface Installation {
  id: number;
}

export interface WorkflowRun {
  id: number;
  name: string;
  conclusion: string | null;
  head_branch: string;
  head_sha: string;
  head_commit: HeadCommit | null;
  html_url: string;
}

export interface WorkflowRunPayload {
  action: string;
  workflow_run: WorkflowRun;
  repository: Repository;
  sender: Sender;
  installation?: Installation;
}

// -------------------------------------------
// Nvidia NIM API Types
// -------------------------------------------

export interface NvidiaMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface NvidiaChoice {
  message: { content: string };
  finish_reason: string;
}

export interface NvidiaResponse {
  choices: NvidiaChoice[];
}

// -------------------------------------------
// GitHub Content API Types
// -------------------------------------------

export interface GitHubFileContent {
  path: string;
  sha: string;
  content: string;
  encoding: string;
}

export interface FileInfo {
  path: string;
  content: string;
  sha: string;
}
