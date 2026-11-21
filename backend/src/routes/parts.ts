import { Router, type Request } from "express";
import { currentUser, requireAuth, requireRole } from "../middleware/auth.js";
import { badRequest, forbidden, HttpError, notFound, optionalString, requireString } from "../lib/http.js";
import { getCategory } from "../store/categories.js";
import { getIssue } from "../store/issues.js";
import { addNotification } from "../store/notifications.js";
import {
  findPartByName, getPart, insertPart, listMovements, listParts, removePart, restock, takeStock, updatePart, type PartDetails,
} from "../store/parts.js";
import { listUsers } from "../store/users.js";
import type { SparePart } from "../types.js";

// The parts store. Maintenance staff see the stock and take what they need for a job; the staff
// manager (role "admin") sees everything, adds new parts and restocks them.
export const partsRouter = Router();
partsRouter.use(requireAuth, requireRole("maintenance", "admin"));

const UNITS = ["each", "pack", "set", "box", "metre", "litre"];
const MAX_QUANTITY = 1000;

function readQuantity(body: Record<string, unknown>, field: string, min: number): number {
  const value = Number(body[field]);
  if (!Number.isInteger(value) || value < min || value > MAX_QUANTITY) {
    throw badRequest(`${field === "minQuantity" ? "Order level" : "Quantity"} must be a whole number from ${min} to ${MAX_QUANTITY}`);
  }
  return value;
}

async function readPart(req: Request): Promise<SparePart> {
  const part = await getPart(String(req.params.id));
  if (!part) throw notFound("Part not found");
  return part;
}

// Tells every staff manager. Used when stock runs low and when a technician asks for more.
async function tellManagers(message: string) {
  for (const manager of await listUsers("admin")) await addNotification(manager.id, message);
}

// Name, category, unit, order level and shelf, from the add and edit forms.
async function readDetails(body: Record<string, unknown>, partial: boolean): Promise<Partial<PartDetails>> {
  const details: Partial<PartDetails> = {};
  const name = partial ? optionalString(body, "name") : requireString(body, "name", "Name");
  if (name) {
    if (name.length > 80) throw badRequest("Name must be 80 characters or fewer");
    details.name = name;
  }
  if (body.category !== undefined) {
    const category = optionalString(body, "category") ?? "";
    if (category && !(await getCategory(category))) throw badRequest("Unknown category");
    details.category = category;
  }
  if (body.unit !== undefined || !partial) {
    const unit = optionalString(body, "unit") ?? "each";
    if (!UNITS.includes(unit)) throw badRequest(`Unit must be one of: ${UNITS.join(", ")}`);
    details.unit = unit;
  }
  if (body.minQuantity !== undefined || !partial) details.minQuantity = readQuantity(body, "minQuantity", 0);
  if (body.location !== undefined) details.location = (optionalString(body, "location") ?? "").slice(0, 80);
  return details;
}

// GET /api/parts — the stock, plus recent changes (a technician only sees their own).
partsRouter.get("/", async (req, res) => {
  const user = currentUser(req);
  const movements =
    user.role === "admin" ? await listMovements({ limit: 100 }) : await listMovements({ userId: user.id, limit: 30 });
  res.json({ parts: await listParts(), movements });
});

// POST /api/parts/:id/take — { quantity, issueId?, note? }. Maintenance takes parts for a job.
partsRouter.post("/:id/take", requireRole("maintenance"), async (req, res) => {
  const user = currentUser(req);
  const part = await readPart(req);
  const body = req.body ?? {};
  const quantity = readQuantity(body, "quantity", 1);
  const note = (optionalString(body, "note") ?? "").slice(0, 300);

  // The job is optional, but if given it must be one of this technician's own jobs.
  const issueId = optionalString(body, "issueId") ?? null;
  if (issueId) {
    const issue = await getIssue(issueId);
    if (!issue) throw notFound("Job not found");
    if (issue.assignedTo !== user.id) throw forbidden("You can only take parts for your own jobs");
  }

  const { part: after, before } = await takeStock(part.id, quantity, user.id, issueId, note);

  // Warn the staff manager once, when stock first drops to the order level (not on every take after).
  if (after.quantity === 0) {
    await tellManagers(`Out of stock: ${after.name}. ${user.name} took the last one — please restock.`);
  } else if (after.low && before > after.minQuantity) {
    await tellManagers(`Low stock: ${after.name}, only ${after.quantity} ${after.unit} left. Please order more.`);
  }
  res.json({ part: after });
});

// POST /api/parts/:id/request — maintenance asks the staff manager to restock a part.
partsRouter.post("/:id/request", requireRole("maintenance"), async (req, res) => {
  const user = currentUser(req);
  const part = await readPart(req);
  const note = (optionalString(req.body ?? {}, "note") ?? "").slice(0, 200);
  await tellManagers(
    `Restock request: ${part.name} (${part.quantity} ${part.unit} left), asked for by ${user.name}.` + (note ? ` “${note}”` : ""),
  );
  res.json({ ok: true });
});

// Adding, restocking, editing and removing parts are for the staff manager only.
partsRouter.use(requireRole("admin"));

// POST /api/parts/:id/restock — { quantity, note? }
partsRouter.post("/:id/restock", async (req, res) => {
  const part = await readPart(req);
  const body = req.body ?? {};
  const quantity = readQuantity(body, "quantity", 1);
  const note = (optionalString(body, "note") ?? "").slice(0, 300);
  res.json({ part: await restock(part.id, quantity, currentUser(req).id, note) });
});

// POST /api/parts — { name, category?, unit?, quantity, minQuantity, location? }
partsRouter.post("/", async (req, res) => {
  const body = req.body ?? {};
  const details = (await readDetails(body, false)) as PartDetails;
  details.category ??= "";
  details.location ??= "";
  if (await findPartByName(details.name)) throw new HttpError(409, "A part with this name is already in the store");
  const quantity = readQuantity(body, "quantity", 0);
  res.status(201).json({ part: await insertPart(details, quantity, currentUser(req).id) });
});

// PATCH /api/parts/:id — any of { name, category, unit, minQuantity, location }.
// Stock itself only changes by taking or restocking, so every change is in the log.
partsRouter.patch("/:id", async (req, res) => {
  const part = await readPart(req);
  const changes = await readDetails(req.body ?? {}, true);
  if (changes.name) {
    const clash = await findPartByName(changes.name);
    if (clash && clash.id !== part.id) throw new HttpError(409, "A part with this name is already in the store");
  }
  res.json({ part: await updatePart(part.id, changes) });
});

// DELETE /api/parts/:id
partsRouter.delete("/:id", async (req, res) => {
  const part = await readPart(req);
  await removePart(part.id);
  res.json({ ok: true });
});
