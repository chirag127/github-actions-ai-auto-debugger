/**
 * AI debugging pipeline.
 * Replaces the Python LangGraph state machine with a sequential async pipeline.
 */

import {
	commitFile,
	getFileContent,
	getInstallationToken,
	getWorkflowLogs,
} from "./github.js";
import { createGitHubJWT } from "./jwt.js";
import { chatCompletion } from "./providers.js";

/**
 * Run the full debug pipeline for a failed workflow run.
 * @param {Env} env - Worker env bindings
 * @param {object} payload - Parsed webhook payload
 */
export async function runDebugPipeline(env, payload) {
	const repoOwner = payload.repository.owner.login;
	const repoName = payload.repository.name;
	const branch = payload.workflow_run.head_branch;
	const headSha = payload.workflow_run.head_sha;
	const runId = payload.workflow_run.id;
	const installationId = payload.installation.id;

	// Step 1: Authenticate
	console.log("--- AUTHENTICATING ---");
	const appId = env.GITHUB_APP_ID;
	const privateKey = env.GITHUB_PRIVATE_KEY;

	if (!appId || !privateKey) {
		throw new Error("Missing GITHUB_APP_ID or GITHUB_PRIVATE_KEY");
	}

	const jwt = await createGitHubJWT(appId, privateKey);
	const githubToken = await getInstallationToken(jwt, installationId);

	// Step 2: Fetch logs
	console.log("--- FETCHING LOGS ---");
	const logs = await getWorkflowLogs(githubToken, repoOwner, repoName, runId);

	// Step 3: Analyze error
	console.log("--- ANALYZING ERROR ---");
	const analyzeMessages = [
		{
			role: "system",
			content: `Analyze the logs and identify the file paths that caused the failure.
Return a JSON object with a 'files' key containing a list of strings.
Example: {"files": ["src/index.ts", "package.json"]}
Return ONLY JSON.`,
		},
		{ role: "user", content: logs.slice(-8000) },
	];

	const analysisContent = await chatCompletion(env, analyzeMessages);
	let cleanedContent = analysisContent.trim();
	if (cleanedContent.startsWith("```json")) {
		cleanedContent = cleanedContent.slice(7, -3).trim();
	}
	if (cleanedContent.startsWith("```")) {
		cleanedContent = cleanedContent.slice(3, -3).trim();
	}

	let filesToFix;
	try {
		const data = JSON.parse(cleanedContent);
		filesToFix = data.files || [];
	} catch (e) {
		throw new Error(`Failed to parse analysis response: ${e.message}`);
	}

	if (filesToFix.length === 0) {
		console.log("--- NO FILES TO FIX ---");
		return;
	}

	// Step 4: Fetch code
	console.log("--- FETCHING CODE ---");
	const fileContents = {};
	for (const path of filesToFix) {
		const code = await getFileContent(
			githubToken,
			repoOwner,
			repoName,
			path,
			headSha,
		);
		if (code) {
			fileContents[path] = code;
		}
	}

	// Step 5: Generate fixes
	console.log("--- GENERATING FIXES ---");
	const fixedContents = {};
	for (const [path, content] of Object.entries(fileContents)) {
		const fixMessages = [
			{
				role: "system",
				content: `You are an expert debugger. Fix the provided code based on the error logs. Return ONLY the complete fixed code for ${path}. No markdown, no explanations.`,
			},
			{
				role: "user",
				content: `Error Logs:\n${logs.slice(-4000)}\n\nCode to fix:\n${content}`,
			},
		];

		try {
			const fixed = await chatCompletion(env, fixMessages);
			fixedContents[path] = fixed.trim();
		} catch (e) {
			console.log(`Fix failed for ${path}: ${e.message}`);
		}
	}

	// Step 6: Commit fixes
	console.log("--- COMMITTING FIXES ---");
	for (const [path, content] of Object.entries(fixedContents)) {
		// Get current file SHA
		const fileData = await getFileContent(
			githubToken,
			repoOwner,
			repoName,
			path,
			branch,
		);

		// We need the SHA for the commit, so fetch it via the Contents API
		const shaUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${path}?ref=${branch}`;
		const shaRes = await fetch(shaUrl, {
			headers: {
				Authorization: `Bearer ${githubToken}`,
				Accept: "application/vnd.github.v3+json",
			},
		});

		if (!shaRes.ok) continue;
		const shaData = await shaRes.json();

		await commitFile(
			githubToken,
			repoOwner,
			repoName,
			path,
			branch,
			content,
			shaData.sha,
			`fix: AI auto-patch for ${path}`,
		);
	}

	console.log("--- AI AGENT COMPLETED ---");
}
