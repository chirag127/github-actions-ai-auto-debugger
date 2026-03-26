/**
 * Multi-provider LLM factory.
 * All providers expose OpenAI-compatible /v1/chat/completions endpoints.
 */

const PROVIDERS = {
	cerebras: {
		baseUrl: "https://api.cerebras.ai/v1",
		envKey: "CEREBRAS_API_KEY",
		defaultModel: "qwen-3-235b-a22b-instruct-2507",
	},
	groq: {
		baseUrl: "https://api.groq.com/openai/v1",
		envKey: "GROQ_API_KEY",
		defaultModel: "llama-3.3-70b-versatile",
	},
	mistral: {
		baseUrl: "https://api.mistral.ai/v1",
		envKey: "MISTRAL_API_KEY",
		defaultModel: "mistral-large-latest",
	},
	google_gemini: {
		baseUrl:
			"https://generativelanguage.googleapis.com/v1beta/openai",
		envKey: "GOOGLE_API_KEY",
		defaultModel: "gemini-2.0-flash",
	},
	nvidia: {
		baseUrl: "https://integrate.api.nvidia.com/v1",
		envKey: "NVIDIA_API_KEY",
		defaultModel: "meta/llama-3.1-8b-instruct",
	},
	cohere: {
		baseUrl: "https://api.cohere.com/v2",
		envKey: "COHERE_API_KEY",
		defaultModel: "command-r-plus",
	},
	huggingface: {
		baseUrl: "https://api-inference.huggingface.co/v1",
		envKey: "HUGGINGFACE_API_KEY",
		defaultModel: "Qwen/Qwen2.5-Coder-32B-Instruct",
	},
	openrouter: {
		baseUrl: "https://openrouter.ai/api/v1",
		envKey: "OPENROUTER_API_KEY",
		defaultModel: "meta-llama/llama-3-70b-instruct",
	},
	github_models: {
		baseUrl: "https://models.inference.ai.azure.com",
		envKey: "GITHUB_MODELS_TOKEN",
		defaultModel: "gpt-4o",
	},
};

/**
 * Send a chat completion request to the configured provider.
 * @param {Env} env - Worker env bindings
 * @param {Array<{role: string, content: string}>} messages - Chat messages
 * @returns {Promise<string>} The assistant's response content
 */
export async function chatCompletion(env, messages) {
	const providerName = env.AI_PROVIDER || "cerebras";
	const config = PROVIDERS[providerName];

	if (!config) {
		const available = Object.keys(PROVIDERS).join(", ");
		throw new Error(
			`Unknown provider '${providerName}'. Available: ${available}`,
		);
	}

	const apiKey = env[config.envKey];
	if (!apiKey) {
		throw new Error(
			`API key not found. Set ${config.envKey} environment variable.`,
		);
	}

	const model = env.AI_MODEL || config.defaultModel;
	const url = `${config.baseUrl}/chat/completions`;

	const response = await fetch(url, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${apiKey}`,
		},
		body: JSON.stringify({
			model,
			messages,
			max_tokens: 4096,
		}),
	});

	if (!response.ok) {
		const text = await response.text();
		throw new Error(
			`LLM API error (${providerName}): ${response.status} ${text}`,
		);
	}

	const data = await response.json();
	return data.choices[0].message.content;
}

/**
 * Return the provider registry.
 * @returns {Record<string, object>}
 */
export function listProviders() {
	return { ...PROVIDERS };
}
