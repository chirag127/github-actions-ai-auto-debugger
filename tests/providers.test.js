import { beforeEach, describe, expect, it, vi } from "vitest";
import { chatCompletion, listProviders } from "../src/providers.js";

describe("listProviders", () => {
	it("returns all 9 providers", () => {
		const providers = listProviders();
		expect(Object.keys(providers)).toHaveLength(9);
		expect(providers).toHaveProperty("cerebras");
		expect(providers).toHaveProperty("groq");
		expect(providers).toHaveProperty("mistral");
		expect(providers).toHaveProperty("google_gemini");
		expect(providers).toHaveProperty("nvidia");
		expect(providers).toHaveProperty("cohere");
		expect(providers).toHaveProperty("huggingface");
		expect(providers).toHaveProperty("openrouter");
		expect(providers).toHaveProperty("github_models");
	});

	it("each provider has required fields", () => {
		const providers = listProviders();
		for (const [name, config] of Object.entries(providers)) {
			expect(config).toHaveProperty("baseUrl");
			expect(config).toHaveProperty("envKey");
			expect(config).toHaveProperty("defaultModel");
			expect(typeof config.baseUrl).toBe("string");
			expect(typeof config.envKey).toBe("string");
			expect(typeof config.defaultModel).toBe("string");
		}
	});
});

describe("chatCompletion", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it("constructs correct URL and headers for cerebras", async () => {
		const mockResponse = {
			ok: true,
			json: async () => ({
				choices: [{ message: { content: "Hello" } }],
			}),
		};
		const fetchSpy = vi
			.spyOn(globalThis, "fetch")
			.mockResolvedValue(mockResponse);

		const env = {
			AI_PROVIDER: "cerebras",
			AI_MODEL: "test-model",
			CEREBRAS_API_KEY: "test-key",
		};

		const result = await chatCompletion(env, [{ role: "user", content: "Hi" }]);

		expect(result).toBe("Hello");
		expect(fetchSpy).toHaveBeenCalledWith(
			"https://api.cerebras.ai/v1/chat/completions",
			expect.objectContaining({
				method: "POST",
				headers: expect.objectContaining({
					Authorization: "Bearer test-key",
				}),
			}),
		);
	});

	it("uses default model when AI_MODEL is not set", async () => {
		const mockResponse = {
			ok: true,
			json: async () => ({
				choices: [{ message: { content: "OK" } }],
			}),
		};
		const fetchSpy = vi
			.spyOn(globalThis, "fetch")
			.mockResolvedValue(mockResponse);

		const env = {
			AI_PROVIDER: "groq",
			GROQ_API_KEY: "groq-key",
		};

		await chatCompletion(env, [{ role: "user", content: "Test" }]);

		const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
		expect(body.model).toBe("llama-3.3-70b-versatile");
	});

	it("throws on unknown provider", async () => {
		const env = { AI_PROVIDER: "nonexistent" };
		await expect(
			chatCompletion(env, [{ role: "user", content: "Hi" }]),
		).rejects.toThrow("Unknown provider");
	});

	it("throws on missing API key", async () => {
		const env = { AI_PROVIDER: "cerebras" };
		await expect(
			chatCompletion(env, [{ role: "user", content: "Hi" }]),
		).rejects.toThrow("API key not found");
	});

	it("throws on non-ok response", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValue({
			ok: false,
			status: 429,
			text: async () => "Rate limited",
		});

		const env = {
			AI_PROVIDER: "cerebras",
			CEREBRAS_API_KEY: "test-key",
		};

		await expect(
			chatCompletion(env, [{ role: "user", content: "Hi" }]),
		).rejects.toThrow("LLM API error");
	});
});
