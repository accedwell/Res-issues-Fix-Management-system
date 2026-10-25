import type { ErrorRequestHandler } from "express";

// Throw this from any route to send a clean JSON error response.
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export const badRequest = (message: string) => new HttpError(400, message);
export const notFound = (message = "Not found") => new HttpError(404, message);
export const forbidden = (message = "You are not allowed to do that") => new HttpError(403, message);

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  // Malformed JSON body
  if (err?.type === "entity.parse.failed") {
    res.status(400).json({ error: "Request body is not valid JSON" });
    return;
  }
  console.error(err);
  res.status(500).json({ error: "Something went wrong on the server" });
};

// ===== Small input validators =====

type Body = Record<string, unknown>;

export function requireString(body: Body, field: string, label = field): string {
  const value = body[field];
  if (typeof value !== "string" || !value.trim()) throw badRequest(`${label} is required`);
  return value.trim();
}

export function optionalString(body: Body, field: string): string | undefined {
  const value = body[field];
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") throw badRequest(`${field} must be text`);
  return value.trim();
}

export function requireOneOf<T extends string>(body: Body, field: string, allowed: readonly T[]): T {
  const value = body[field];
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    throw badRequest(`${field} must be one of: ${allowed.join(", ")}`);
  }
  return value as T;
}

export function requireEmail(body: Body, field = "email"): string {
  const email = requireString(body, field, "Email").toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw badRequest("Email address is not valid");
  return email;
}

export function requirePassword(body: Body, field = "password"): string {
  const password = body[field];
  if (typeof password !== "string" || password.length < 8) {
    throw badRequest("Password must be at least 8 characters");
  }
  return password;
}

export const today = () => new Date().toISOString().slice(0, 10);
