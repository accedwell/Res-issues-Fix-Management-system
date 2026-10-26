import { badRequest, forbidden, notFound, today } from "../lib/http.js";
import { getCategory, OTHER_CATEGORY } from "../store/categories.js";
import { newId } from "../store/db.js";
import { getIssue, insertIssue, listIssues, nextIssueRef, updateIssue, type IssueQuery } from "../store/issues.js";
import { addNotification } from "../store/notifications.js";
import { isSettingOn } from "../store/settings.js";
import { getUser, listUsers } from "../store/users.js";
import { recommendStaff } from "./assignment.js";
import { DONE_STATUSES, type Issue, type Priority, type Status, type User } from "../types.js";

// ===== Access rules =====

// Students see their own reports, maintenance staff see jobs assigned to them, admins see everything.
export function canView(user: User, issue: Issue): boolean {
  if (user.role === "student") return issue.studentId === user.id;
  if (user.role === "maintenance") return issue.assignedTo === user.id;
  return true;
}

export async function listIssuesFor(user: User, query: IssueQuery): Promise<Issue[]> {
  if (user.role === "student") return listIssues({ ...query, studentId: user.id });
  if (user.role === "maintenance") return listIssues({ ...query, assignedTo: user.id });
  return listIssues(query);
}

export async function getIssueFor(user: User, id: string): Promise<Issue> {
  const issue = await getIssue(id);
  if (!issue || !canView(user, issue)) throw notFound("Issue not found");
  return issue;
}

// ===== Helpers =====

function withStatus(issue: Issue, status: Status, note: string): Partial<Issue> {
  return { status, history: [...issue.history, { status, date: today(), note }] };
}

// Key updates (assigned, resolved, re-opened) always reach the student.
// Other status changes only do when the "Auto-notify students" setting is on.
async function notifyStudent(issue: Issue, message: string, important = false) {
  if (important || (await isSettingOn("notify"))) await addNotification(issue.studentId, message, issue.id);
}

// Every residence administrator gets these (new reports, fixes, re-opened jobs).
async function notifyAdmins(issue: Issue, message: string) {
  for (const admin of await listUsers("admin")) await addNotification(admin.id, message, issue.id);
}

async function notifyStaff(issue: Issue, message: string) {
  if (issue.assignedTo) await addNotification(issue.assignedTo, message, issue.id);
}

// ===== Workflow steps =====

export interface NewIssueInput {
  title: string;
  category: string;
  priority: Priority;
  residence: string;
  room: string;
  description: string;
  photo: boolean;
}

export async function createIssue(student: User, input: NewIssueInput): Promise<Issue> {
  const category = (await getCategory(input.category)) ? input.category : OTHER_CATEGORY;
  const issue: Issue = {
    id: newId("i"),
    ref: await nextIssueRef(),
    ...input,
    category,
    status: "Submitted",
    studentId: student.id,
    studentName: student.name,
    assignedTo: null,
    dateReported: today(),
    history: [{ status: "Submitted", date: today(), note: "Report submitted by student." }],
    feedback: null,
    reopened: 0,
  };
  await insertIssue(issue);
  await notifyStudent(issue, `Your report ${issue.ref} was submitted.`);
  const urgent = issue.priority === "Urgent" ? "URGENT " : "";
  await notifyAdmins(issue, `New ${urgent}report ${issue.ref}: ${issue.title} (${issue.residence}, ${issue.room}).`);
  return issue;
}

// Admin acknowledges a newly submitted report.
export async function receiveIssue(id: string): Promise<Issue> {
  const issue = await getIssue(id);
  if (!issue) throw notFound("Issue not found");
  if (issue.status !== "Submitted") throw badRequest("Only newly submitted reports can be marked as received");
  const updated = await updateIssue(id, withStatus(issue, "Received", "Reviewed by residence administrator."));
  await notifyStudent(updated, `${issue.ref} was received.`);
  return updated;
}

// Admin assigns maintenance staff. Without a staffId, the system picks the best match for the job.
export async function assignIssue(id: string, staffId?: string, priority?: Priority): Promise<Issue> {
  const issue = await getIssue(id);
  if (!issue) throw notFound("Issue not found");
  if (DONE_STATUSES.includes(issue.status)) throw badRequest("This issue is already resolved or closed");

  let staff: Pick<User, "id" | "name" | "specialization"> | undefined;
  if (staffId) {
    const user = await getUser(staffId);
    if (!user || user.role !== "maintenance") throw badRequest("That person is not maintenance staff");
    staff = user;
  } else {
    staff = await recommendStaff(issue);
    if (!staff) throw badRequest("There is no maintenance staff to assign this to");
  }

  const note = `Assigned to ${staff.name} (${staff.specialization}) by residence administrator.`;
  const updated = await updateIssue(id, {
    assignedTo: staff.id,
    priority: priority ?? issue.priority,
    ...withStatus(issue, "Assigned", note),
  });
  await notifyStudent(updated, `${issue.ref} has been assigned to ${staff.name}.`, true);
  await notifyStaff(updated, `New job: ${issue.ref} — ${issue.title} (${issue.residence}, ${issue.room}).`);
  return updated;
}

export const PROGRESS_STATUSES: Status[] = ["In Progress", "Resolved"];

// Maintenance staff (on their own jobs) or an admin record progress.
export async function updateProgress(user: User, id: string, status: Status, note?: string): Promise<Issue> {
  const issue = await getIssue(id);
  if (!issue) throw notFound("Issue not found");
  if (user.role === "maintenance" && issue.assignedTo !== user.id) throw forbidden("This job is not assigned to you");
  if (!issue.assignedTo) throw badRequest("Assign the issue to maintenance staff first");
  if (DONE_STATUSES.includes(issue.status)) throw badRequest("This issue is already resolved or closed");

  const text = note || (status === "Resolved" ? "Issue marked as resolved." : "Progress updated.");
  const updated = await updateIssue(id, withStatus(issue, status, text));
  if (status === "Resolved") {
    await notifyStudent(updated, `${issue.ref} has been marked Resolved — please confirm it is fixed.`, true);
    await notifyAdmins(updated, `${issue.ref} — ${issue.title} was marked Resolved by ${user.name}.`);
  } else {
    await notifyStudent(updated, `${issue.ref} is now ${status}.`);
  }
  return updated;
}

// Student confirms the fix and rates the service.
export async function confirmResolution(student: User, id: string, rating: number, comment: string): Promise<Issue> {
  const issue = await getIssueFor(student, id);
  if (issue.status !== "Resolved") throw badRequest("Only resolved issues can be confirmed");
  const updated = await updateIssue(id, {
    feedback: { rating, comment },
    ...withStatus(issue, "Closed", "Student confirmed resolution and left feedback."),
  });
  const message = `${issue.ref} — ${issue.title} was confirmed fixed by the student (rated ${rating}/5).`;
  await notifyStaff(updated, message);
  await notifyAdmins(updated, message);
  return updated;
}

// Student reports that a resolved or closed issue is still not fixed (or has come back).
export async function reportNotFixed(student: User, id: string, reason: string): Promise<Issue> {
  const issue = await getIssueFor(student, id);
  if (!DONE_STATUSES.includes(issue.status)) throw badRequest("This issue is still being worked on");

  const updated = await updateIssue(id, {
    reopened: issue.reopened + 1,
    // Clear earlier feedback so the student can rate the new fix.
    feedback: null,
    ...withStatus(issue, "In Progress", "Student reported the issue is NOT fixed: " + reason),
  });
  await notifyStudent(updated, `${issue.ref} was re-opened and sent back to maintenance.`, true);
  await notifyStaff(updated, `Re-opened: ${issue.ref} — ${issue.title}. Student says: ${reason}`);
  await notifyAdmins(updated, `Re-opened: ${issue.ref} — ${issue.title}. Student says it is not fixed.`);
  return updated;
}
