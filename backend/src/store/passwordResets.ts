import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import prisma from "../lib/prisma.js";

const CODE_TTL_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 5;

const hashCode = (code: string) => createHash("sha256").update(code).digest("hex");

// Creates a new 6-digit reset code for the user, replacing any earlier one. Returns the plain code.
export async function createResetCode(userId: string): Promise<string> {
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const data = { codeHash: hashCode(code), expiresAt: new Date(Date.now() + CODE_TTL_MS), attempts: 0 };
  await prisma.passwordReset.upsert({ where: { userId }, create: { userId, ...data }, update: data });
  return code;
}

// Checks the code for the user. A correct code is used up; too many wrong tries cancel it.
export async function useResetCode(userId: string, code: string): Promise<boolean> {
  const reset = await prisma.passwordReset.findUnique({ where: { userId } });
  if (!reset) return false;
  if (reset.expiresAt < new Date()) {
    await prisma.passwordReset.delete({ where: { userId } });
    return false;
  }

  const expected = Buffer.from(reset.codeHash, "hex");
  const actual = Buffer.from(hashCode(code.trim()), "hex");
  const valid = timingSafeEqual(expected, actual);

  if (valid || reset.attempts + 1 >= MAX_ATTEMPTS) {
    await prisma.passwordReset.delete({ where: { userId } });
  } else {
    await prisma.passwordReset.update({ where: { userId }, data: { attempts: { increment: 1 } } });
  }
  return valid;
}
