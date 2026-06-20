import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Tokens de sesión efímeros para el WebSocket bridge del sandbox.
 *
 * Diseño:
 *   - Token = base64url( userId . nonce . expiry . hmac )
 *   - HMAC-SHA256 firmado con SANDBOX_WS_SECRET (env var)
 *   - Lifetime: 5 minutos (suficiente para el handshake del navegador)
 *   - Stateless: el cliente lo presenta en el query string del WS upgrade
 *
 * Por qué tokens y no cookies: las cookies requieren Same-Origin y son más
 * complicadas con WS. Tokens en query string son estándar para sandboxes tipo
 * Cloudflare Workers Playground / StackBlitz.
 */

const TOKEN_TTL_MS = 5 * 60 * 1000; // 5 min

function getSecret(): string {
  const s = process.env.SANDBOX_WS_SECRET;
  if (!s || s.length < 16) {
    // Fallback para dev: derivar de un secret estático. En prod debe venir de env.
    return "dev-only-insecure-secret-change-me-in-production-please";
  }
  return s;
}

function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): Buffer {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

export interface SessionTokenPayload {
  userId: string;
  nonce: string;
  expiry: number;
}

export function issueSandboxSessionToken(userId: string): string {
  const payload: SessionTokenPayload = {
    userId,
    nonce: randomBytes(8).toString("hex"),
    expiry: Date.now() + TOKEN_TTL_MS,
  };

  const json = JSON.stringify(payload);
  const jsonB64 = b64url(Buffer.from(json, "utf8"));

  const sig = createHmac("sha256", getSecret()).update(jsonB64).digest();
  const sigB64 = b64url(sig);

  return `${jsonB64}.${sigB64}`;
}

export function verifySandboxSessionToken(token: string): SessionTokenPayload | null {
  if (!token || typeof token !== "string") return null;

  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [jsonB64, sigB64] = parts;
  if (!jsonB64 || !sigB64) return null;

  let expectedSig: Buffer;
  let providedSig: Buffer;
  try {
    expectedSig = createHmac("sha256", getSecret()).update(jsonB64).digest();
    providedSig = b64urlDecode(sigB64);
  } catch {
    return null;
  }

  if (expectedSig.length !== providedSig.length) return null;
  if (!timingSafeEqual(expectedSig, providedSig)) return null;

  let payload: SessionTokenPayload;
  try {
    const json = b64urlDecode(jsonB64).toString("utf8");
    payload = JSON.parse(json) as SessionTokenPayload;
  } catch {
    return null;
  }

  if (typeof payload.userId !== "string") return null;
  if (typeof payload.expiry !== "number") return null;
  if (typeof payload.nonce !== "string") return null;

  if (Date.now() > payload.expiry) return null;

  return payload;
}
