import { db, save } from "./db.js";
import type { PublicUser, Role, User } from "../types.js";

// Functions are async so they keep the same shape when a real database replaces the JSON file.

export function toPublic(user: User): PublicUser {
  const { passwordHash: _hidden, ...rest } = user;
  return rest;
}

export async function listUsers(role?: Role): Promise<User[]> {
  const users = db().users;
  return role ? users.filter((u) => u.role === role) : users;
}

export async function getUser(id: string): Promise<User | undefined> {
  return db().users.find((u) => u.id === id);
}

export async function getUserByEmail(email: string): Promise<User | undefined> {
  return db().users.find((u) => u.email === email.toLowerCase());
}

export async function getUserByStudentNumber(studentNumber: string): Promise<User | undefined> {
  return db().users.find((u) => u.studentNumber === studentNumber);
}

export async function insertUser(user: User): Promise<User> {
  db().users.push(user);
  save();
  return user;
}

export async function deleteUser(id: string): Promise<void> {
  const data = db();
  data.users = data.users.filter((u) => u.id !== id);
  save();
}
