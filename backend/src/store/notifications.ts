import prisma from "../lib/prisma.js";
import { newId } from "./db.js";
import { notificationKind, toDay } from "./mappers.js";
import type { Notification } from "../types.js";

const toNotification = (row: { id: string; userId: string; message: string; createdAt: Date; isRead: boolean; issueId: string | null }): Notification => ({
  id: row.id,
  userId: row.userId,
  message: row.message,
  date: toDay(row.createdAt),
  read: row.isRead,
  ...(row.issueId ? { issueId: row.issueId } : {}),
});

// Newest first.
export async function listNotifications(userId: string): Promise<Notification[]> {
  const rows = await prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
  return rows.map(toNotification);
}

export async function addNotification(userId: string, message: string, issueId?: string): Promise<Notification> {
  const row = await prisma.notification.create({
    data: { id: newId("n"), userId, message, issueId: issueId ?? null, ...notificationKind(message) },
  });
  return toNotification(row);
}

export async function markRead(userId: string, id: string): Promise<boolean> {
  const { count } = await prisma.notification.updateMany({ where: { id, userId }, data: { isRead: true } });
  return count > 0;
}

export async function markAllRead(userId: string): Promise<void> {
  await prisma.notification.updateMany({ where: { userId, isRead: false }, data: { isRead: true } });
}

export async function deleteNotificationsFor(userId: string): Promise<void> {
  await prisma.notification.deleteMany({ where: { userId } });
}

// Whether this user was already sent a notification about this issue containing the given text.
export async function wasNotified(userId: string, issueId: string, text: string): Promise<boolean> {
  return (await prisma.notification.count({ where: { userId, issueId, message: { contains: text } } })) > 0;
}
