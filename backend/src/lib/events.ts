import type { NextFunction, Request, Response } from "express";
import { randomBytes } from "node:crypto";
import { currentUser } from "../middleware/auth.js";
import { getUser } from "../store/users.js";

// Live updates over Server-Sent Events. Every logged-in browser keeps one connection open;
// after any change the server tells all of them which kinds of data to reload. Voice-call messages
// go only to the browsers of the person being called (see sendToUser).

export type Topic = "issues" | "notifications" | "users" | "staff" | "categories" | "settings";

// Each open connection and the user it belongs to.
const clients = new Map<Response, string>();

// EventSource can't send headers, so the browser first gets a ticket (with its login token, the
// normal way) and puts that in the URL instead. A ticket works once, within a minute, so one that
// ends up in a log or browser history is useless.
const TICKET_TTL_MS = 60 * 1000;
const tickets = new Map<string, { userId: string; expiresAt: number }>();

// POST /api/events/ticket (behind requireAuth).
export function ticketHandler(req: Request, res: Response) {
  const now = Date.now();
  for (const [t, v] of tickets) if (v.expiresAt <= now) tickets.delete(t);
  const ticket = randomBytes(24).toString("base64url");
  tickets.set(ticket, { userId: currentUser(req).id, expiresAt: now + TICKET_TTL_MS });
  res.json({ ticket });
}

function useTicket(ticket: string): string | null {
  const found = tickets.get(ticket);
  tickets.delete(ticket);
  return found && found.expiresAt > Date.now() ? found.userId : null;
}

// GET /api/events?ticket=...
export async function eventsHandler(req: Request, res: Response) {
  const ticket = typeof req.query.ticket === "string" ? req.query.ticket : "";
  const userId = ticket ? useTicket(ticket) : null;
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
  clients.set(res, userId);

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
  for (const client of clients.keys()) client.write(message);
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

// Sends a named event to every open connection of one user. Returns false when they are not online.
export function sendToUser(userId: string, event: string, data: unknown): boolean {
  const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  let sent = false;
  for (const [client, owner] of clients) {
    if (owner !== userId) continue;
    client.write(message);
    sent = true;
  }
  return sent;
}
