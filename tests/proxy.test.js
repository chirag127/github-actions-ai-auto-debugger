import { describe, expect, it, vi } from "vitest";
import worker from "../src/proxy.js";

describe("Proxy Worker", () => {
	const env = {
		WEBHOOK_SECRET: "test-secret",
		CENTRAL_REPO_OWNER: "chirag127",
		CENTRAL_REPO_NAME: "ai-auto-debugger",
		CENTRAL_WORKFLOW_ID: "ai-debugger.yml",
		GITHUB_TOKEN: "mock-token",
	};

	it("GET /health returns 200", async () => {
		const req = new Request("http://localhost/health", { method: "GET" });
		const res = await worker.fetch(req, env);
		expect(res.status).toBe(200);
		expect(await res.text()).toBe("OK");
	});

	it("POST /webhook with valid signature triggers dispatch", async () => {
		const payload = {
			action: "completed",
			workflow_run: {
				id: 123,
				conclusion: "failure",
				head_sha: "sha123",
				head_branch: "main",
			},
			repository: {
				owner: { login: "user" },
				name: "repo",
			},
			installation: { id: 456 },
		};
		const body = JSON.stringify(payload);

		// Mock HMAC signature
		const encoder = new TextEncoder();
		const key = await crypto.subtle.importKey(
			"raw",
			encoder.encode(env.WEBHOOK_SECRET),
			{ name: "HMAC", hash: "SHA-256" },
			false,
			["sign"],
		);
		const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
		const hex = Array.from(new Uint8Array(sig))
			.map((b) => b.toString(16).padStart(2, "0"))
			.join("");

		const req = new Request("http://localhost/webhook", {
			method: "POST",
			headers: {
				"X-Hub-Signature-256": `sha256=${hex}`,
				"X-GitHub-Event": "workflow_run",
			},
			body,
		});

		// Mock global fetch for the dispatch call
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => new Response("Accepted", { status: 202 })),
		);

		const res = await worker.fetch(req, env);
		expect(res.status).toBe(202);
		expect(globalThis.fetch).toHaveBeenCalledWith(
			expect.stringContaining("/dispatches"),
			expect.objectContaining({
				method: "POST",
				body: expect.stringContaining('"run_id":"123"'),
			}),
		);
	});

	it("ignores non-failure workflow runs", async () => {
		const payload = {
			action: "completed",
			workflow_run: { conclusion: "success" },
		};
		const body = JSON.stringify(payload);

		const encoder = new TextEncoder();
		const key = await crypto.subtle.importKey(
			"raw",
			encoder.encode(env.WEBHOOK_SECRET),
			{ name: "HMAC", hash: "SHA-256" },
			false,
			["sign"],
		);
		const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
		const hex = Array.from(new Uint8Array(sig))
			.map((b) => b.toString(16).padStart(2, "0"))
			.join("");

		const req = new Request("http://localhost/webhook", {
			method: "POST",
			headers: {
				"X-Hub-Signature-256": `sha256=${hex}`,
				"X-GitHub-Event": "workflow_run",
			},
			body,
		});

		const res = await worker.fetch(req, env);
		expect(res.status).toBe(200);
	});
});
