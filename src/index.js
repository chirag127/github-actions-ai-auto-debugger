/**
 * Entry point for the Centralized AI Auto-Debugger.
 * Supports two modes:
 *   1. GitHub Action (via action.yml) — reads inputs via @actions/core
 *   2. Standalone (via workflow_dispatch) — reads process.env directly
 */

import * as core from "@actions/core";
import { runDebugPipeline } from "./agent.js";

/**
 * Detect if running as a GitHub Action (action.yml sets INPUT_* env vars).
 * @returns {boolean}
 */
function isActionMode() {
	return Boolean(process.env.INPUT_AI_PROVIDER || process.env.INPUT_AI_API_KEY);
}

/**
 * Build the env object for the pipeline from Action inputs.
 * @returns {object}
 */
function getEnvFromActionInputs() {
	const provider =
		core.getInput("ai-provider") || process.env.AI_PROVIDER || "cerebras";
	const model = core.getInput("ai-model") || process.env.AI_MODEL || "";
	const apiKey = core.getInput("ai-api-key");
	const appId = core.getInput("gh-app-id");
	const privateKey = core.getInput("gh-app-private-key");

	// Map the API key to the correct provider env var
	const providerKeyMap = {
		cerebras: "CEREBRAS_API_KEY",
		groq: "GROQ_API_KEY",
		mistral: "MISTRAL_API_KEY",
		google_gemini: "GOOGLE_API_KEY",
		nvidia: "NVIDIA_API_KEY",
		cohere: "COHERE_API_KEY",
		huggingface: "HUGGINGFACE_API_KEY",
		openrouter: "OPENROUTER_API_KEY",
		github_models: "GITHUB_MODELS_TOKEN",
	};

	const envKey = providerKeyMap[provider] || "CEREBRAS_API_KEY";

	return {
		AI_PROVIDER: provider,
		AI_MODEL: model,
		[envKey]: apiKey,
		GH_APP_ID: appId,
		GH_APP_PRIVATE_KEY: privateKey,
		LANGFUSE_PUBLIC_KEY: process.env.LANGFUSE_PUBLIC_KEY || "",
		LANGFUSE_SECRET_KEY: process.env.LANGFUSE_SECRET_KEY || "",
		LANGFUSE_BASE_URL: process.env.LANGFUSE_BASE_URL || "",
	};
}

/**
 * Build the env object for the pipeline from process.env (standalone mode).
 * @returns {object}
 */
function getEnvFromProcess() {
	return {
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
		GITHUB_MODELS_TOKEN: process.env.GITHUB_MODELS_TOKEN,

		// GitHub App Auth
		GH_APP_ID: process.env.GH_APP_ID,
		GH_APP_PRIVATE_KEY: process.env.GH_APP_PRIVATE_KEY,

		// Langfuse (optional)
		LANGFUSE_PUBLIC_KEY: process.env.LANGFUSE_PUBLIC_KEY,
		LANGFUSE_SECRET_KEY: process.env.LANGFUSE_SECRET_KEY,
		LANGFUSE_BASE_URL: process.env.LANGFUSE_BASE_URL,
	};
}

/**
 * Build the webhook payload from Action inputs or process.env.
 * @returns {object}
 */
function getPayload() {
	if (isActionMode()) {
		return {
			repository: {
				owner: { login: core.getInput("target-repo-owner") },
				name: core.getInput("target-repo-name"),
			},
			workflow_run: {
				id: Number.parseInt(core.getInput("target-run-id"), 10),
				head_sha: core.getInput("target-head-sha"),
				head_branch: core.getInput("target-branch"),
			},
			installation: {
				id: Number.parseInt(core.getInput("target-installation-id"), 10),
			},
		};
	}

	return {
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
}

async function main() {
	console.log("--- STARTING CENTRALIZED AI DEBUGGER ---");

	const actionMode = isActionMode();
	const env = actionMode ? getEnvFromActionInputs() : getEnvFromProcess();
	const payload = getPayload();

	if (!payload.repository.owner.login || !payload.repository.name) {
		const msg = "Missing target repository details.";
		if (actionMode) core.setFailed(msg);
		else console.error(msg);
		process.exit(1);
	}

	try {
		await runDebugPipeline(env, payload);
		console.log("--- CENTRALIZED AI DEBUGGER COMPLETED ---");
	} catch (error) {
		const msg = `--- AI DEBUGGER FAILED: ${error.message} ---`;
		if (actionMode) core.setFailed(msg);
		else console.error(msg);
		process.exit(1);
	}
}

main();
