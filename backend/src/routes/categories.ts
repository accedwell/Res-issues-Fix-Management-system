import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { badRequest, HttpError, notFound, optionalString, requireString } from "../lib/http.js";
import { removeCategory } from "../services/admin.js";
import { getCategory, insertCategory, listCategories, updateCategory } from "../store/categories.js";

export const categoriesRouter = Router();

const toKey = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

// GET /api/categories — public, so the sign-up and report forms can show them.
categoriesRouter.get("/", async (_req, res) => {
  res.json({ categories: await listCategories() });
});

// Changes are for the system administrator only.
categoriesRouter.use(requireAuth, requireRole("sysadmin"));

// POST /api/categories — { name, icon? }
categoriesRouter.post("/", async (req, res) => {
  const body = req.body ?? {};
  const name = requireString(body, "name", "Name");
  const key = toKey(name);
  if (!key) throw badRequest("Name must contain letters or numbers");
  if (await getCategory(key)) throw new HttpError(409, "A category with this name already exists");
  const category = await insertCategory({ key, name, icon: optionalString(body, "icon") ?? "dots" });
  res.status(201).json({ category });
});

// PATCH /api/categories/:key — { name?, icon? }
categoriesRouter.patch("/:key", async (req, res) => {
  const key = String(req.params.key);
  if (!(await getCategory(key))) throw notFound("Category not found");
  const body = req.body ?? {};
  const changes: { name?: string; icon?: string } = {};
  const name = optionalString(body, "name");
  const icon = optionalString(body, "icon");
  if (name) changes.name = name;
  if (icon) changes.icon = icon;
  res.json({ category: await updateCategory(key, changes) });
});

// DELETE /api/categories/:key — reports in it move to "Other".
categoriesRouter.delete("/:key", async (req, res) => {
  res.json(await removeCategory(String(req.params.key)));
});
