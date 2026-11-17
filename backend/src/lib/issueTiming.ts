import { DONE_STATUSES, OVERDUE_AFTER_DAYS, type Issue } from "../types.js";

export const NOT_FIXED_NOTE = "Student reported the issue is NOT fixed: ";

// Resending keeps the original report but starts a fresh follow-up period.
export function followUpStartedAt(issue: Issue): string {
  const followUp = [...issue.history].reverse().find((entry) => entry.note.startsWith(NOT_FIXED_NOTE));
  return followUp?.at ?? followUp?.date ?? issue.reportedAt ?? issue.history[0]?.at ?? issue.dateReported;
}

export function isOverdue(issue: Issue, now = Date.now()): boolean {
  const started = Date.parse(followUpStartedAt(issue));
  return !DONE_STATUSES.includes(issue.status) && Number.isFinite(started)
    && now - started >= OVERDUE_AFTER_DAYS[issue.priority] * 24 * 60 * 60 * 1000;
}
