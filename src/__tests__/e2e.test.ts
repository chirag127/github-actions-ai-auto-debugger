// E2E Tests — GitHub Actions AI Auto-Debugger
import { describe, expect, it } from "vitest";
import worker from "../index";

describe("E2E - Worker Routing", () => {
  const env = {
    WEBHOOK_SECRET: "test-secret",
    GITHUB_APP_ID: "12345",
    GITHUB_PRIVATE_KEY:
      "-----BEGIN RSA PRIVATE KEY-----\n" +
      "MIIEogIBAAKCAQEA7V+...\n" +
      "-----END RSA PRIVATE KEY-----",
    NVIDIA_API_KEY: "nvapi-test",
  };

  it("rejects non-POST methods", async () => {
    const req = new Request("https://w.local", {
      method: "GET",
    });
    const res = await worker.fetch(req, env as never);
    expect(res.status).toBe(405);
    const data = (await res.json()) as { message: string };
    expect(data.message).toBe("Method Not Allowed");
  });

  it("rejects missing signature", async () => {
    const req = new Request("https://w.local", {
      method: "POST",
      headers: {
        "X-GitHub-Event": "workflow_run",
      },
      body: "{}",
    });
    const res = await worker.fetch(req, env as never);
    expect(res.status).toBe(401);
    const data = (await res.json()) as { message: string };
    expect(data.message).toBe("Missing signature");
  });

  it("rejects invalid signature", async () => {
    const payload = {
      action: "completed",
      workflow_run: {
        id: 123456,
        conclusion: "failure",
        head_branch: "fix/bug",
        head_sha: "sha123",
        head_commit: {
          author: { name: "user" },
        },
      },
      repository: {
        name: "repo",
        owner: { login: "owner" },
      },
      sender: { login: "owner" },
      installation: { id: 789 },
    };

    const req = new Request("https://w.local", {
      method: "POST",
      headers: {
        "X-GitHub-Event": "workflow_run",
        "X-Hub-Signature-256": "sha256=invalid",
      },
      body: JSON.stringify(payload),
    });

    const res = await worker.fetch(req, env as never);
    expect(res.status).toBe(401);
    const data = (await res.json()) as { message: string };
    expect(data.message).toBe("Invalid signature");
  });

  it("passes valid signature and filters non-failure", async () => {
    const payload = {
      action: "completed",
      workflow_run: { conclusion: "success" },
    };
    const body = JSON.stringify(payload);

    // Compute valid HMAC-SHA256 signature
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(env.WEBHOOK_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const sig = await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(body),
    );
    const hex = Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const req = new Request("https://w.local", {
      method: "POST",
      headers: {
        "X-GitHub-Event": "workflow_run",
        "X-Hub-Signature-256": `sha256=${hex}`,
      },
      body,
    });

    const res = await worker.fetch(req, env as never);
    expect(res.status).toBe(200);
    const data = (await res.json()) as { message: string };
    expect(data.message).toBe("Not a failure event");
  });

  it("ignores non-workflow_run events", async () => {
    const body = "{}";
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(env.WEBHOOK_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const sig = await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(body),
    );
    const hex = Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const req = new Request("https://w.local", {
      method: "POST",
      headers: {
        "X-GitHub-Event": "push",
        "X-Hub-Signature-256": `sha256=${hex}`,
      },
      body,
    });

    const res = await worker.fetch(req, env as never);
    expect(res.status).toBe(200);
    const data = (await res.json()) as { message: string };
    expect(data.message).toBe("Event ignored");
  });
});

