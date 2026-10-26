import { Router } from "express";
import { currentUser, requireAuth } from "../middleware/auth.js";
import { notFound } from "../lib/http.js";
import { listNotifications, markAllRead, markRead } from "../store/notifications.js";

export const notificationsRouter = Router();
notificationsRouter.use(requireAuth);

// GET /api/notifications — the logged-in user's notifications, newest first.
notificationsRouter.get("/", async (req, res) => {
  const notifications = await listNotifications(currentUser(req).id);
  res.json({ notifications, unread: notifications.filter((n) => !n.read).length });
});

// POST /api/notifications/read-all
notificationsRouter.post("/read-all", async (req, res) => {
  await markAllRead(currentUser(req).id);
  res.json({ ok: true });
});

// POST /api/notifications/:id/read — one notification, e.g. after opening it from the bell.
notificationsRouter.post("/:id/read", async (req, res) => {
  if (!(await markRead(currentUser(req).id, req.params.id))) throw notFound("Notification not found");
  res.json({ ok: true });
});
