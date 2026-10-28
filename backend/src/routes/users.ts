import { Router } from "express";
import { currentUser, requireAuth, requireRole } from "../middleware/auth.js";
import { badRequest, HttpError, notFound, optionalString, requireEmail, requireOneOf, requirePassword, requireString } from "../lib/http.js";
import { hashPassword } from "../lib/security.js";
import { removeUser } from "../services/admin.js";
import { GENERAL_SPECIALIZATION, staffWorkload } from "../services/assignment.js";
import { newId } from "../store/db.js";
import { listBlocks } from "../store/settings.js";
import { getUser, getUserByEmail, getUserByStudentNumber, insertUser, listUsers, toPublic, updateUserDetails } from "../store/users.js";
import { ROLES, type User } from "../types.js";

export const usersRouter = Router();
usersRouter.use(requireAuth);

const ID_PREFIX = { student: "stu", admin: "adm", maintenance: "stf", sysadmin: "sys" } as const;

// GET /api/users/staff — maintenance staff and their open jobs (for residence admins assigning work).
usersRouter.get("/staff", requireRole("admin", "sysadmin"), async (_req, res) => {
  res.json({ staff: await staffWorkload() });
});

// Everything below is for the system administrator only.
usersRouter.use(requireRole("sysadmin"));

// GET /api/users
usersRouter.get("/", async (_req, res) => {
  res.json({ users: (await listUsers()).map(toPublic) });
});

// POST /api/users — { name, email, role, password, specialization?, studentNumber?, block?, room? }
usersRouter.post("/", async (req, res) => {
  const body = req.body ?? {};
  const role = requireOneOf(body, "role", ROLES);
  const email = requireEmail(body);
  if (await getUserByEmail(email)) throw new HttpError(409, "An account with this email already exists");

  const user: User = {
    id: newId(ID_PREFIX[role]),
    name: requireString(body, "name", "Name"),
    email,
    role,
    passwordHash: hashPassword(requirePassword(body)),
    createdAt: new Date().toISOString(),
  };

  if (role === "maintenance") {
    user.specialization = optionalString(body, "specialization") ?? GENERAL_SPECIALIZATION;
  }
  if (role === "student") {
    user.studentNumber = requireString(body, "studentNumber", "Student number");
    user.block = requireString(body, "block", "Block");
    user.room = requireString(body, "room", "Room number");
    if (!(await listBlocks()).includes(user.block)) throw badRequest("Unknown block");
    if (await getUserByStudentNumber(user.studentNumber)) throw new HttpError(409, "This student number is already registered");
  }

  await insertUser(user);
  res.status(201).json({ user: toPublic(user) });
});

// PATCH /api/users/:id — fix a mistake in an account. Students: { block, room }. Maintenance: { specialization }.
// Name, email, student number, role and password cannot be changed here.
usersRouter.patch("/:id", async (req, res) => {
  const body = req.body ?? {};
  const user = await getUser(String(req.params.id));
  if (!user) throw notFound("User not found");

  if (user.role === "student") {
    const block = requireString(body, "block", "Block");
    if (!(await listBlocks()).includes(block)) throw badRequest("Unknown block");
    const updated = await updateUserDetails(user.id, { block, room: requireString(body, "room", "Room number") });
    return res.json({ user: toPublic(updated) });
  }
  if (user.role === "maintenance") {
    const updated = await updateUserDetails(user.id, { specialization: requireString(body, "specialization", "Job type") });
    return res.json({ user: toPublic(updated) });
  }
  throw badRequest("Only students and maintenance staff have details that can be edited");
});

// DELETE /api/users/:id
usersRouter.delete("/:id", async (req, res) => {
  const id = String(req.params.id);
  res.json(await removeUser(currentUser(req), id));
});
