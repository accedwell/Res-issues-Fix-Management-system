import { db, newId, save } from "./db.js";
import { today } from "../lib/http.js";
import type { Notification } from "../types.js";

export async function listNotifications(userId: string): Promise<Notification[]> {
  // Reverse first so that, within the same day, the most recently added comes first.
  return db()
    .notifications.filter((n) => n.userId === userId)
    .reverse()
    .sort((a, b) => b.date.localeCompare(a.date));
}

export async function addNotification(userId: string, message: string, issueId?: string): Promise<Notification> {
  const notification: Notification = { id: newId("n"), userId, message, date: today(), read: false, ...(issueId ? { issueId } : {}) };
  db().notifications.push(notification);
  save();
  return notification;
}

export async function markRead(userId: string, id: string): Promise<boolean> {
  const notification = db().notifications.find((n) => n.id === id && n.userId === userId);
  if (!notification) return false;
  notification.read = true;
  save();
  return true;
}

export async function markAllRead(userId: string): Promise<void> {
  for (const n of db().notifications) if (n.userId === userId) n.read = true;
  save();
}

export async function deleteNotificationsFor(userId: string): Promise<void> {
  const data = db();
  data.notifications = data.notifications.filter((n) => n.userId !== userId);
  save();
}
