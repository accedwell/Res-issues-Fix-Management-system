import type { NextFunction, Request, Response } from "express";
import { HttpError } from "./http.js";

// Limits how often one person can try something (logging in, asking for reset codes), so
// passwords and codes can't be guessed by trying thousands of times. Counts are kept in memory,
// so they reset when the server restarts.

interface Window {
  count: number;
  resetAt: number;
}

export function rateLimit(options: { max: number; minutes: number; message: string; key?: (req: Request) => string }) {
  const hits = new Map<string, Window>();
  const windowMs = options.minutes * 60 * 1000;

  // Forget old entries now and then, so the map doesn't grow forever.
  setInterval(() => {
    const now = Date.now();
    for (const [key, w] of hits) if (w.resetAt <= now) hits.delete(key);
  }, windowMs).unref();

  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    // Counted per IP address, and per email too when the route uses one.
    const keys = [`ip:${req.ip}`, ...(options.key ? [`key:${options.key(req)}`] : [])];
    for (const key of keys) {
      let w = hits.get(key);
      if (!w || w.resetAt <= now) {
        w = { count: 0, resetAt: now + windowMs };
        hits.set(key, w);
      }
      w.count++;
      if (w.count > options.max) {
        res.set("Retry-After", String(Math.ceil((w.resetAt - now) / 1000)));
        throw new HttpError(429, options.message);
      }
    }
    next();
  };
}

// The email in the request body, so one account can't be attacked from many addresses.
export const byEmail = (req: Request) => String(req.body?.email ?? "").trim().toLowerCase();
