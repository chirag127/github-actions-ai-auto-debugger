// ============================================
// Nvidia NIM API Integration
// ============================================
// Calls the Nvidia NIM chat completions API
// with a custom exponential backoff retry
// mechanism. Uses native `fetch` only — no
// heavy AI SDKs.
// ============================================

import type { NvidiaResponse } from "./types";

const NVIDIA_API_URL =
  "https://integrate.api.nvidia.com" + "/v1/chat/completions";
const MODEL = "minimax/minimax-2.5";
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

// -------------------------------------------
// Exponential Backoff Retry
// -------------------------------------------

/**
 * Lightweight exponential backoff retry for
 * any fetch call. Retries on 429 (rate limit),
 * 500, 502, 503, 504 (server errors).
 *
 * Delay formula: baseDelay * 2^attempt + jitter
 *
 * @param url - Request URL
 * @param opts - Standard RequestInit options
 * @param maxRetries - Max number of retries
 *   (default 3)
 * @returns The successful Response object
 * @throws Error if all retries are exhausted
 */
export async function fetchWithRetry(
  url: string,
  opts: RequestInit,
  maxRetries = MAX_RETRIES,
): Promise<Response> {
  const retryableStatuses = new Set([429, 500, 502, 503, 504]);

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch(url, opts);

    if (res.ok) {
      return res;
    }

    // Don't retry non-retryable errors
    if (!retryableStatuses.has(res.status)) {
      const body = await res.text();
      throw new Error(`Nvidia API error (${res.status}): ${body}`);
    }

    // Last attempt — throw
    if (attempt === maxRetries) {
      const body = await res.text();
      throw new Error(
        `Nvidia API failed after ${maxRetries + 1} attempts (${res.status}): ${body}`,
      );
    }

    // Exponential backoff with jitter
    const delay = BASE_DELAY_MS * 2 ** attempt + Math.random() * 500;
    console.log(
      `⏳ Nvidia API retry ${attempt + 1}` +
        `/${maxRetries} in ${delay.toFixed(0)}ms`,
    );
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  // TypeScript exhaustiveness — unreachable
  throw new Error("Retry logic error");
}

// -------------------------------------------
// AI Fix Generation
// -------------------------------------------

/**
 * Sends the error logs and broken code to the
 * Nvidia NIM API and returns the AI-corrected
 * file content.
 *
 * @param apiKey - Nvidia API key
 * @param logs - Workflow failure logs
 * @param fileContent - The broken file's content
 * @param filePath - Path of the broken file
 * @returns Raw corrected file content (no
 *   markdown, no explanation)
 */
export async function callNvidiaAPI(
  apiKey: string,
  logs: string,
  fileContent: string,
  filePath: string,
): Promise<string> {
  const systemPrompt = [
    "You are an expert software debugger.",
    "You will receive CI/CD failure logs and",
    "the source code of the file that caused",
    "the failure.",
    "",
    "RULES:",
    "1. Analyze the error logs carefully.",
    "2. Identify the root cause of the failure.",
    "3. Return ONLY the complete, corrected",
    "   file content.",
    "4. Do NOT include markdown code fences.",
    "5. Do NOT include explanations or",
    "   conversational text.",
    "6. Do NOT add comments about what you",
    "   changed.",
    "7. Return the ENTIRE file, not just the",
    "   changed parts.",
    "8. Preserve the original formatting,",
    "   imports, and structure.",
    "9. If you cannot determine the fix,",
    "   return the original file unchanged.",
  ].join("\n");

  const userPrompt = [
    `FILE PATH: ${filePath}`,
    "",
    "=== ERROR LOGS ===",
    logs,
    "",
    "=== SOURCE CODE ===",
    fileContent,
  ].join("\n");

  const body = JSON.stringify({
    model: MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.1,
    max_tokens: 8192,
  });

  const res = await fetchWithRetry(NVIDIA_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body,
  });

  const data = (await res.json()) as NvidiaResponse;

  if (!data.choices || data.choices.length === 0) {
    throw new Error("Nvidia API returned no choices");
  }

  // Strip any accidental markdown fences
  let content = data.choices[0].message.content;
  content = content
    .replace(/^```[\w]*\n?/gm, "")
    .replace(/\n?```$/gm, "")
    .trim();

  return content;
}
