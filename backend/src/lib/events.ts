import type { NextFunction, Request, Response } from "express";
import { readToken } from "./security.js";
import { getUser } from "../store/users.js";

// Live updates over Server-Sent Events. Every logged-in browser keeps one connection open;
// after any change the server tells all of them which kinds of data to reload.

export type Topic = "issues" | "notifications" | "users" | "staff" | "categories" | "settings";

const clients = new Set<Response>();

// GET /api/events?token=... (EventSource can't send headers, so the login token comes in the URL).
export async function eventsHandler(req: Request, res: Response) {
  const token = typeof req.query.token === "string" ? req.query.token : "";
  const userId = token ? readToken(token) : null;
  if (!userId || !(await getUser(userId))) {
    res.status(401).json({ error: "Please log in to continue" });
    return;
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  res.write("retry: 3000\n\n");
  clients.add(res);

  // A comment line every 25s stops proxies and browsers from closing an idle connection.
  const ping = setInterval(() => res.write(": ping\n\n"), 25_000);
  req.on("close", () => {
    clearInterval(ping);
    clients.delete(res);
  });
}

export function broadcast(topics: Topic[]) {
  if (!topics.length) return;
  const message = `data: ${JSON.stringify({ topics })}\n\n`;
  for (const client of clients) client.write(message);
}

// Which data a successful change to each part of the API can affect.
function topicsFor(path: string): Topic[] {
  if (path.startsWith("/api/issues")) return ["issues", "notifications", "staff"];
  if (path.startsWith("/api/notifications")) return ["notifications"];
  if (path.startsWith("/api/users")) return ["users", "staff", "issues", "notifications"];
  if (path.startsWith("/api/categories")) return ["categories", "issues"];
  if (path.startsWith("/api/settings")) return ["settings"];
  if (path === "/api/auth/signup") return ["users"];
  return [];
}

// Middleware: after every successful POST/PATCH/DELETE, tell connected browsers to refresh.
export function broadcastChanges(req: Request, res: Response, next: NextFunction) {
  if (req.method !== "GET") {
    // Read the path now: Express shortens req.path once the request reaches a router.
    const topics = topicsFor(req.path);
    res.on("finish", () => {
      if (res.statusCode < 400) broadcast(topics);
    });
  }
  next();
}
