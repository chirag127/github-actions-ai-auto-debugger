// ============================================
// GitHub REST API Interactions
// ============================================
// All GitHub API calls: installation token,
// workflow log retrieval, file content fetching,
// and automated commit creation.
// ============================================

import { unzipSync } from "fflate";
import type { FileInfo, GitHubFileContent } from "./types";

const GITHUB_API = "https://api.github.com";
const MAX_LOG_CHARS = 15_000;

/**
 * Standard headers for GitHub API requests.
 */
function ghHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "github-actions-ai-auto-debugger",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

// -------------------------------------------
// Installation Access Token
// -------------------------------------------

/**
 * Creates an installation access token from a
 * JWT. This token is used for all subsequent
 * API calls scoped to the installation.
 *
 * @param jwt - A signed GitHub App JWT
 * @param installationId - From webhook payload
 * @returns The installation access token string
 */
export async function getInstallationToken(
  jwt: string,
  installationId: number,
): Promise<string> {
  const url =
    `${GITHUB_API}/app/installations/` + `${installationId}/access_tokens`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${jwt}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "github-actions-ai-auto-debugger",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `Failed to get installation token (${res.status}): ${body}`,
    );
  }

  const data = (await res.json()) as {
    token: string;
  };
  return data.token;
}

// -------------------------------------------
// Workflow Log Retrieval
// -------------------------------------------

/**
 * Fetches and extracts workflow run logs.
 * GitHub returns a ZIP archive; we decompress
 * it in-memory using fflate and concatenate
 * all text log entries.
 *
 * @returns Concatenated log text, truncated
 *   to MAX_LOG_CHARS to fit AI context windows.
 */
export async function fetchWorkflowLogs(
  token: string,
  owner: string,
  repo: string,
  runId: number,
): Promise<string> {
  const url =
    `${GITHUB_API}/repos/${owner}/${repo}` + `/actions/runs/${runId}/logs`;

  // GitHub returns a 302 redirect to the ZIP
  const res = await fetch(url, {
    headers: ghHeaders(token),
    redirect: "follow",
  });

  if (!res.ok) {
    throw new Error(
      `Failed to fetch logs (${res.status}): ${await res.text()}`,
    );
  }

  // Decompress the ZIP archive in memory
  const buffer = await res.arrayBuffer();
  const zip = unzipSync(new Uint8Array(buffer));

  // Concatenate all log file contents
  const decoder = new TextDecoder();
  let logs = "";

  for (const [filename, data] of Object.entries(zip)) {
    // Skip non-text files
    if (filename.endsWith("/") || data.length === 0) {
      continue;
    }
    logs += `\n=== ${filename} ===\n`;
    logs += decoder.decode(data);
  }

  // Truncate to prevent exceeding AI context
  if (logs.length > MAX_LOG_CHARS) {
    logs = `${logs.slice(0, MAX_LOG_CHARS)}\n... [TRUNCATED] ...`;
  }

  return logs;
}

// -------------------------------------------
// Error File Path Extraction
// -------------------------------------------

/**
 * Parses log text for file paths referenced
 * in error messages. Looks for common error
 * patterns from TypeScript, ESLint, Jest, etc.
 *
 * Returns deduplicated file paths.
 */
export function extractErrorFilePaths(logs: string): string[] {
  const patterns = [
    // TS/ESLint: src/foo.ts(10,5): error ...
    /(?:^|\s)(src\/[^\s:(]+)/gm,
    // Node: at Object.<anonymous> (/path/file.js:1:2)
    /\(\/[^)]*\/([^\s:)]+\.[jt]sx?)/gm,
    // Generic: Error in file.ts
    /(?:error|fail|Error)\s+.*?(\S+\.[jt]sx?)/gim,
  ];

  const paths = new Set<string>();
  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    // biome-ignore lint: reassignment needed
    while ((match = pattern.exec(logs)) !== null) {
      const filePath = match[1];
      // Skip node_modules and test files
      if (
        !filePath.includes("node_modules") &&
        !filePath.includes(".test.") &&
        !filePath.includes(".spec.")
      ) {
        paths.add(filePath);
      }
    }
  }

  return [...paths].slice(0, 5);
}

// -------------------------------------------
// File Content Retrieval
// -------------------------------------------

/**
 * Fetches the content and SHA of a file from
 * a specific branch/ref in the repository.
 */
export async function fetchFileContent(
  token: string,
  owner: string,
  repo: string,
  path: string,
  ref: string,
): Promise<FileInfo | null> {
  const url =
    `${GITHUB_API}/repos/${owner}/${repo}` + `/contents/${path}?ref=${ref}`;

  const res = await fetch(url, {
    headers: ghHeaders(token),
  });

  if (!res.ok) {
    console.warn(`Could not fetch file ${path}: ` + `${res.status}`);
    return null;
  }

  const data = (await res.json()) as GitHubFileContent;

  // GitHub returns base64-encoded content
  const content = atob(data.content.replace(/\n/g, ""));

  return { path: data.path, content, sha: data.sha };
}

// -------------------------------------------
// Automated Commit
// -------------------------------------------

/**
 * Commits the AI-fixed file content directly
 * to the broken branch using the GitHub
 * Contents API.
 *
 * @param fileSha - Current SHA of the file
 *   (required for updates)
 * @param newContent - The corrected file content
 *   from the AI
 */
export async function commitFix(
  token: string,
  owner: string,
  repo: string,
  branch: string,
  path: string,
  newContent: string,
  fileSha: string,
): Promise<void> {
  const url = `${GITHUB_API}/repos/${owner}/${repo}` + `/contents/${path}`;

  // Encode content to base64
  const encoded = btoa(unescape(encodeURIComponent(newContent)));

  const body = JSON.stringify({
    message: `fix: AI auto-fix for workflow failure\n\nAutomated fix generated by github-actions-ai-auto-debugger.\nFile: ${path}`,
    content: encoded,
    sha: fileSha,
    branch,
  });

  const res = await fetch(url, {
    method: "PUT",
    headers: {
      ...ghHeaders(token),
      "Content-Type": "application/json",
    },
    body,
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Failed to commit fix (${res.status}): ${errBody}`);
  }

  console.log(`✅ Committed fix for ${path} on ${branch}`);
}
