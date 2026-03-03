// ============================================
// Webhook Signature Verification
// ============================================
// Uses the Web Crypto API (available natively
// in Cloudflare Workers) to verify GitHub's
// X-Hub-Signature-256 HMAC-SHA256 signature.
// ============================================

/**
 * Converts a hex string to a Uint8Array.
 */
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = Number.parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Verifies the GitHub webhook signature using
 * HMAC-SHA256 via the Web Crypto API.
 *
 * @param secret - The WEBHOOK_SECRET string
 * @param rawBody - The raw request body string
 * @param signatureHeader - The full value of the
 *   X-Hub-Signature-256 header (e.g.
 *   "sha256=abc123...")
 * @returns true if the signature is valid
 */
export async function verifyWebhookSignature(
  secret: string,
  rawBody: string,
  signatureHeader: string,
): Promise<boolean> {
  // GitHub prefixes the signature with "sha256="
  if (!signatureHeader.startsWith("sha256=")) {
    return false;
  }

  const receivedSignature = signatureHeader.slice(7);
  const receivedBytes = hexToBytes(receivedSignature);

  // Import the secret as an HMAC key
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  // Sign the raw body
  const signatureBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(rawBody),
  );

  // Constant-time comparison to prevent
  // timing attacks
  const expectedBytes = new Uint8Array(signatureBuffer);
  if (expectedBytes.length !== receivedBytes.length) {
    return false;
  }

  // Use subtle.verify for constant-time compare
  const verifyKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  return crypto.subtle.verify(
    "HMAC",
    verifyKey,
    receivedBytes,
    encoder.encode(rawBody),
  );
}
