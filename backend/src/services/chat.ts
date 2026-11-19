import { badRequest, forbidden } from "../lib/http.js";
import { addMessage, chatCounts, listMessages, markMessagesRead } from "../store/messages.js";
import { addNotification } from "../store/notifications.js";
import { getUser } from "../store/users.js";
import type { Issue, User } from "../types.js";
import { getIssueFor } from "./issueWorkflow.js";

const MAX_MESSAGE = 1000;

// The student and the staff member assigned to the report chat; admins can read but not write.
// The chat starts once the report is assigned and becomes read-only when it is closed.
export function chatAccess(user: User, issue: Issue): { read: boolean; send: boolean } {
  if (!issue.assignedTo) return { read: false, send: false };
  const isParticipant =
    (user.role === "student" && issue.studentId === user.id) || (user.role === "maintenance" && issue.assignedTo === user.id);
  if (isParticipant) return { read: true, send: issue.status !== "Closed" };
  return { read: user.role === "admin", send: false };
}

// What each report row needs: whether the viewer may chat, and the unread count for the chat icon.
export async function chatSummaries(user: User, issues: Issue[]) {
  const readable = issues.filter((i) => chatAccess(user, i).read);
  const counts = await chatCounts(readable.map((i) => i.id), user.id);
  const summaries = new Map<string, { canSend: boolean; total: number; unread: number }>();
  for (const issue of readable) {
    const c = counts.get(issue.id) ?? { total: 0, unread: 0 };
    // Admins only read, so nothing is "unread" for them.
    summaries.set(issue.id, { canSend: chatAccess(user, issue).send, total: c.total, unread: user.role === "admin" ? 0 : c.unread });
  }
  return summaries;
}

// The conversation, oldest first. Opening it marks the other person's messages as read.
// Maintenance staff see the student only as "Student", so they cannot tell who it is.
export async function getChat(user: User, id: string) {
  const issue = await getIssueFor(user, id);
  const access = chatAccess(user, issue);
  if (!access.read) throw forbidden("There is no chat on this report yet");
  if (user.role !== "admin") await markMessagesRead(issue.id, user.id);

  const staff = issue.assignedTo ? await getUser(issue.assignedTo) : undefined;
  const nameOf = (senderId: string) => {
    if (senderId === user.id) return "You";
    if (senderId === issue.studentId) return user.role === "maintenance" ? "Student" : issue.studentName;
    return staff?.name ?? "Maintenance";
  };
  const messages = (await listMessages(issue.id)).map((m) => ({
    id: m.id,
    body: m.body,
    at: m.at,
    mine: m.senderId === user.id,
    from: nameOf(m.senderId),
  }));
  return { messages, canSend: access.send };
}

export async function sendMessage(user: User, id: string, text: string): Promise<void> {
  const issue = await getIssueFor(user, id);
  if (!chatAccess(user, issue).send) throw forbidden("You cannot send messages on this report");
  const body = text.trim();
  if (!body) throw badRequest("Type a message first");
  if (body.length > MAX_MESSAGE) throw badRequest(`Messages can be at most ${MAX_MESSAGE} characters`);

  const to = user.id === issue.studentId ? issue.assignedTo : issue.studentId;
  // Only the first unread message in a chat goes to the bell, so a conversation does not flood it.
  const hadUnread = to ? ((await chatCounts([issue.id], to)).get(issue.id)?.unread ?? 0) > 0 : true;
  await addMessage(issue.id, user.id, body);
  if (to && !hadUnread) {
    const from = user.role === "student" ? "the student" : user.name;
    await addNotification(to, `New message from ${from} on ${issue.ref}: “${body.length > 60 ? body.slice(0, 57) + "…" : body}”`, issue.id);
  }
}
