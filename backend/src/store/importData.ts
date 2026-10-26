import prisma from "../lib/prisma.js";
import { fromDay, historyAction, notificationKind, priorityToDb, roleToDb, statusToDb } from "./mappers.js";
import type { Data } from "../types.js";

// Replaces everything in the database with the given data (used by `npm run reset-data` and
// `npm run import-json`). Each list is inserted in its original order.
export async function loadData(data: Data): Promise<void> {
  const base = Date.now() - 60 * 60 * 1000;
  const inOrder = (i: number) => new Date(base + i * 1000);

  await prisma.$transaction(
    async (tx) => {
      await tx.passwordReset.deleteMany();
      await tx.notification.deleteMany();
      await tx.issueFeedback.deleteMany();
      await tx.issueHistory.deleteMany();
      await tx.maintenanceIssue.deleteMany();
      await tx.user.deleteMany();
      await tx.issueCategory.deleteMany();
      await tx.residenceBlock.deleteMany();
      await tx.systemSetting.deleteMany();

      await tx.residenceBlock.createMany({ data: data.blocks.map((name, i) => ({ name, createdAt: inOrder(i) })) });
      const blockId = new Map((await tx.residenceBlock.findMany()).map((b) => [b.name, b.id]));

      await tx.issueCategory.createMany({
        data: data.categories.map((c, i) => ({ id: c.key, name: c.name, icon: c.icon, createdAt: inOrder(i) })),
      });

      await tx.user.createMany({
        data: data.users.map((u) => ({
          id: u.id,
          fullName: u.name,
          email: u.email.toLowerCase(),
          passwordHash: u.passwordHash,
          role: roleToDb(u.role),
          studentNumber: u.studentNumber ?? null,
          blockId: (u.block && blockId.get(u.block)) || null,
          roomNumber: u.room ?? null,
          specialization: u.specialization ?? null,
          createdAt: new Date(u.createdAt),
        })),
      });

      await tx.systemSetting.createMany({
        data: [
          ...data.settings.map((s) => ({ key: s.key, value: String(s.on), description: s.label })),
          { key: "_next_issue_number", value: String(data.nextIssueNumber), description: "Next issue reference number" },
        ],
      });

      for (const issue of data.issues) {
        const block = blockId.get(issue.residence)
        if (!block) throw new Error(`Issue ${issue.ref} uses unknown block ${issue.residence}`);
        await tx.maintenanceIssue.create({
          data: {
            id: issue.id,
            reference: issue.ref,
            title: issue.title,
            description: issue.description,
            status: statusToDb(issue.status),
            priority: priorityToDb(issue.priority),
            reporterId: issue.studentId,
            assigneeId: issue.assignedTo,
            categoryId: issue.category,
            blockId: block,
            roomNumber: issue.room,
            hasPhoto: issue.photo,
            reopenCount: issue.reopened ?? 0,
            reportedAt: fromDay(issue.dateReported),
            history: {
              create: issue.history.map((h, i) => ({
                action: historyAction(h.status, h.note),
                newValue: h.status,
                comment: h.note,
                createdAt: fromDay(h.date, i),
              })),
            },
            ...(issue.feedback
              ? { feedback: { create: { userId: issue.studentId, rating: issue.feedback.rating, comment: issue.feedback.comment || null } } }
              : {}),
          },
        });
      }

      await tx.notification.createMany({
        data: data.notifications.map((n, i) => ({
          id: n.id,
          userId: n.userId,
          message: n.message,
          isRead: n.read,
          issueId: n.issueId ?? null,
          createdAt: fromDay(n.date, i),
          ...notificationKind(n.message),
        })),
      });
    },
    { timeout: 60_000 },
  );
}
