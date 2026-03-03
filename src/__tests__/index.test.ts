// ============================================
// Unit Tests — GitHub Actions AI Auto-Debugger
// ============================================

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { isBotSender } from "../bot-detection";
import { extractErrorFilePaths } from "../github";
import { fetchWithRetry } from "../nvidia";
import { verifyWebhookSignature } from "../verify";

// -------------------------------------------
// Bot Detection Tests
// -------------------------------------------

describe("isBotSender", () => {
  it("detects [bot] suffix", () => {
    expect(isBotSender("my-app[bot]")).toBe(true);
  });

  it("detects github-actions", () => {
    expect(isBotSender("github-actions")).toBe(true);
  });

  it("detects dependabot", () => {
    expect(isBotSender("dependabot")).toBe(true);
  });

  it("detects renovate", () => {
    expect(isBotSender("renovate")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(isBotSender("GitHub-Actions")).toBe(true);
    expect(isBotSender("Dependabot")).toBe(true);
  });

  it("returns false for real users", () => {
    expect(isBotSender("chirag127")).toBe(false);
    expect(isBotSender("octocat")).toBe(false);
    expect(isBotSender("alice")).toBe(false);
  });

  it("returns false for partial matches", () => {
    expect(isBotSender("notabot")).toBe(false);
    expect(isBotSender("bot-user")).toBe(false);
  });
});

// -------------------------------------------
// Error File Path Extraction Tests
// -------------------------------------------

describe("extractErrorFilePaths", () => {
  it("extracts TS error paths", () => {
    const logs = [
      "src/index.ts(10,5): error TS2345",
      "src/utils.ts(3,1): error TS1005",
    ].join("\n");

    const paths = extractErrorFilePaths(logs);
    expect(paths).toContain("src/index.ts");
    expect(paths).toContain("src/utils.ts");
  });

  it("skips node_modules paths", () => {
    const logs = "node_modules/foo/index.ts: error";
    const paths = extractErrorFilePaths(logs);
    expect(paths).not.toContain("node_modules/foo/index.ts");
  });

  it("skips test files", () => {
    const logs = "src/index.test.ts(5,1): error TS2322";
    const paths = extractErrorFilePaths(logs);
    expect(paths).not.toContain("src/index.test.ts");
  });

  it("deduplicates paths", () => {
    const logs = [
      "src/app.ts(1,1): error TS1",
      "src/app.ts(5,1): error TS2",
    ].join("\n");

    const paths = extractErrorFilePaths(logs);
    const count = paths.filter((p) => p === "src/app.ts").length;
    expect(count).toBe(1);
  });

  it("limits to 5 files max", () => {
    const logs = Array.from(
      { length: 10 },
      (_, i) => `src/file${i}.ts(1,1): error TS0`,
    ).join("\n");

    const paths = extractErrorFilePaths(logs);
    expect(paths.length).toBeLessThanOrEqual(5);
  });

  it("returns empty for no matches", () => {
    const logs = "Build succeeded!";
    const paths = extractErrorFilePaths(logs);
    expect(paths).toHaveLength(0);
  });
});

// -------------------------------------------
// Webhook Signature Verification Tests
// -------------------------------------------

describe("verifyWebhookSignature", () => {
  it("rejects missing sha256= prefix", async () => {
    const result = await verifyWebhookSignature(
      "secret",
      "body",
      "invalid-signature",
    );
    expect(result).toBe(false);
  });

  it("validates correct signature", async () => {
    const secret = "test-secret";
    const body = '{"test": true}';

    // Compute expected HMAC-SHA256
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
    const hex = Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const result = await verifyWebhookSignature(secret, body, `sha256=${hex}`);
    expect(result).toBe(true);
  });

  it("rejects invalid signature", async () => {
    const result = await verifyWebhookSignature(
      "secret",
      "body",
      "sha256=0000000000000000000000000000000000000000000000000000000000000000",
    );
    expect(result).toBe(false);
  });
});

// -------------------------------------------
// Retry Logic Tests
// -------------------------------------------

describe("fetchWithRetry", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns on first success", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(
        new Response("ok", { status: 200 }),
      ) as unknown as typeof fetch;

    const res = await fetchWithRetry("https://example.com", {}, 3);
    expect(res.status).toBe(200);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it("retries on 500 and succeeds", async () => {
    let callCount = 0;
    globalThis.fetch = vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount < 3) {
        return new Response("err", { status: 500 });
      }
      return new Response("ok", { status: 200 });
    }) as unknown as typeof fetch;

    const res = await fetchWithRetry("https://example.com", {}, 3);
    expect(res.status).toBe(200);
    expect(callCount).toBe(3);
  });

  it("throws on non-retryable error", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(
        new Response("bad", { status: 400 }),
      ) as unknown as typeof fetch;

    await expect(fetchWithRetry("https://example.com", {}, 3)).rejects.toThrow(
      "Nvidia API error (400)",
    );
  });
});
