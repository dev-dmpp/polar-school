// Hash y verificación de contraseñas con scrypt (de oslo).
// Scrypt es built-in en Node 22, no requiere dependencias nativas,
// y es el algoritmo recomendado por Lucia v3 / OWASP.
import { scryptSync, randomBytes, timingSafeEqual } from "node:crypto";

const N = 16384; // CPU/memory cost
const r = 8;
const p = 1;
const KEYLEN = 64;
const SALT_LEN = 16;

export function hashPassword(password: string): string {
  const salt = randomBytes(SALT_LEN);
  const derived = scryptSync(password.normalize("NFKC"), salt, KEYLEN, {
    N,
    r,
    p,
  });
  // Formato: scrypt$N$r$p$saltB64$hashB64
  return `scrypt$${N}$${r}$${p}$${salt.toString("base64")}$${derived.toString("base64")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const n = Number(parts[1]);
  const rr = Number(parts[2]);
  const pp = Number(parts[3]);
  const salt = Buffer.from(parts[4], "base64");
  const expected = Buffer.from(parts[5], "base64");
  const derived = scryptSync(password.normalize("NFKC"), salt, expected.length, {
    N: n,
    r: rr,
    p: pp,
  });
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}
