import {
	env,
	createExecutionContext,
	waitOnExecutionContext,
	SELF,
} from "cloudflare:test";
import { describe, it, expect, vi, beforeEach } from "vitest";
import worker from "../src/index.js";

/**
 * Helper: compute HMAC-SHA256 signature for a payload.
 */
async function signPayload(secret, payload) {
	const encoder = new TextEncoder();
	const key = await crypto.subtle.importKey(
		"raw",
		encoder.encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const mac = await crypto.subtle.sign(
		"HMAC",
		key,
		encoder.encode(payload),
	);
	const hex = Array.from(new Uint8Array(mac))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
	return `sha256=${hex}`;
}

describe("Worker fetch handler", () => {
	it("GET /health returns 200", async () => {
		const req = new Request("http://localhost/health", { method: "GET" });
		const ctx = createExecutionContext();
		const res = await worker.fetch(req, env, ctx);
		await waitOnExecutionContext(ctx);
		expect(res.status).toBe(200);
		expect(await res.text()).toBe("OK");
	});

	it("POST /unknown returns 404", async () => {
		const req = new Request("http://localhost/unknown", { method: "POST" });
		const ctx = createExecutionContext();
		const res = await worker.fetch(req, env, ctx);
		await waitOnExecutionContext(ctx);
		expect(res.status).toBe(404);
	});

	it("POST /webhook with invalid signature returns 401", async () => {
		const req = new Request("http://localhost/webhook", {
			method: "POST",
			headers: {
				"X-Hub-Signature-256": "sha256=invalid",
				"X-GitHub-Event": "workflow_run",
			},
			body: '{"test":true}',
		});
		const ctx = createExecutionContext();
		const res = await worker.fetch(req, env, ctx);
		await waitOnExecutionContext(ctx);
		expect(res.status).toBe(401);
	});

	it("POST /webhook with non-workflow_run event returns 200", async () => {
		const body = '{"action":"opened"}';
		const sig = await signPayload("test-secret", body);

		const req = new Request("http://localhost/webhook", {
			method: "POST",
			headers: {
				"X-Hub-Signature-256": sig,
				"X-GitHub-Event": "pull_request",
			},
			body,
		});
		const ctx = createExecutionContext();
		const res = await worker.fetch(req, env, ctx);
		await waitOnExecutionContext(ctx);
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.message).toBe("Ignored event");
	});

	it("POST /webhook with non-failure conclusion returns 200", async () => {
		const payload = {
			action: "completed",
			workflow_run: { conclusion: "success", id: 1, head_branch: "main", head_sha: "abc" },
			repository: { name: "repo", owner: { login: "user" } },
			sender: { login: "user" },
			installation: { id: 1 },
		};
		const body = JSON.stringify(payload);
		const sig = await signPayload("test-secret", body);

		const req = new Request("http://localhost/webhook", {
			method: "POST",
			headers: {
				"X-Hub-Signature-256": sig,
				"X-GitHub-Event": "workflow_run",
			},
			body,
		});
		const ctx = createExecutionContext();
		const res = await worker.fetch(req, env, ctx);
		await waitOnExecutionContext(ctx);
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.message).toBe("Ignored run");
	});

	it("POST /webhook with bot sender returns 200", async () => {
		const payload = {
			action: "completed",
			workflow_run: { conclusion: "failure", id: 1, head_branch: "main", head_sha: "abc" },
			repository: { name: "repo", owner: { login: "user" } },
			sender: { login: "dependabot[bot]" },
			installation: { id: 1 },
		};
		const body = JSON.stringify(payload);
		const sig = await signPayload("test-secret", body);

		const req = new Request("http://localhost/webhook", {
			method: "POST",
			headers: {
				"X-Hub-Signature-256": sig,
				"X-GitHub-Event": "workflow_run",
			},
			body,
		});
		const ctx = createExecutionContext();
		const res = await worker.fetch(req, env, ctx);
		await waitOnExecutionContext(ctx);
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.message).toBe("Ignored bot sender");
	});
});
