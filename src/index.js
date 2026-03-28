/**
 * Standalone entry point for the Centralized AI Auto-Debugger.
 * Triggered by the GitHub Action workflow_dispatch.
 */

import { runDebugPipeline } from "./agent.js";

async function main() {
	console.log("--- STARTING CENTRALIZED AI DEBUGGER ---");

	const env = {
		// AI Provider
		AI_PROVIDER: process.env.AI_PROVIDER,
		AI_MODEL: process.env.AI_MODEL,
		CEREBRAS_API_KEY: process.env.CEREBRAS_API_KEY,
		GROQ_API_KEY: process.env.GROQ_API_KEY,
		NVIDIA_API_KEY: process.env.NVIDIA_API_KEY,
		GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
		MISTRAL_API_KEY: process.env.MISTRAL_API_KEY,
		COHERE_API_KEY: process.env.COHERE_API_KEY,
		OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
		HUGGINGFACE_API_KEY: process.env.HUGGINGFACE_API_KEY,
		GH_MODELS_TOKEN: process.env.GH_MODELS_TOKEN,

		// GitHub App Auth
		GH_APP_ID: process.env.GH_APP_ID,
		GH_APP_PRIVATE_KEY: process.env.GH_APP_PRIVATE_KEY,

		// Langfuse (optional)
		LANGFUSE_PUBLIC_KEY: process.env.LANGFUSE_PUBLIC_KEY,
		LANGFUSE_SECRET_KEY: process.env.LANGFUSE_SECRET_KEY,
		LANGFUSE_BASE_URL: process.env.LANGFUSE_BASE_URL,
	};

	const payload = {
		repository: {
			owner: { login: process.env.TARGET_REPO_OWNER },
			name: process.env.TARGET_REPO_NAME,
		},
		workflow_run: {
			id: Number.parseInt(process.env.TARGET_RUN_ID),
			head_sha: process.env.TARGET_HEAD_SHA,
			head_branch: process.env.TARGET_BRANCH,
		},
		installation: {
			id: Number.parseInt(process.env.TARGET_INSTALLATION_ID),
		},
	};

	if (!payload.repository.owner.login || !payload.repository.name) {
		console.error("Missing target repository details.");
		process.exit(1);
	}

	try {
		await runDebugPipeline(env, payload);
		console.log("--- CENTRALIZED AI DEBUGGER COMPLETED ---");
	} catch (error) {
		console.error(`--- AI DEBUGGER FAILED: ${error.message} ---`);
		process.exit(1);
	}
}

main();
