import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { db, save } from "./db.js";

const CODE_TTL_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 5;

const hashCode = (code: string) => createHash("sha256").update(code).digest("hex");

// Creates a new 6-digit reset code for the user, replacing any earlier one. Returns the plain code.
export async function createResetCode(userId: string): Promise<string> {
  const data = db();
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const resets = (data.passwordResets ?? []).filter((r) => r.userId !== userId && r.expiresAt > Date.now());
  resets.push({ userId, codeHash: hashCode(code), expiresAt: Date.now() + CODE_TTL_MS, attempts: 0 });
  data.passwordResets = resets;
  save();
  return code;
}

// Checks the code for the user. A correct code is used up; too many wrong tries cancel it.
export async function useResetCode(userId: string, code: string): Promise<boolean> {
  const data = db();
  const reset = data.passwordResets?.find((r) => r.userId === userId);
  if (!reset || reset.expiresAt < Date.now()) return false;

  const expected = Buffer.from(reset.codeHash, "hex");
  const actual = Buffer.from(hashCode(code.trim()), "hex");
  const valid = timingSafeEqual(expected, actual);

  if (valid || ++reset.attempts >= MAX_ATTEMPTS) {
    data.passwordResets = data.passwordResets?.filter((r) => r !== reset);
  }
  save();
  return valid;
}
