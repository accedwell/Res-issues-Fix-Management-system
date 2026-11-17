import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { isOverdue as serverOverdue, NOT_FIXED_NOTE } from "../src/lib/issueTiming.js";
import { isOverdue as clientOverdue, canReportNotFixed } from "../../frontend/resifix/src/utils.ts";
import type { Issue, Priority, Status } from "../src/types.js";

const reportedAt = "2026-11-16T23:30:00+02:00";
const reported = Date.parse(reportedAt);
const day = 24 * 60 * 60 * 1000;
const issue: Issue = {
  id: "test", ref: "TEST-1", title: "Leaking tap", category: "plumbing", description: "Test",
  residence: "Block A", room: "204", priority: "Normal", status: "Submitted", studentId: "student",
  studentName: "Student", assignedTo: null, dateReported: "2026-11-16", reportedAt,
  history: [{ status: "Submitted", date: "2026-11-16", at: new Date(reported).toISOString(), note: "Report submitted by student." }],
  photo: false, feedback: null, reopened: 0,
};

test("follow-up unlocks at exactly 24 elapsed hours, across midnight and time zones", () => {
  for (const priority of ["Low", "Normal", "High", "Urgent"] as Priority[]) {
    for (const elapsed of [1 * 60 * 60 * 1000, day - 1, day, day + 1]) {
      const clock = mock.method(Date, "now", () => reported + elapsed);
      try {
        const report = { ...issue, priority };
        assert.equal(serverOverdue(report), elapsed >= day);
        assert.equal(clientOverdue(report), elapsed >= day);
        assert.equal(canReportNotFixed(report), elapsed >= day);
        assert.equal([report].filter(clientOverdue).length, elapsed >= day ? 1 : 0);
      } finally { clock.mock.restore(); }
    }
  }
});

test("unresolved stages can be followed up; resolved and closed reports have no overdue reminder", () => {
  const clock = mock.method(Date, "now", () => reported + 2 * day);
  try {
    for (const status of ["Submitted", "Received", "Assigned", "In Progress", "Not Resolved", "Resolved", "Closed"] as Status[]) {
      const report = { ...issue, status };
      const unresolved = status !== "Resolved" && status !== "Closed";
      assert.equal(serverOverdue(report), unresolved);
      assert.equal(clientOverdue(report), unresolved);
      // A student can still dispute a claimed repair immediately.
      assert.equal(canReportNotFixed(report), true);
    }
  } finally { clock.mock.restore(); }
});

test("sending again starts a fresh 24 hours; ordinary staff progress does not reset the deadline", () => {
  const followUpAt = reported + 2 * day;
  const report: Issue = { ...issue, reopened: 1, history: [...issue.history,
    { status: "Submitted", date: "2026-11-18", at: new Date(followUpAt).toISOString(), note: NOT_FIXED_NOTE + "Still leaking." },
    { status: "Received", date: "2026-11-18", at: new Date(followUpAt + 60_000).toISOString(), note: "Received by administrator." },
  ] };
  for (const elapsed of [0, day - 1, day]) {
    const clock = mock.method(Date, "now", () => followUpAt + elapsed);
    try {
      assert.equal(serverOverdue(report), elapsed >= day);
      assert.equal(clientOverdue(report), elapsed >= day);
    } finally { clock.mock.restore(); }
  }
});

test("older API records use their history timestamp; invalid dates never unlock follow-up", () => {
  const clock = mock.method(Date, "now", () => reported + day - 1);
  try {
    assert.equal(serverOverdue({ ...issue, reportedAt: undefined }), false);
    assert.equal(clientOverdue({ ...issue, reportedAt: undefined }), false);
    const invalid = { ...issue, reportedAt: "invalid", history: [] };
    assert.equal(serverOverdue(invalid), false);
    assert.equal(clientOverdue(invalid), false);
  } finally { clock.mock.restore(); }
});
