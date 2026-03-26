/**
 * RSA-SHA256 JWT generation for GitHub App authentication.
 * Uses Web Crypto API — no external JWT library needed.
 */

/**
 * Parse a PEM-encoded PKCS#8 private key into a CryptoKey.
 * @param {string} pem - PEM string (with or without headers)
 * @returns {Promise<CryptoKey>}
 */
async function importPKCS8(pem) {
	const stripped = pem
		.replace(/-----BEGIN RSA PRIVATE KEY-----/, "")
		.replace(/-----END RSA PRIVATE KEY-----/, "")
		.replace(/-----BEGIN PRIVATE KEY-----/, "")
		.replace(/-----END PRIVATE KEY-----/, "")
		.replace(/\s/g, "");

	const binary = Uint8Array.from(atob(stripped), (c) => c.charCodeAt(0));

	return crypto.subtle.importKey(
		"pkcs8",
		binary,
		{ name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
		false,
		["sign"],
	);
}

/**
 * Base64url-encode an ArrayBuffer or string.
 * @param {string|ArrayBuffer} data
 * @returns {string}
 */
function base64url(data) {
	let bytes;
	if (typeof data === "string") {
		bytes = new TextEncoder().encode(data);
	} else {
		bytes = new Uint8Array(data);
	}
	let binary = "";
	for (const b of bytes) {
		binary += String.fromCharCode(b);
	}
	return btoa(binary)
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/, "");
}

/**
 * Create a GitHub App JWT (RS256).
 * @param {string} appId - The GitHub App ID
 * @param {string} privateKeyPem - The PEM-encoded private key
 * @returns {Promise<string>} The JWT token
 */
export async function createGitHubJWT(appId, privateKeyPem) {
	const now = Math.floor(Date.now() / 1000);

	const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
	const payload = base64url(
		JSON.stringify({
			iat: now - 60,
			exp: now + 10 * 60,
			iss: appId,
		}),
	);

	const signingInput = `${header}.${payload}`;
	const encoder = new TextEncoder();
	const key = await importPKCS8(privateKeyPem);

	const signature = await crypto.subtle.sign(
		"RSASSA-PKCS1-v1_5",
		key,
		encoder.encode(signingInput),
	);

	return `${signingInput}.${base64url(signature)}`;
}
