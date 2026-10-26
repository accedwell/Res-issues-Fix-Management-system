import prisma from "../lib/prisma.js";
import { roleFromDb, roleToDb } from "./mappers.js";
import type { Prisma } from "../generated/prisma/client.js";
import type { PublicUser, Role, User } from "../types.js";

const withBlock = { block: true } as const;
type UserRow = Prisma.UserGetPayload<{ include: typeof withBlock }>;

function toUser(row: UserRow): User {
  return {
    id: row.id,
    name: row.fullName,
    email: row.email,
    role: roleFromDb(row.role),
    passwordHash: row.passwordHash,
    createdAt: row.createdAt.toISOString(),
    ...(row.studentNumber ? { studentNumber: row.studentNumber } : {}),
    ...(row.block ? { block: row.block.name } : {}),
    ...(row.roomNumber ? { room: row.roomNumber } : {}),
    ...(row.specialization ? { specialization: row.specialization } : {}),
  };
}

export function toPublic(user: User): PublicUser {
  const { passwordHash: _hidden, ...rest } = user;
  return rest;
}

// Removed accounts are kept (switched off) so their old reports keep the reporter's name.
export async function listUsers(role?: Role): Promise<User[]> {
  const rows = await prisma.user.findMany({
    where: { isActive: true, ...(role ? { role: roleToDb(role) } : {}) },
    include: withBlock,
    orderBy: { createdAt: "asc" },
  });
  return rows.map(toUser);
}

export async function getUser(id: string): Promise<User | undefined> {
  const row = await prisma.user.findFirst({ where: { id, isActive: true }, include: withBlock });
  return row ? toUser(row) : undefined;
}

export async function getUserByEmail(email: string): Promise<User | undefined> {
  const row = await prisma.user.findFirst({ where: { email: email.toLowerCase(), isActive: true }, include: withBlock });
  return row ? toUser(row) : undefined;
}

export async function getUserByStudentNumber(studentNumber: string): Promise<User | undefined> {
  const row = await prisma.user.findFirst({ where: { studentNumber, isActive: true }, include: withBlock });
  return row ? toUser(row) : undefined;
}

export async function insertUser(user: User): Promise<User> {
  const block = user.block ? await prisma.residenceBlock.findUnique({ where: { name: user.block } }) : null;
  const row = await prisma.user.create({
    data: {
      id: user.id,
      fullName: user.name,
      email: user.email.toLowerCase(),
      passwordHash: user.passwordHash,
      role: roleToDb(user.role),
      studentNumber: user.studentNumber ?? null,
      roomNumber: user.room ?? null,
      specialization: user.specialization ?? null,
      blockId: block?.id ?? null,
      createdAt: new Date(user.createdAt),
    },
    include: withBlock,
  });
  return toUser(row);
}

export async function updatePassword(id: string, passwordHash: string): Promise<void> {
  await prisma.user.update({ where: { id }, data: { passwordHash } });
}

// Switches the account off and frees its email and student number for re-use.
export async function deleteUser(id: string): Promise<void> {
  const row = await prisma.user.findUnique({ where: { id } });
  if (!row) return;
  await prisma.user.update({
    where: { id },
    data: { isActive: false, email: `${row.email}#removed-${id}`, studentNumber: null },
  });
}
