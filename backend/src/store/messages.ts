import prisma from "../lib/prisma.js";

export interface MessageRow {
  id: string;
  senderId: string;
  body: string;
  at: string; // ISO time
}

// Oldest first, like a chat.
export async function listMessages(issueId: string): Promise<MessageRow[]> {
  const rows = await prisma.issueMessage.findMany({ where: { issueId }, orderBy: { createdAt: "asc" } });
  return rows.map((r) => ({ id: r.id, senderId: r.senderId, body: r.body, at: r.createdAt.toISOString() }));
}

export async function addMessage(issueId: string, senderId: string, body: string): Promise<void> {
  await prisma.issueMessage.create({ data: { issueId, senderId, body } });
}

// The reader has seen everything the other person sent on this report.
export async function markMessagesRead(issueId: string, readerId: string): Promise<void> {
  await prisma.issueMessage.updateMany({ where: { issueId, senderId: { not: readerId }, isRead: false }, data: { isRead: true } });
}

// Per report: how many messages there are, and how many the reader has not seen yet.
export async function chatCounts(issueIds: string[], readerId: string): Promise<Map<string, { total: number; unread: number }>> {
  const counts = new Map<string, { total: number; unread: number }>();
  if (!issueIds.length) return counts;
  const [totals, unread] = await Promise.all([
    prisma.issueMessage.groupBy({ by: ["issueId"], where: { issueId: { in: issueIds } }, _count: true }),
    prisma.issueMessage.groupBy({
      by: ["issueId"],
      where: { issueId: { in: issueIds }, senderId: { not: readerId }, isRead: false },
      _count: true,
    }),
  ]);
  for (const t of totals) counts.set(t.issueId, { total: t._count, unread: 0 });
  for (const u of unread) counts.set(u.issueId, { total: counts.get(u.issueId)?.total ?? u._count, unread: u._count });
  return counts;
}
