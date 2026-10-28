import { Router, type Request } from "express";
import { currentUser, requireAuth, requireRole } from "../middleware/auth.js";
import { badRequest, notFound, optionalString, requireOneOf, requireString } from "../lib/http.js";
import { recommendStaff, staffWorkload } from "../services/assignment.js";
import { chatSummaries, getChat, sendMessage } from "../services/chat.js";
import {
  assignIssue,
  confirmResolution,
  cancelReport,
  createIssue,
  editReport,
  findSimilarOpen,
  getIssueFor,
  listIssuesFor,
  PROGRESS_STATUSES,
  receiveIssue,
  reportNotFixed,
  updateProgress,
} from "../services/issueWorkflow.js";
import { getPhoto } from "../store/issues.js";
import { listBlocks } from "../store/settings.js";
import { getUser } from "../store/users.js";
import { PRIORITIES, SHARED_PLACES, type Issue, type Priority } from "../types.js";

export const issuesRouter = Router();
issuesRouter.use(requireAuth);

type ChatSummaries = Awaited<ReturnType<typeof chatSummaries>>;

// Adds the assigned staff member's name, so every role can show who is working on it, and the chat
// summary (can send, unread count) when the viewer may see the chat.
// Maintenance staff never get the student's name or id, so they cannot tell who rated them.
async function present(req: Request, issue: Issue, chats?: ChatSummaries) {
  const staff = issue.assignedTo ? await getUser(issue.assignedTo) : undefined;
  const hideStudent = currentUser(req).role === "maintenance";
  const chat = (chats ?? (await chatSummaries(currentUser(req), [issue]))).get(issue.id) ?? null;
  return {
    ...issue,
    ...(hideStudent ? { studentId: "", studentName: "" } : {}),
    assignedToName: staff?.name ?? null,
    chat,
  };
}

const param = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";

// Where a student's report is: their own room or a shared place in their block, never another room.
// When editing, the location the report already had is also kept as valid.
function studentRoom(req: Request, body: Record<string, unknown>, current?: string) {
  const room = requireString(body, "room", "Room / location");
  const own = currentUser(req).room;
  if (!own || room === own || room === current || SHARED_PLACES.includes(room)) return room;
  throw badRequest("You can only report your own room or a shared place in your block");
}

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
// The first bytes of each allowed image type, so a renamed file of another kind is refused.
const PHOTO_SIGNATURES: Record<string, (b: Buffer) => boolean> = {
  "image/jpeg": (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  "image/png": (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  "image/webp": (b) => b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP",
};

// An optional photo sent as { mimeType, data } where data is base64.
function readPhoto(value: unknown): { mimeType: string; data: Buffer } | undefined {
  if (value === undefined || value === null || typeof value === "boolean") return undefined;
  const { mimeType, data } = value as { mimeType?: unknown; data?: unknown };
  const isImage = typeof mimeType === "string" ? PHOTO_SIGNATURES[mimeType] : undefined;
  if (!isImage || typeof data !== "string") throw badRequest("The photo must be a JPEG, PNG or WebP image");
  const bytes = Buffer.from(data, "base64");
  if (!bytes.length || bytes.length > MAX_PHOTO_BYTES) throw badRequest("The photo must be smaller than 5 MB");
  if (!isImage(bytes)) throw badRequest("That file is not a valid image");
  return { mimeType: mimeType as string, data: bytes };
}

// GET /api/issues?status=&category=&residence=&search=
// Students get their own reports, maintenance staff their jobs, admins everything.
issuesRouter.get("/", async (req, res) => {
  const q = req.query as Record<string, string | undefined>;
  const issues = await listIssuesFor(currentUser(req), {
    status: q.status,
    category: q.category,
    residence: q.residence,
    search: q.search,
  });
  const chats = await chatSummaries(currentUser(req), issues);
  res.json({ issues: await Promise.all(issues.map((issue) => present(req, issue, chats))) });
});

// GET /api/issues/similar?category=&residence=&room= — open reports of the same kind in that block,
// so a student can see it was already reported before reporting it again. No names are included.
issuesRouter.get("/similar", async (req, res) => {
  const q = req.query as Record<string, string | undefined>;
  // Students only ever look in their own block.
  const residence = currentUser(req).role === "student" ? currentUser(req).block : q.residence;
  if (!q.category || !residence) throw badRequest("Category and block are needed");
  res.json({ similar: await findSimilarOpen(currentUser(req), q.category, residence, q.room ?? "") });
});

// GET /api/issues/:id
issuesRouter.get("/:id", async (req, res) => {
  res.json({ issue: await present(req, await getIssueFor(currentUser(req), param(req.params.id))) });
});

// POST /api/issues — student reports a new issue.
issuesRouter.post("/", requireRole("student"), async (req, res) => {
  const body = req.body ?? {};
  // Students always report in the block they registered with.
  const residence = currentUser(req).block ?? requireString(body, "residence", "Block");
  if (!(await listBlocks()).includes(residence)) throw badRequest("Unknown block");

  const issue = await createIssue(currentUser(req), {
    title: requireString(body, "title", "Title"),
    category: requireString(body, "category", "Category"),
    priority: body.priority === undefined ? "Normal" : requireOneOf(body, "priority", PRIORITIES),
    residence,
    room: studentRoom(req, body),
    description: requireString(body, "description", "Description"),
    photo: readPhoto(body.photo),
  });
  res.status(201).json({ issue: await present(req, issue) });
});

// GET /api/issues/:id/photo — the report's photo, for anyone allowed to see the report.
issuesRouter.get("/:id/photo", async (req, res) => {
  const issue = await getIssueFor(currentUser(req), param(req.params.id));
  const photo = await getPhoto(issue.id);
  if (!photo) throw notFound("This report has no photo");
  res.set({ "Content-Type": photo.mimeType, "Cache-Control": "private, max-age=3600", "X-Content-Type-Options": "nosniff" });
  res.send(photo.data);
});

// PATCH /api/issues/:id — the student changes their report, while it is still Submitted.
issuesRouter.patch("/:id", requireRole("student"), async (req, res) => {
  const body = req.body ?? {};
  // Students always report in the block they registered with.
  const residence = currentUser(req).block ?? requireString(body, "residence", "Block");
  if (!(await listBlocks()).includes(residence)) throw badRequest("Unknown block");
  const before = await getIssueFor(currentUser(req), param(req.params.id));
  const issue = await editReport(currentUser(req), param(req.params.id), {
    title: requireString(body, "title", "Title"),
    category: requireString(body, "category", "Category"),
    priority: requireOneOf(body, "priority", PRIORITIES),
    residence,
    room: studentRoom(req, body, before.room),
    description: requireString(body, "description", "Description"),
  });
  res.json({ issue: await present(req, issue) });
});

// DELETE /api/issues/:id — the student cancels their report, while it is still Submitted.
issuesRouter.delete("/:id", requireRole("student"), async (req, res) => {
  await cancelReport(currentUser(req), param(req.params.id));
  res.status(204).end();
});

// POST /api/issues/:id/receive — admin acknowledges a new report.
issuesRouter.post("/:id/receive", requireRole("admin"), async (req, res) => {
  res.json({ issue: await present(req, await receiveIssue(param(req.params.id))) });
});

// GET /api/issues/:id/recommended-staff — who the system would assign, plus everyone's workload.
issuesRouter.get("/:id/recommended-staff", requireRole("admin"), async (req, res) => {
  const issue = await getIssueFor(currentUser(req), param(req.params.id));
  res.json({ recommended: (await recommendStaff(issue)) ?? null, staff: await staffWorkload() });
});

// POST /api/issues/:id/assign — { staffId?, priority? }. Leave out staffId to auto-assign by job.
issuesRouter.post("/:id/assign", requireRole("admin"), async (req, res) => {
  const body = req.body ?? {};
  const staffId = optionalString(body, "staffId");
  const priority = body.priority === undefined ? undefined : requireOneOf<Priority>(body, "priority", PRIORITIES);
  res.json({ issue: await present(req, await assignIssue(param(req.params.id), staffId, priority)) });
});

// POST /api/issues/:id/progress — { status: "In Progress" | "Not Resolved" | "Resolved", note? }. "Not Resolved" needs a note.
issuesRouter.post("/:id/progress", requireRole("maintenance", "admin"), async (req, res) => {
  const body = req.body ?? {};
  const status = requireOneOf(body, "status", PROGRESS_STATUSES);
  const issue = await updateProgress(currentUser(req), param(req.params.id), status, optionalString(body, "note"));
  res.json({ issue: await present(req, issue) });
});

// POST /api/issues/:id/confirm — { rating?: 1-5, comment? } student confirms the fix. Rating is optional.
issuesRouter.post("/:id/confirm", requireRole("student"), async (req, res) => {
  const body = req.body ?? {};
  const rating = body.rating === undefined || body.rating === null ? null : Number(body.rating);
  if (rating !== null && (!Number.isInteger(rating) || rating < 1 || rating > 5)) throw badRequest("Rating must be a whole number from 1 to 5");
  const issue = await confirmResolution(currentUser(req), param(req.params.id), rating, optionalString(body, "comment") ?? "");
  res.json({ issue: await present(req, issue) });
});

// POST /api/issues/:id/not-fixed — { reason } student says it is still not fixed.
issuesRouter.post("/:id/not-fixed", requireRole("student"), async (req, res) => {
  const reason = requireString(req.body ?? {}, "reason", "Reason");
  res.json({ issue: await present(req, await reportNotFixed(currentUser(req), param(req.params.id), reason)) });
});

// GET /api/issues/:id/messages — the chat between the student and the assigned staff member.
// Opening it marks the other person's messages as read.
issuesRouter.get("/:id/messages", async (req, res) => {
  res.json(await getChat(currentUser(req), param(req.params.id)));
});

// POST /api/issues/:id/messages — { body } send a chat message.
issuesRouter.post("/:id/messages", requireRole("student", "maintenance"), async (req, res) => {
  await sendMessage(currentUser(req), param(req.params.id), requireString(req.body ?? {}, "body", "Message"));
  res.status(201).json(await getChat(currentUser(req), param(req.params.id)));
});
