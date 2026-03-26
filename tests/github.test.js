import { describe, it, expect, vi, beforeEach } from "vitest";
import { createGitHubJWT } from "../src/jwt.js";
import {
	getInstallationToken,
	getFileContent,
	commitFile,
} from "../src/github.js";

// Generate a test RSA key pair for JWT tests
async function generateTestKeyPair() {
	const keyPair = await crypto.subtle.generateKey(
		{ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
		true,
		["sign", "verify"],
	);
	const pkcs8 = await crypto.subtle.exportKey("pkcs8", keyPair.privateKey);
	const b64 = btoa(String.fromCharCode(...new Uint8Array(pkcs8)));
	const pem = `-----BEGIN RSA PRIVATE KEY-----\n${b64.match(/.{1,64}/g).join("\n")}\n-----END RSA PRIVATE KEY-----`;
	return pem;
}

describe("createGitHubJWT", () => {
	it("generates a valid RS256 JWT", async () => {
		const pem = await generateTestKeyPair();
		const jwt = await createGitHubJWT("12345", pem);

		expect(jwt).toBeTruthy();
		const parts = jwt.split(".");
		expect(parts).toHaveLength(3);

		// Decode header
		const header = JSON.parse(
			atob(parts[0].replace(/-/g, "+").replace(/_/g, "/")),
		);
		expect(header.alg).toBe("RS256");
		expect(header.typ).toBe("JWT");

		// Decode payload
		const payload = JSON.parse(
			atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")),
		);
		expect(payload.iss).toBe("12345");
		expect(payload.iat).toBeLessThanOrEqual(Math.floor(Date.now() / 1000));
		expect(payload.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
	});
});

describe("getInstallationToken", () => {
	beforeEach(() => vi.restoreAllMocks());

	it("calls the correct endpoint and returns token", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValue({
			ok: true,
			json: async () => ({ token: "ghs_test123" }),
		});

		const token = await getInstallationToken("fake-jwt", 12345);
		expect(token).toBe("ghs_test123");

		expect(fetch).toHaveBeenCalledWith(
			"https://api.github.com/app/installations/12345/access_tokens",
			expect.objectContaining({ method: "POST" }),
		);
	});

	it("throws on non-ok response", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValue({
			ok: false,
			status: 401,
			text: async () => "Unauthorized",
		});

		await expect(getInstallationToken("bad-jwt", 12345)).rejects.toThrow(
			"GitHub API error",
		);
	});
});

describe("getFileContent", () => {
	beforeEach(() => vi.restoreAllMocks());

	it("base64-decodes file content", async () => {
		const content = "console.log('hello');";
		const b64 = btoa(content);

		vi.spyOn(globalThis, "fetch").mockResolvedValue({
			ok: true,
			json: async () => ({ content: b64 }),
		});

		const result = await getFileContent("tok", "owner", "repo", "src/index.js", "abc123");
		expect(result).toBe(content);
	});

	it("returns empty string for 404", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValue({
			ok: false,
			status: 404,
		});

		const result = await getFileContent("tok", "owner", "repo", "missing.js", "abc123");
		expect(result).toBe("");
	});
});

describe("commitFile", () => {
	beforeEach(() => vi.restoreAllMocks());

	it("sends correct PUT payload", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: true });

		await commitFile(
			"tok",
			"owner",
			"repo",
			"src/index.js",
			"main",
			"fixed code",
			"sha123",
			"fix: patch",
		);

		expect(fetch).toHaveBeenCalledWith(
			"https://api.github.com/repos/owner/repo/contents/src/index.js",
			expect.objectContaining({
				method: "PUT",
				headers: expect.objectContaining({
					Authorization: "Bearer tok",
				}),
			}),
		);

		const body = JSON.parse(fetch.mock.calls[0][1].body);
		expect(body.message).toBe("fix: patch");
		expect(body.sha).toBe("sha123");
		expect(body.branch).toBe("main");
		expect(body.content).toBeTruthy();
	});
});
