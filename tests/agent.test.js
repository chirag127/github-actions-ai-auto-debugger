import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runDebugPipeline } from "../src/agent.js";

// Mock the dependencies
vi.mock("../src/jwt.js", () => ({
	createGitHubJWT: vi.fn(async () => "mock-jwt-token"),
}));

vi.mock("../src/github.js", () => ({
	getInstallationToken: vi.fn(async () => "ghs_mock_token"),
	getWorkflowLogs: vi.fn(async () => "Error: test failed at line 10"),
	getFileContent: vi.fn(async (token, owner, repo, path) => {
		if (path === "src/index.js") return "const x = 1;\nconsole.log(x);";
		return "";
	}),
	getFileSHA: vi.fn(async () => "mock-sha-123"),
	commitFile: vi.fn(async () => {}),
}));

vi.mock("../src/providers.js", () => ({
	chatCompletion: vi.fn(async (env, messages) => {
		const systemMsg = messages[0]?.content || "";
		if (systemMsg.includes("Analyze the logs")) {
			return '{"files": ["src/index.js"]}';
		}
		if (systemMsg.includes("Fix the provided code")) {
			return "const x = 2;\nconsole.log(x);";
		}
		return "default response";
	}),
}));

describe("runDebugPipeline", () => {
	const mockEnv = {
		GH_APP_ID: "12345",
		GH_APP_PRIVATE_KEY:
			"-----BEGIN RSA PRIVATE KEY-----\nfake\n-----END RSA PRIVATE KEY-----",
		AI_PROVIDER: "cerebras",
		AI_MODEL: "test-model",
		CEREBRAS_API_KEY: "test-key",
	};

	const mockPayload = {
		action: "completed",
		workflow_run: {
			id: 99999,
			head_branch: "main",
			head_sha: "abc123",
			conclusion: "failure",
		},
		repository: {
			name: "test-repo",
			owner: { login: "test-owner" },
		},
		sender: { login: "test-user" },
		installation: { id: 12345 },
	};

	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("completes the full pipeline successfully", async () => {
		await runDebugPipeline(mockEnv, mockPayload);

		const { createGitHubJWT } = await import("../src/jwt.js");
		const { getInstallationToken, getWorkflowLogs, commitFile } = await import(
			"../src/github.js"
		);
		const { chatCompletion } = await import("../src/providers.js");

		expect(createGitHubJWT).toHaveBeenCalledWith(
			"12345",
			mockEnv.GH_APP_PRIVATE_KEY,
		);
		expect(getInstallationToken).toHaveBeenCalledWith("mock-jwt-token", 12345);
		expect(getWorkflowLogs).toHaveBeenCalledWith(
			"ghs_mock_token",
			"test-owner",
			"test-repo",
			99999,
		);
		expect(chatCompletion).toHaveBeenCalledTimes(2);
		expect(commitFile).toHaveBeenCalled();
	});

	it("throws on missing GH_APP_ID", async () => {
		const envWithoutAppId = { ...mockEnv, GH_APP_ID: undefined };
		await expect(
			runDebugPipeline(envWithoutAppId, mockPayload),
		).rejects.toThrow("Missing GH_APP_ID or GH_APP_PRIVATE_KEY");
	});

	it("handles LLM parsing errors gracefully", async () => {
		const { chatCompletion } = await import("../src/providers.js");
		vi.mocked(chatCompletion).mockResolvedValueOnce("not valid json");

		await expect(runDebugPipeline(mockEnv, mockPayload)).rejects.toThrow(
			"Failed to parse analysis response",
		);
	});
});
