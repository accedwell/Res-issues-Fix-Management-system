import prisma from "../lib/prisma.js";
import { badRequest, forbidden, notFound } from "../lib/http.js";
import { getIssue, updateIssue } from "../store/issues.js";
import { notificationKind } from "../store/mappers.js";
import { getUser, listUsers } from "../store/users.js";
import { recommendStaff } from "./assignment.js";
import { assignIssue, notifyAdmins, notifyStaff, notifyStudent, withStatus } from "./issueWorkflow.js";
import { DONE_STATUSES, type Issue, type User } from "../types.js";

// Accepting a job. A newly assigned job waits for its technician to accept or decline it. If they do
// neither within ACCEPT_WITHIN_MINUTES, the supervisor and the system admin are told to phone them
// (they may not have a smartphone with them), and can then mark it accepted for them or reassign it.

export const ACCEPT_WITHIN_MINUTES = 2;

const DECLINED_PREFIX = "Declined by ";

async function openJobFor(user: User, id: string): Promise<Issue> {
  const issue = await getIssue(id);
  if (!issue) throw notFound("Issue not found");
  if (issue.assignedTo !== user.id) throw forbidden("This job is not assigned to you");
  if (DONE_STATUSES.includes(issue.status)) throw badRequest("This issue is already resolved or closed");
  return issue;
}

const waitedTooLong = (issue: Issue) =>
  !!issue.assignedAt && Date.now() - Date.parse(issue.assignedAt) >= ACCEPT_WITHIN_MINUTES * 60_000;

const acceptedNow = (issue: Issue, note: string): Partial<Issue> => ({
  acceptedAt: new Date().toISOString(),
  ...withStatus(issue, issue.status, note),
});

// The technician accepts the job assigned to them. Accepting twice changes nothing.
export async function acceptJob(user: User, id: string): Promise<Issue> {
  const issue = await openJobFor(user, id);
  if (issue.acceptedAt) return issue;
  const updated = await updateIssue(id, acceptedNow(issue, `Accepted by ${user.name}.`));
  await notifyStudent(updated, `${issue.ref}: ${user.name} accepted the job and will be working on it.`, true);
  // The managers were already told to call; let them know they no longer need to.
  if (waitedTooLong(issue)) await notifyAdmins(updated, `Accepted: ${user.name} accepted ${issue.ref} — ${issue.title}. No need to call.`);
  return updated;
}

// The supervisor (or system admin) phoned the technician, who agreed to do the job.
export async function confirmAcceptedByPhone(manager: User, id: string): Promise<Issue> {
  const issue = await getIssue(id);
  if (!issue) throw notFound("Issue not found");
  if (!issue.assignedTo) throw badRequest("Nobody is assigned to this job");
  if (DONE_STATUSES.includes(issue.status)) throw badRequest("This issue is already resolved or closed");
  if (issue.acceptedAt) return issue;
  const tech = await getUser(issue.assignedTo);
  const name = tech?.name ?? "the technician";
  const updated = await updateIssue(id, acceptedNow(issue, `Accepted by ${name} over the phone (recorded by ${manager.name}).`));
  await notifyStaff(updated, `Accepted: ${manager.name} recorded that you accepted ${issue.ref} — ${issue.title} over the phone.`);
  await notifyStudent(updated, `${issue.ref}: ${name} accepted the job and will be working on it.`, true);
  return updated;
}

// The technician turns the job down. It goes to the next suitable technician on duty who has not
// already declined it; if there is nobody, it waits for the staff manager.
export async function declineJob(user: User, id: string, reason: string): Promise<Issue> {
  const issue = await openJobFor(user, id);
  if (issue.acceptedAt) {
    throw badRequest("You already accepted this job. Ask the staff manager to reassign it, or hand it back when you clock out");
  }
  const declined = await updateIssue(id, {
    assignedTo: null,
    acceptedAt: null,
    ...withStatus(issue, "Received", `${DECLINED_PREFIX}${user.name}: ${reason}`),
  });

  const declinedNames = new Set(
    declined.history.filter((h) => h.note.startsWith(DECLINED_PREFIX)).map((h) => h.note.slice(DECLINED_PREFIX.length).split(":")[0]),
  );
  const exclude = (await listUsers("maintenance")).filter((s) => declinedNames.has(s.name)).map((s) => s.id);
  const next = await recommendStaff(declined, { onDutyOnly: true, exclude });
  const urgent = issue.priority === "Urgent" ? "URGENT " : "";

  if (next) {
    const reassigned = await assignIssue(id, next.id, undefined, `automatically after ${user.name} declined`);
    await notifyAdmins(reassigned, `Declined: ${user.name} declined ${urgent}${issue.ref} — ${issue.title} (“${reason}”). It was passed to ${next.name}.`);
    return reassigned;
  }
  await notifyAdmins(declined, `Declined: ${user.name} declined ${urgent}${issue.ref} — ${issue.title} (“${reason}”). Nobody else on duty can take it; please assign it.`);
  return declined;
}

// Run every half minute. For each job that has waited ACCEPT_WITHIN_MINUTES without being accepted,
// tells every staff manager and system admin (and reminds the technician) once per assignment:
// the notification ids are fixed, so a second run skips them.
export async function alertUnacceptedJobs(): Promise<number> {
  const cutoff = new Date(Date.now() - ACCEPT_WITHIN_MINUTES * 60_000);
  const waiting = await prisma.maintenanceIssue.findMany({
    where: { assigneeId: { not: null }, acceptedAt: null, assignedAt: { lte: cutoff }, status: { notIn: ["RESOLVED", "CLOSED"] } },
    select: {
      id: true,
      reference: true,
      title: true,
      priority: true,
      roomNumber: true,
      location: true,
      assignedAt: true,
      block: { select: { name: true } },
      assignee: { select: { id: true, fullName: true, phone: true } },
    },
  });
  if (!waiting.length) return 0;
  const supervisors = await listUsers("supervisor");
  const managers = [...(supervisors.length ? supervisors : await listUsers("admin")), ...(await listUsers("sysadmin"))];

  let sent = 0;
  for (const job of waiting) {
    if (!job.assignee || !job.assignedAt) continue;
    const offer = `${job.id}-${job.assignedAt.getTime()}`;
    const urgent = job.priority === "URGENT" ? "URGENT " : "";
    const place = job.roomNumber ?? job.location ?? "";
    const call = job.assignee.phone ? `Please call them on ${job.assignee.phone}` : "Please call them";
    const message =
      `Not accepted: ${job.assignee.fullName} has not accepted ${urgent}${job.reference} — ${job.title} (${job.block.name}, ${place}) ` +
      `after ${ACCEPT_WITHIN_MINUTES} minutes. ${call}; they may not have a smartphone with them. Then mark it accepted or reassign it.`;
    const reminder = `Please accept or decline ${job.reference} — ${job.title}. The staff manager has been told it is waiting.`;
    const { count } = await prisma.notification.createMany({
      data: [
        ...managers.map((m) => ({ id: `unaccepted-${offer}-${m.id}`, userId: m.id, issueId: job.id, message, ...notificationKind(message) })),
        { id: `unaccepted-${offer}-${job.assignee.id}`, userId: job.assignee.id, issueId: job.id, message: reminder, ...notificationKind(reminder) },
      ],
      skipDuplicates: true,
    });
    if (count) sent++;
  }
  return sent;
}
