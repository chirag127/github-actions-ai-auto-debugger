import { describe, expect, it } from "vitest";
import { verifySignature } from "../src/proxy.js";

describe("verifySignature", () => {
	const secret = "test-secret";
	const encoder = new TextEncoder();

	it("returns true for a valid HMAC-SHA256 signature", async () => {
		const payload = encoder.encode('{"test":true}');

		// Compute expected signature
		const key = await crypto.subtle.importKey(
			"raw",
			encoder.encode(secret),
			{ name: "HMAC", hash: "SHA-256" },
			false,
			["sign"],
		);
		const mac = await crypto.subtle.sign("HMAC", key, payload);
		const hex = Array.from(new Uint8Array(mac))
			.map((b) => b.toString(16).padStart(2, "0"))
			.join("");

		const result = await verifySignature(secret, payload, `sha256=${hex}`);
		expect(result).toBe(true);
	});

	it("returns false for an invalid signature", async () => {
		const payload = encoder.encode('{"test":true}');
		const result = await verifySignature(
			secret,
			payload,
			"sha256=0000000000000000000000000000000000000000000000000000000000000000",
		);
		expect(result).toBe(false);
	});

	it("returns false for missing signature", async () => {
		const payload = encoder.encode('{"test":true}');
		const result = await verifySignature(secret, payload, "");
		expect(result).toBe(false);
	});

	it("returns false for malformed signature (no sha256= prefix)", async () => {
		const payload = encoder.encode('{"test":true}');
		const result = await verifySignature(secret, payload, "abc123");
		expect(result).toBe(false);
	});

	it("returns false for wrong secret", async () => {
		const payload = encoder.encode('{"test":true}');

		const key = await crypto.subtle.importKey(
			"raw",
			encoder.encode("wrong-secret"),
			{ name: "HMAC", hash: "SHA-256" },
			false,
			["sign"],
		);
		const mac = await crypto.subtle.sign("HMAC", key, payload);
		const hex = Array.from(new Uint8Array(mac))
			.map((b) => b.toString(16).padStart(2, "0"))
			.join("");

		const result = await verifySignature(secret, payload, `sha256=${hex}`);
		expect(result).toBe(false);
	});
});
