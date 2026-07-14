// Uses the Web Crypto API (globalThis.crypto.subtle) instead of Node's
// "crypto" module. Node's crypto module isn't available in the Edge runtime
// that Next.js middleware runs on, but Web Crypto works in both Edge and
// Node.js, so this file is safe to import from middleware.ts.

const COOKIE_NAME = "pizza_crm_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not set");
  return secret;
}

async function getKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function sign(payload: string): Promise<string> {
  const key = await getKey();
  const sigBuf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return toHex(sigBuf);
}

// Very small single-user session token: expiry timestamp + "." + HMAC signature.
// No user database needed since there's only one login (ADMIN_PASSWORD).
export async function createSessionToken(): Promise<string> {
  const expiry = Date.now() + MAX_AGE_SECONDS * 1000;
  const payload = String(expiry);
  const sig = await sign(payload);
  return `${payload}.${sig}`;
}

export async function verifySessionToken(token: string | undefined | null): Promise<boolean> {
  if (!token) return false;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return false;

  const expected = await sign(payload);
  if (sig.length !== expected.length) return false;

  // Constant-time comparison (no Buffer/timingSafeEqual available in Edge runtime).
  let diff = 0;
  for (let i = 0; i < sig.length; i++) {
    diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  if (diff !== 0) return false;

  return Number(payload) > Date.now();
}

export { COOKIE_NAME, MAX_AGE_SECONDS };
