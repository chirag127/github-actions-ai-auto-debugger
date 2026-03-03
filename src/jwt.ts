// ============================================
// GitHub App JWT Generation
// ============================================
// Generates a JSON Web Token (JWT) signed with
// RS256 using the Web Crypto API. Handles both
// PKCS#1 and PKCS#8 PEM private key formats by
// auto-converting PKCS#1 → PKCS#8 at runtime.
// ============================================

/**
 * Base64url-encodes a Uint8Array (no padding).
 */
function base64urlEncode(data: Uint8Array): string {
  let binary = "";
  for (const byte of data) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Base64url-encodes a UTF-8 string.
 */
function base64urlEncodeString(str: string): string {
  return base64urlEncode(new TextEncoder().encode(str));
}

/**
 * Strips PEM headers/footers and decodes the
 * base64 body to a Uint8Array (DER bytes).
 */
function pemToDer(pem: string): Uint8Array {
  const cleaned = pem.replace(/-----[A-Z\s]+-----/g, "").replace(/\s+/g, "");
  const binary = atob(cleaned);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Wraps a PKCS#1 RSA private key DER blob
 * inside a PKCS#8 PrivateKeyInfo envelope.
 *
 * PKCS#8 structure (ASN.1):
 *   SEQUENCE {
 *     INTEGER 0
 *     SEQUENCE { OID rsaEncryption, NULL }
 *     OCTET STRING { <pkcs1-der> }
 *   }
 */
function wrapPkcs1InPkcs8(pkcs1Der: Uint8Array): Uint8Array {
  // RSA OID: 1.2.840.113549.1.1.1
  const rsaOid = new Uint8Array([
    0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01,
  ]);
  const nullParam = new Uint8Array([0x05, 0x00]);

  // AlgorithmIdentifier SEQUENCE
  const algIdContent = new Uint8Array([...rsaOid, ...nullParam]);
  const algId = asn1Sequence(algIdContent);

  // Version INTEGER 0
  const version = new Uint8Array([0x02, 0x01, 0x00]);

  // OCTET STRING wrapping the PKCS#1 key
  const octetStr = asn1OctetString(pkcs1Der);

  // Outer SEQUENCE
  const inner = new Uint8Array([...version, ...algId, ...octetStr]);
  return asn1Sequence(inner);
}

/** Wraps data in an ASN.1 SEQUENCE (tag 0x30). */
function asn1Sequence(data: Uint8Array): Uint8Array {
  return asn1Wrap(0x30, data);
}

/** Wraps data in an ASN.1 OCTET STRING (0x04). */
function asn1OctetString(data: Uint8Array): Uint8Array {
  return asn1Wrap(0x04, data);
}

/** Wraps data with an ASN.1 TLV envelope. */
function asn1Wrap(tag: number, data: Uint8Array): Uint8Array {
  const lenBytes = asn1Length(data.length);
  const result = new Uint8Array(1 + lenBytes.length + data.length);
  result[0] = tag;
  result.set(lenBytes, 1);
  result.set(data, 1 + lenBytes.length);
  return result;
}

/** Encodes an ASN.1 length field. */
function asn1Length(length: number): Uint8Array {
  if (length < 0x80) {
    return new Uint8Array([length]);
  }
  const bytes: number[] = [];
  let temp = length;
  while (temp > 0) {
    bytes.unshift(temp & 0xff);
    temp >>= 8;
  }
  return new Uint8Array([0x80 | bytes.length, ...bytes]);
}

/**
 * Imports the PEM private key as a CryptoKey.
 * Auto-detects PKCS#1 vs PKCS#8 and converts
 * PKCS#1 → PKCS#8 if needed.
 */
async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const isPkcs1 = pem.includes("BEGIN RSA PRIVATE KEY");
  let der = pemToDer(pem);

  if (isPkcs1) {
    der = wrapPkcs1InPkcs8(der);
  }

  // Copy to a fresh ArrayBuffer to avoid
  // SharedArrayBuffer type mismatch (TS2345)
  const buf = new ArrayBuffer(der.length);
  new Uint8Array(buf).set(der);

  return crypto.subtle.importKey(
    "pkcs8",
    buf,
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256",
    },
    false,
    ["sign"],
  );
}

/**
 * Generates a JWT for GitHub App authentication.
 *
 * @param appId - The GitHub App ID
 * @param privateKeyPem - PEM-encoded private key
 * @returns Signed JWT string
 */
export async function generateJWT(
  appId: string,
  privateKeyPem: string,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  // JWT Header
  const header = base64urlEncodeString(
    JSON.stringify({ alg: "RS256", typ: "JWT" }),
  );

  // JWT Payload — valid for 10 minutes,
  // issued 60s in the past for clock drift
  const payload = base64urlEncodeString(
    JSON.stringify({
      iat: now - 60,
      exp: now + 600,
      iss: appId,
    }),
  );

  const signingInput = `${header}.${payload}`;

  // Import key and sign
  const key = await importPrivateKey(privateKeyPem);
  const signatureBuffer = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(signingInput),
  );

  const signature = base64urlEncode(new Uint8Array(signatureBuffer));

  return `${header}.${payload}.${signature}`;
}
