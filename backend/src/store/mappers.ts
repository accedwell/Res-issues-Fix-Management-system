import type { HistoryAction, IssuePriority, IssueStatus, NotificationType, UserRole } from "../generated/prisma/client.js";
import type { Priority, Role, Status } from "../types.js";

// The app and the database name some values differently. These tables translate both ways.

const ROLE_TO_DB: Record<Role, UserRole> = { student: "STUDENT", maintenance: "MAINTENANCE", admin: "ADMIN", sysadmin: "SYSADMIN" };
const STATUS_TO_DB: Record<Status, IssueStatus> = {
  Submitted: "REPORTED",
  Received: "RECEIVED",
  Assigned: "ASSIGNED",
  "In Progress": "IN_PROGRESS",
  Resolved: "RESOLVED",
  Closed: "CLOSED",
};
const PRIORITY_TO_DB: Record<Priority, IssuePriority> = { Low: "LOW", Normal: "MEDIUM", High: "HIGH", Urgent: "URGENT" };

const invert = <A extends string, B extends string>(map: Record<A, B>) =>
  Object.fromEntries(Object.entries(map).map(([a, b]) => [b, a])) as Record<B, A>;

const ROLE_FROM_DB = invert(ROLE_TO_DB);
// "On hold" exists in the database but not in the app yet, so it shows as in progress.
const STATUS_FROM_DB: Record<IssueStatus, Status> = { ...invert(STATUS_TO_DB), ON_HOLD: "In Progress" };
const PRIORITY_FROM_DB = invert(PRIORITY_TO_DB);

export const roleToDb = (role: Role) => ROLE_TO_DB[role];
export const roleFromDb = (role: UserRole) => ROLE_FROM_DB[role];
export const statusToDb = (status: Status) => STATUS_TO_DB[status];
export const statusFromDb = (status: IssueStatus) => STATUS_FROM_DB[status];
export const priorityToDb = (priority: Priority) => PRIORITY_TO_DB[priority];
export const priorityFromDb = (priority: IssuePriority) => PRIORITY_FROM_DB[priority];

// The app shows dates as YYYY-MM-DD.
export const toDay = (date: Date) => date.toISOString().slice(0, 10);

// A YYYY-MM-DD day as a timestamp. Today's entries keep the real time so they stay in order.
export function fromDay(day: string, offsetMs = 0): Date {
  if (day === toDay(new Date())) return new Date(Date.now() + offsetMs);
  return new Date(new Date(day + "T12:00:00Z").getTime() + offsetMs);
}

// History rows record what kind of change it was, for reports.
export function historyAction(status: Status, note: string): HistoryAction {
  if (status === "Submitted") return "CREATED";
  if (status === "Assigned") return "ASSIGNED";
  if (status === "Resolved") return "RESOLVED";
  if (status === "Closed") return "CLOSED";
  if (/not fixed/i.test(note)) return "REOPENED";
  return "STATUS_CHANGED";
}

// Notifications need a type and short title in the database; both follow from the message.
export function notificationKind(message: string): { type: NotificationType; title: string } {
  if (/^New job/i.test(message)) return { type: "ISSUE_ASSIGNED", title: "New job" };
  if (/^New .*report/i.test(message)) return { type: "ISSUE_CREATED", title: "New report" };
  if (/re-opened/i.test(message)) return { type: "STATUS_UPDATED", title: "Report re-opened" };
  if (/confirmed fixed/i.test(message)) return { type: "ISSUE_CLOSED", title: "Fix confirmed" };
  if (/resolved/i.test(message)) return { type: "ISSUE_RESOLVED", title: "Marked resolved" };
  if (/assigned/i.test(message)) return { type: "ISSUE_ASSIGNED", title: "Report assigned" };
  if (/submitted/i.test(message)) return { type: "ISSUE_CREATED", title: "Report submitted" };
  return { type: "STATUS_UPDATED", title: "Report update" };
}
