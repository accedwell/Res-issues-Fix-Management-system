import type { NextFunction, Request, Response } from "express";
import { forbidden, HttpError } from "../lib/http.js";
import { readToken } from "../lib/security.js";
import { getUser } from "../store/users.js";
import type { Role, User } from "../types.js";

declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

// Reads "Authorization: Bearer <token>" and attaches the logged-in user to req.user.
export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const userId = token ? readToken(token) : null;
  const user = userId ? await getUser(userId) : undefined;
  if (!user) throw new HttpError(401, "Please log in to continue");
  req.user = user;
  next();
}

// Use after requireAuth: only lets the listed roles through.
export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) throw forbidden();
    next();
  };
}

// The logged-in user. Only call inside routes protected by requireAuth.
export function currentUser(req: Request): User {
  if (!req.user) throw new HttpError(401, "Please log in to continue");
  return req.user;
}
