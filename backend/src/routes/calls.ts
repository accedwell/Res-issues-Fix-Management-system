import { Router } from "express";
import { currentUser, requireAuth, requireRole } from "../middleware/auth.js";
import { forbidden, requireOneOf } from "../lib/http.js";
import { broadcast, sendToUser } from "../lib/events.js";
import { chatAccess } from "../services/chat.js";
import { getIssueFor } from "../services/issueWorkflow.js";
import { addNotification } from "../store/notifications.js";

// Voice calls inside a report's chat. The voice itself goes straight between the two browsers
// (WebRTC); the server only passes the set-up messages to the other person. Kept out of
// /api/issues on purpose: changes there make every browser reload, and a call sends many messages.
export const callsRouter = Router();
callsRouter.use(requireAuth, requireRole("student", "maintenance"));

const SIGNALS = ["ring", "answer", "ice", "end", "decline", "busy", "missed"] as const;
type Signal = (typeof SIGNALS)[number];

// POST /api/calls/:issueId — { type, data? } a call message for the other person on the report.
// Answers { delivered: false } when they are not online, so the caller can stop ringing.
callsRouter.post("/:issueId", async (req, res) => {
  const user = currentUser(req);
  const body = req.body ?? {};
  const type = requireOneOf<Signal>(body, "type", [...SIGNALS]);
  const issue = await getIssueFor(user, String(req.params.issueId));
  // Same people as the chat: the student and the assigned staff member, while the report is open.
  if (!chatAccess(user, issue).send) throw forbidden("You cannot call about this report");

  const to = user.id === issue.studentId ? issue.assignedTo : issue.studentId;
  if (!to) throw forbidden("You cannot call about this report");
  // Maintenance only ever sees "Student", never the student's name.
  const from = user.role === "student" ? "Student" : user.name;

  const delivered = sendToUser(to, "call", { issueId: issue.id, ref: issue.ref, from, type, data: body.data ?? null });

  // A call nobody picked up (or could not reach) is left in the bell, like a missed call on a phone.
  if (type === "missed" || (type === "ring" && !delivered)) {
    await addNotification(to, `Missed call from ${user.role === "student" ? "the student" : user.name} about ${issue.ref}.`, issue.id);
    broadcast(["notifications"]);
  }
  res.json({ delivered });
});
