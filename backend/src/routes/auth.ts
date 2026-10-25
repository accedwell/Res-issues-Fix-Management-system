import { Router } from "express";
import { currentUser, requireAuth } from "../middleware/auth.js";
import { badRequest, HttpError, optionalString, requireEmail, requirePassword, requireString } from "../lib/http.js";
import { createToken, hashPassword, verifyPassword } from "../lib/security.js";
import { newId } from "../store/db.js";
import { listBlocks } from "../store/settings.js";
import { getUserByEmail, getUserByStudentNumber, insertUser, toPublic } from "../store/users.js";
import { ROLES, type Role } from "../types.js";

export const authRouter = Router();

// POST /api/auth/signup — students only. Staff accounts are created by the system administrator.
authRouter.post("/signup", async (req, res) => {
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
authRouter.post("/login", async (req, res) => {
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

// GET /api/auth/me — the logged-in user.
authRouter.get("/me", requireAuth, (req, res) => {
  res.json({ user: toPublic(currentUser(req)) });
});
