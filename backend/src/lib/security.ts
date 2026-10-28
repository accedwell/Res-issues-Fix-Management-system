import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

// ===== Passwords =====
// Stored as "salt:hash" using scrypt from Node's built-in crypto module.

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const expected = Buffer.from(hash, "hex");
  const actual = scryptSync(password, salt, expected.length);
  return timingSafeEqual(expected, actual);
}

// ===== Login tokens =====
// A small signed token: base64url(payload) + "." + HMAC signature.
// It survives server restarts because nothing is stored on the server.

const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// The secret must be set in .env: anyone who knows it can make a token for any account.
// In production the server refuses to run without a long one; in development a warning is shown.
const DEV_SECRET = "dev-only-secret-change-me";
const MIN_SECRET_LENGTH = 32;

// The placeholder from .env.example counts as not set.
if (!process.env.TOKEN_SECRET || process.env.TOKEN_SECRET.length < MIN_SECRET_LENGTH || process.env.TOKEN_SECRET.startsWith("change-me")) {
  const problem = `TOKEN_SECRET in .env must be set to a random value of at least ${MIN_SECRET_LENGTH} characters.`;
  if (process.env.NODE_ENV === "production") throw new Error(problem);
  console.warn(`WARNING: ${problem} Using an insecure development secret.`);
}

function secret(): string {
  return process.env.TOKEN_SECRET || DEV_SECRET;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function createToken(userId: string): string {
  const payload = Buffer.from(JSON.stringify({ sub: userId, exp: Date.now() + TOKEN_TTL_MS })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

// Returns the user id inside a valid, unexpired token — otherwise null.
export function readToken(token: string): string | null {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const expected = Buffer.from(sign(payload));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;

  try {
    const { sub, exp } = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (typeof sub !== "string" || typeof exp !== "number" || exp < Date.now()) return null;
    return sub;
  } catch {
    return null;
  }
}
