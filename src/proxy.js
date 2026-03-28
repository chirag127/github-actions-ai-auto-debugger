/**
 * Lightweight Proxy Worker for GitHub Actions AI Auto-Debugger.
 * Verifies webhooks and triggers centralized GitHub Actions.
 * Compatible with Cloudflare Workers Free Tier (<10ms CPU).
 */

export default {
	async fetch(request, env) {
		const url = new URL(request.url);

		if (request.method === "GET" && url.pathname === "/health") {
			return new Response("OK", { status: 200 });
		}

		if (request.method !== "POST" || url.pathname !== "/webhook") {
			return new Response("Not Found", { status: 404 });
		}

		const body = await request.arrayBuffer();
		const signature = request.headers.get("X-Hub-Signature-256") || "";
		const event = request.headers.get("X-GitHub-Event") || "";

		// 1. Verify Signature
		const isValid = await verifySignature(env.WEBHOOK_SECRET, body, signature);
		if (!isValid) {
			return new Response("Unauthorized", { status: 401 });
		}

		const payload = JSON.parse(new TextDecoder().decode(body));

		// 2. Filter for failed workflow runs
		if (
			event === "workflow_run" &&
			payload.action === "completed" &&
			payload.workflow_run.conclusion === "failure"
		) {
			// 3. Trigger Central Workflow Dispatch
			await triggerDispatch(env, payload);
			return new Response("Accepted", { status: 202 });
		}

		return new Response("Ignored", { status: 200 });
	},
};

/**
 * Verify HMAC-SHA256 signature.
 * Exported for testing.
 */
export async function verifySignature(secret, body, signature) {
	if (!signature.startsWith("sha256=")) return false;
	const encoder = new TextEncoder();
	const key = await crypto.subtle.importKey(
		"raw",
		encoder.encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const sig = await crypto.subtle.sign("HMAC", key, body);
	const hex = Array.from(new Uint8Array(sig))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
	return `sha256=${hex}` === signature;
}

/**
 * Trigger workflow_dispatch in the central repository.
 */
async function triggerDispatch(env, payload) {
	const owner = env.CENTRAL_REPO_OWNER;
	const repo = env.CENTRAL_REPO_NAME;
	const workflowId = env.CENTRAL_WORKFLOW_ID;
	const token = env.GITHUB_TOKEN; // PAT with 'actions:write' on central repo

	const url = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflowId}/dispatches`;

	await fetch(url, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${token}`,
			Accept: "application/vnd.github.v3+json",
			"User-Agent": "AI-Debugger-Proxy",
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			ref: "main",
			inputs: {
				repo_owner: payload.repository.owner.login,
				repo_name: payload.repository.name,
				run_id: payload.workflow_run.id.toString(),
				installation_id: (payload.installation?.id || 0).toString(),
				head_sha: payload.workflow_run.head_sha,
				branch: payload.workflow_run.head_branch,
			},
		}),
	});
}
