import prisma from "../lib/prisma.js";
import { fromDay, historyAction, priorityFromDb, priorityToDb, statusFromDb, statusToDb, toDay } from "./mappers.js";
import type { Prisma } from "../generated/prisma/client.js";
import type { HistoryEntry, Issue, Status } from "../types.js";

export interface IssueQuery {
  studentId?: string;
  assignedTo?: string;
  status?: string;
  category?: string;
  residence?: string;
  search?: string;
}

const withDetails = {
  reporter: true,
  block: true,
  feedback: true,
  history: { orderBy: { createdAt: "asc" } },
} as const satisfies Prisma.MaintenanceIssueInclude;
type IssueRow = Prisma.MaintenanceIssueGetPayload<{ include: typeof withDetails }>;

function toIssue(row: IssueRow): Issue {
  return {
    id: row.id,
    ref: row.reference,
    title: row.title,
    category: row.categoryId,
    description: row.description,
    residence: row.block.name,
    room: row.roomNumber ?? row.location ?? "",
    priority: priorityFromDb(row.priority),
    status: statusFromDb(row.status),
    studentId: row.reporterId,
    studentName: row.reporter.fullName,
    assignedTo: row.assigneeId,
    dateReported: toDay(row.reportedAt),
    photo: row.hasPhoto,
    history: row.history.map((h) => ({
      status: (h.newValue as Status) ?? "Submitted",
      date: toDay(h.createdAt),
      note: h.comment ?? "",
    })),
    feedback: row.feedback ? { rating: row.feedback.rating, comment: row.feedback.comment ?? "" } : null,
    reopened: row.reopenCount,
  };
}

// The database row for one history entry. offsetMs keeps entries from the same day in order.
const historyRow = (entry: HistoryEntry, offsetMs = 0) => ({
  action: historyAction(entry.status, entry.note),
  newValue: entry.status,
  comment: entry.note,
  createdAt: fromDay(entry.date, offsetMs),
});

// Newest first.
export async function listIssues(query: IssueQuery = {}): Promise<Issue[]> {
  const where: Prisma.MaintenanceIssueWhereInput = {
    ...(query.studentId ? { reporterId: query.studentId } : {}),
    ...(query.assignedTo ? { assigneeId: query.assignedTo } : {}),
    ...(query.status ? { status: statusToDb(query.status as Status) } : {}),
    ...(query.category ? { categoryId: query.category } : {}),
    ...(query.residence ? { block: { name: query.residence } } : {}),
  };
  const search = query.search?.trim();
  if (search) {
    const contains = { contains: search, mode: "insensitive" as const };
    where.OR = [
      { reference: contains },
      { title: contains },
      { description: contains },
      { roomNumber: contains },
      { reporter: { fullName: contains } },
    ];
  }
  const rows = await prisma.maintenanceIssue.findMany({ where, include: withDetails, orderBy: { reportedAt: "desc" } });
  return rows.map(toIssue);
}

export async function getIssue(id: string): Promise<Issue | undefined> {
  const row = await prisma.maintenanceIssue.findUnique({ where: { id }, include: withDetails });
  return row ? toIssue(row) : undefined;
}

export async function insertIssue(issue: Issue): Promise<Issue> {
  const block = await prisma.residenceBlock.findUnique({ where: { name: issue.residence } });
  if (!block) throw new Error(`Block ${issue.residence} not found`);
  const row = await prisma.maintenanceIssue.create({
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
      blockId: block.id,
      roomNumber: issue.room,
      hasPhoto: issue.photo,
      reopenCount: issue.reopened,
      reportedAt: fromDay(issue.dateReported),
      history: { create: issue.history.map((h, i) => ({ ...historyRow(h, i), userId: issue.studentId })) },
    },
    include: withDetails,
  });
  return toIssue(row);
}

// When an issue reaches a status, record the time it happened.
const STATUS_TIMESTAMP: Partial<Record<Status, "assignedAt" | "startedAt" | "resolvedAt" | "closedAt">> = {
  Assigned: "assignedAt",
  "In Progress": "startedAt",
  Resolved: "resolvedAt",
  Closed: "closedAt",
};

export async function updateIssue(id: string, changes: Partial<Issue>): Promise<Issue> {
  const current = await prisma.maintenanceIssue.findUnique({ where: { id }, include: { history: true, reporter: true } });
  if (!current) throw new Error(`Issue ${id} not found`);

  const data: Prisma.MaintenanceIssueUncheckedUpdateInput = {};
  if (changes.title !== undefined) data.title = changes.title;
  if (changes.description !== undefined) data.description = changes.description;
  if (changes.category !== undefined) data.categoryId = changes.category;
  if (changes.room !== undefined) data.roomNumber = changes.room;
  if (changes.priority !== undefined) data.priority = priorityToDb(changes.priority);
  if (changes.assignedTo !== undefined) data.assigneeId = changes.assignedTo;
  if (changes.photo !== undefined) data.hasPhoto = changes.photo;
  if (changes.reopened !== undefined) data.reopenCount = changes.reopened;
  if (changes.status !== undefined) {
    data.status = statusToDb(changes.status);
    const stamp = STATUS_TIMESTAMP[changes.status];
    if (stamp) data[stamp] = new Date();
  }
  if (changes.residence !== undefined) {
    const block = await prisma.residenceBlock.findUnique({ where: { name: changes.residence } });
    if (block) data.blockId = block.id;
  }

  // The workflow passes the whole history list; only entries added since the last save are new.
  const newEntries = changes.history ? changes.history.slice(current.history.length) : [];

  await prisma.$transaction(async (tx) => {
    await tx.maintenanceIssue.update({ where: { id }, data });
    if (newEntries.length) {
      await tx.issueHistory.createMany({
        data: newEntries.map((h, i) => ({ ...historyRow(h, i), issueId: id })),
      });
    }
    if (changes.feedback === null) {
      await tx.issueFeedback.deleteMany({ where: { issueId: id } });
    } else if (changes.feedback) {
      const feedback = { rating: changes.feedback.rating, comment: changes.feedback.comment || null };
      await tx.issueFeedback.upsert({
        where: { issueId: id },
        create: { issueId: id, userId: current.reporterId, ...feedback },
        update: feedback,
      });
    }
  });

  const updated = await getIssue(id);
  if (!updated) throw new Error(`Issue ${id} not found`);
  return updated;
}

// Reserves the next reference number, e.g. ISS-2026-00133. The counter is updated in one
// statement, so two students reporting at the same moment never get the same number.
export async function nextIssueRef(): Promise<string> {
  const rows = await prisma.$queryRaw<{ value: string }[]>`
    INSERT INTO system_settings (id, key, value, description, updated_at)
    VALUES (gen_random_uuid()::text, '_next_issue_number', '2', 'Next issue reference number', now())
    ON CONFLICT (key) DO UPDATE SET value = (system_settings.value::int + 1)::text, updated_at = now()
    RETURNING value`;
  const number = Number(rows[0].value) - 1;
  return `ISS-${new Date().getFullYear()}-${String(number).padStart(5, "0")}`;
}
