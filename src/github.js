/**
 * GitHub API client functions.
 * Uses native fetch() — no external HTTP library needed.
 */

import { unzipSync } from "fflate";
import { createGitHubJWT } from "./jwt.js";

const GH_HEADERS = {
	Accept: "application/vnd.github.v3+json",
	"User-Agent": "AI-Auto-Debugger",
};

/**
 * Get a GitHub App installation access token.
 * @param {string} jwt - The App JWT
 * @param {number} installationId
 * @returns {Promise<string>}
 */
export async function getInstallationToken(jwt, installationId) {
	const url = `https://api.github.com/app/installations/${installationId}/access_tokens`;
	const res = await fetch(url, {
		method: "POST",
		headers: {
			...GH_HEADERS,
			Authorization: `Bearer ${jwt}`,
		},
	});

	if (!res.ok) {
		throw new Error(`GitHub API error: ${res.status} ${await res.text()}`);
	}

	const data = await res.json();
	return data.token;
}

/**
 * Download and extract workflow run logs.
 * @param {string} token - Installation access token
 * @param {string} owner
 * @param {string} repo
 * @param {number} runId
 * @returns {Promise<string>} Concatenated log text (truncated to 15000 chars)
 */
export async function getWorkflowLogs(token, owner, repo, runId) {
	const url = `https://api.github.com/repos/${owner}/${repo}/actions/runs/${runId}/logs`;

	try {
		const res = await fetch(url, {
			headers: {
				...GH_HEADERS,
				Authorization: `Bearer ${token}`,
			},
			redirect: "follow",
		});

		if (!res.ok) {
			return `Failed to get logs: ${res.status}`;
		}

		const contentType = res.headers.get("content-type") || "";

		if (contentType.includes("application/zip")) {
			const buffer = await res.arrayBuffer();
			const unzipped = unzipSync(new Uint8Array(buffer));
			let logs = "";
			for (const [filename, content] of Object.entries(unzipped)) {
				logs += `[${filename}]\n${new TextDecoder().decode(content)}\n\n`;
			}
			return logs.slice(0, 15000);
		}

		const text = await res.text();
		return text.slice(0, 15000);
	} catch (e) {
		return `Failed to get logs: ${e.message}`;
	}
}

/**
 * Get file content from a repository.
 * @param {string} token
 * @param {string} owner
 * @param {string} repo
 * @param {string} path - File path in repo
 * @param {string} ref - Git ref (SHA, branch, tag)
 * @returns {Promise<string>} Decoded file content or empty string
 */
export async function getFileContent(token, owner, repo, path, ref) {
	const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${ref}`;

	const res = await fetch(url, {
		headers: {
			...GH_HEADERS,
			Authorization: `Bearer ${token}`,
		},
	});

	if (!res.ok) {
		return "";
	}

	const data = await res.json();
	if (data.content) {
		return atob(data.content);
	}
	return "";
}

/**
 * Commit a file update to a repository.
 * @param {string} token
 * @param {string} owner
 * @param {string} repo
 * @param {string} path
 * @param {string} branch
 * @param {string} content - New file content
 * @param {string} sha - Current file SHA
 * @param {string} message - Commit message
 */
export async function commitFile(
	token,
	owner,
	repo,
	path,
	branch,
	content,
	sha,
	message,
) {
	const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;

	await fetch(url, {
		method: "PUT",
		headers: {
			...GH_HEADERS,
			Authorization: `Bearer ${token}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			message,
			content: btoa(
				new TextEncoder()
					.encode(content)
					.reduce((s, b) => s + String.fromCharCode(b), ""),
			),
			sha,
			branch,
		}),
	});
}
