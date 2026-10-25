import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { badRequest, notFound } from "../lib/http.js";
import { listBlocks, listSettings, setSetting } from "../store/settings.js";
import { PRIORITIES, STATUSES } from "../types.js";

export const settingsRouter = Router();

// GET /api/settings/meta — public lists the forms need (blocks, statuses, priorities).
settingsRouter.get("/meta", async (_req, res) => {
  res.json({ blocks: await listBlocks(), statuses: STATUSES, priorities: PRIORITIES });
});

settingsRouter.use(requireAuth, requireRole("sysadmin"));

// GET /api/settings
settingsRouter.get("/", async (_req, res) => {
  res.json({ settings: await listSettings() });
});

// PATCH /api/settings/:key — { on: boolean }
settingsRouter.patch("/:key", async (req, res) => {
  const on = req.body?.on;
  if (typeof on !== "boolean") throw badRequest("on must be true or false");
  const setting = await setSetting(String(req.params.key), on);
  if (!setting) throw notFound("Setting not found");
  res.json({ setting });
});
