import { Router } from "express";
import { currentUser, requireAuth, requireRole } from "../middleware/auth.js";
import { badRequest, optionalString, requireOneOf, requireString } from "../lib/http.js";
import { recommendStaff, staffWorkload } from "../services/assignment.js";
import {
  assignIssue,
  confirmResolution,
  createIssue,
  getIssueFor,
  listIssuesFor,
  PROGRESS_STATUSES,
  receiveIssue,
  reportNotFixed,
  updateProgress,
} from "../services/issueWorkflow.js";
import { listBlocks } from "../store/settings.js";
import { getUser } from "../store/users.js";
import { PRIORITIES, type Issue, type Priority } from "../types.js";

export const issuesRouter = Router();
issuesRouter.use(requireAuth);

// Adds the assigned staff member's name, so every role can show who is working on it.
async function present(issue: Issue) {
  const staff = issue.assignedTo ? await getUser(issue.assignedTo) : undefined;
  return { ...issue, assignedToName: staff?.name ?? null };
}

const param = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";

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
  res.json({ issues: await Promise.all(issues.map(present)) });
});

// GET /api/issues/:id
issuesRouter.get("/:id", async (req, res) => {
  res.json({ issue: await present(await getIssueFor(currentUser(req), param(req.params.id))) });
});

// POST /api/issues — student reports a new issue.
issuesRouter.post("/", requireRole("student"), async (req, res) => {
  const body = req.body ?? {};
  const residence = requireString(body, "residence", "Block");
  if (!(await listBlocks()).includes(residence)) throw badRequest("Unknown block");

  const issue = await createIssue(currentUser(req), {
    title: requireString(body, "title", "Title"),
    category: requireString(body, "category", "Category"),
    priority: body.priority === undefined ? "Normal" : requireOneOf(body, "priority", PRIORITIES),
    residence,
    room: requireString(body, "room", "Room / location"),
    description: requireString(body, "description", "Description"),
    photo: body.photo === true,
  });
  res.status(201).json({ issue: await present(issue) });
});

// POST /api/issues/:id/receive — admin acknowledges a new report.
issuesRouter.post("/:id/receive", requireRole("admin"), async (req, res) => {
  res.json({ issue: await present(await receiveIssue(param(req.params.id))) });
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
  res.json({ issue: await present(await assignIssue(param(req.params.id), staffId, priority)) });
});

// POST /api/issues/:id/progress — { status: "In Progress" | "Resolved", note? }
issuesRouter.post("/:id/progress", requireRole("maintenance", "admin"), async (req, res) => {
  const body = req.body ?? {};
  const status = requireOneOf(body, "status", PROGRESS_STATUSES);
  const issue = await updateProgress(currentUser(req), param(req.params.id), status, optionalString(body, "note"));
  res.json({ issue: await present(issue) });
});

// POST /api/issues/:id/confirm — { rating: 1-5, comment? } student confirms the fix.
issuesRouter.post("/:id/confirm", requireRole("student"), async (req, res) => {
  const body = req.body ?? {};
  const rating = Number(body.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw badRequest("Rating must be a whole number from 1 to 5");
  const issue = await confirmResolution(currentUser(req), param(req.params.id), rating, optionalString(body, "comment") ?? "");
  res.json({ issue: await present(issue) });
});

// POST /api/issues/:id/not-fixed — { reason } student says it is still not fixed.
issuesRouter.post("/:id/not-fixed", requireRole("student"), async (req, res) => {
  const reason = requireString(req.body ?? {}, "reason", "Reason");
  res.json({ issue: await present(await reportNotFixed(currentUser(req), param(req.params.id), reason)) });
});
