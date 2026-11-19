import { Router } from "express";
import { currentUser, requireAuth } from "../middleware/auth.js";
import { badRequest, HttpError, isDevMode, optionalString, requireEmail, requirePassword, requireString } from "../lib/http.js";
import { byEmail, rateLimit } from "../lib/rateLimit.js";
import { createToken, hashPassword, verifyPassword } from "../lib/security.js";
import { newId } from "../store/db.js";
import { createResetCode, useResetCode } from "../store/passwordResets.js";
import { listBlocks } from "../store/settings.js";
import { getUserByEmail, getUserByStudentNumber, insertUser, toPublic, updatePassword } from "../store/users.js";
import { ROLES, type Role } from "../types.js";

export const authRouter = Router();

// Limits on guessing: passwords at login, and reset codes (asking for codes and trying them).
const loginLimit = rateLimit({ max: 10, minutes: 15, key: byEmail, message: "Too many login attempts. Wait 15 minutes and try again." });
const resetRequestLimit = rateLimit({ max: 3, minutes: 60, key: byEmail, message: "Too many reset requests. Wait an hour and try again." });
const resetLimit = rateLimit({ max: 10, minutes: 15, key: byEmail, message: "Too many attempts. Wait 15 minutes and try again." });
const signupLimit = rateLimit({ max: 10, minutes: 60, message: "Too many sign-ups from this network. Try again later." });

// POST /api/auth/signup — students only. Staff accounts are created by the system administrator.
authRouter.post("/signup", signupLimit, async (req, res) => {
  const body = req.body ?? {};
  const firstName = requireString(body, "firstName", "First name");
  const lastName = requireString(body, "lastName", "Surname");
  const studentNumber = requireString(body, "studentNumber", "Student number");
  const email = requireEmail(body);
  const block = requireString(body, "block", "Block");
  const room = requireString(body, "room", "Room number");
  const password = requirePassword(body);

  if (!(await listBlocks()).includes(block)) throw badRequest("Unknown block");
  if (await getUserByEmail(email)) throw new HttpError(409, "An account with this email already exists");
  if (await getUserByStudentNumber(studentNumber)) throw new HttpError(409, "This student number is already registered");

  const user = await insertUser({
    id: newId("stu"),
    name: `${firstName} ${lastName}`,
    email,
    role: "student",
    passwordHash: hashPassword(password),
    createdAt: new Date().toISOString(),
    studentNumber,
    block,
    room,
  });
  res.status(201).json({ token: createToken(user.id), user: toPublic(user) });
});

// POST /api/auth/login — { email, password, role? }. When role is sent, the account must have that role.
authRouter.post("/login", loginLimit, async (req, res) => {
  const body = req.body ?? {};
  const email = requireEmail(body);
  const password = requireString(body, "password", "Password");
  const role = optionalString(body, "role") as Role | undefined;

  const user = await getUserByEmail(email);
  if (!user || !verifyPassword(password, user.passwordHash)) throw new HttpError(401, "Email or password is incorrect");
  if (role && ROLES.includes(role) && user.role !== role) {
    throw new HttpError(401, "This account does not have the role you selected");
  }
  res.json({ token: createToken(user.id), user: toPublic(user) });
});

// POST /api/auth/forgot-password — { email }. Always answers the same way, so it can't be used
// to find out which emails have accounts. Email sending isn't set up yet, so with DEV_MODE=true
// the code is printed in the server console and returned as devCode for testing.
authRouter.post("/forgot-password", resetRequestLimit, async (req, res) => {
  const email = requireEmail(req.body ?? {});
  const message = "If an account exists for that email, a reset code has been sent. It expires in 15 minutes.";

  const user = await getUserByEmail(email);
  if (!user) {
    res.json({ message });
    return;
  }

  const code = await createResetCode(user.id);
  if (!isDevMode()) {
    res.json({ message });
    return;
  }
  console.log(`Password reset code for ${email}: ${code}`);
  res.json({ message, devCode: code });
});

// POST /api/auth/reset-password — { email, code, password }.
authRouter.post("/reset-password", resetLimit, async (req, res) => {
  const body = req.body ?? {};
  const email = requireEmail(body);
  const code = requireString(body, "code", "Reset code");
  const password = requirePassword(body);

  const user = await getUserByEmail(email);
  if (!user || !(await useResetCode(user.id, code))) {
    throw badRequest("The reset code is wrong or has expired. Request a new one.");
  }
  await updatePassword(user.id, hashPassword(password));
  res.json({ message: "Your password has been changed. You can now log in." });
});

// GET /api/auth/me — the logged-in user.
authRouter.get("/me", requireAuth, (req, res) => {
  res.json({ user: toPublic(currentUser(req)) });
});
