/**
 * Cloudflare Worker entry point.
 * Handles GitHub webhooks and processes AI debug jobs via CF Queues.
 */

import { verifySignature } from "./verify.js";
import { runDebugPipeline } from "./agent.js";

export default {
	/**
	 * HTTP handler — receives GitHub webhooks.
	 * Verifies signature, filters events, enqueues to DEBUG_QUEUE.
	 */
	async fetch(request, env, ctx) {
		const url = new URL(request.url);

		// Health check
		if (request.method === "GET" && url.pathname === "/health") {
			return new Response("OK", { status: 200 });
		}

		// Only accept POST /webhook
		if (request.method !== "POST" || url.pathname !== "/webhook") {
			return new Response("Not Found", { status: 404 });
		}

		// Read body as ArrayBuffer for signature verification
		const bodyBuffer = await request.arrayBuffer();
		const signature = request.headers.get("X-Hub-Signature-256") || "";
		const secret = env.WEBHOOK_SECRET || "testsecret";

		const isValid = await verifySignature(secret, bodyBuffer, signature);
		if (!isValid) {
			return new Response(JSON.stringify({ error: "Invalid signature" }), {
				status: 401,
				headers: { "Content-Type": "application/json" },
			});
		}

		// Filter by event type
		const event = request.headers.get("X-GitHub-Event");
		if (event !== "workflow_run") {
			return new Response(JSON.stringify({ message: "Ignored event" }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			});
		}

		// Parse payload
		let payload;
		try {
			payload = JSON.parse(new TextDecoder().decode(bodyBuffer));
		} catch (e) {
			return new Response(JSON.stringify({ error: "Invalid payload" }), {
				status: 400,
				headers: { "Content-Type": "application/json" },
			});
		}

		// Filter: only completed failures
		if (
			payload.action !== "completed" ||
			payload.workflow_run?.conclusion !== "failure"
		) {
			return new Response(JSON.stringify({ message: "Ignored run" }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			});
		}

		// Reject bot senders
		if (payload.sender?.login?.includes("[bot]")) {
			return new Response(JSON.stringify({ message: "Ignored bot sender" }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			});
		}

		// Enqueue for background processing
		await env.DEBUG_QUEUE.send(payload);

		return new Response(JSON.stringify({ message: "Accepted" }), {
			status: 202,
			headers: { "Content-Type": "application/json" },
		});
	},

	/**
	 * Queue consumer — processes debug jobs with unlimited CPU time.
	 */
	async queue(batch, env) {
		for (const message of batch.messages) {
			try {
				console.log(
					`--- STARTING AI AGENT FOR RUN ${message.body.workflow_run?.id} ---`,
				);
				await runDebugPipeline(env, message.body);
				message.ack();
			} catch (e) {
				console.log(`--- AI AGENT FAILED: ${e.message} ---`);
				message.retry();
			}
		}
	},
};
