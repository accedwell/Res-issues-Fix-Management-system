import prisma from "../lib/prisma.js";
import type { Category } from "../types.js";

// The fallback category. It always exists and always stays last in the list.
export const OTHER_CATEGORY = "other";

// A category's database id is its key (e.g. "plumbing"), so issues can refer to it directly.
const toCategory = (row: { id: string; name: string; icon: string }): Category => ({ key: row.id, name: row.name, icon: row.icon });

export async function listCategories(): Promise<Category[]> {
  const rows = await prisma.issueCategory.findMany({ where: { isActive: true }, orderBy: { createdAt: "asc" } });
  const categories = rows.map(toCategory);
  return [...categories.filter((c) => c.key !== OTHER_CATEGORY), ...categories.filter((c) => c.key === OTHER_CATEGORY)];
}

export async function getCategory(key: string): Promise<Category | undefined> {
  const row = await prisma.issueCategory.findFirst({ where: { id: key, isActive: true } });
  return row ? toCategory(row) : undefined;
}

export async function insertCategory(category: Category): Promise<Category> {
  // A category that was removed earlier with the same key comes back instead of clashing.
  const row = await prisma.issueCategory.upsert({
    where: { id: category.key },
    create: { id: category.key, name: category.name, icon: category.icon },
    update: { name: category.name, icon: category.icon, isActive: true, createdAt: new Date() },
  });
  return toCategory(row);
}

export async function updateCategory(key: string, changes: Partial<Omit<Category, "key">>): Promise<Category> {
  const row = await prisma.issueCategory.update({ where: { id: key }, data: changes });
  return toCategory(row);
}

// Issues still point at the category, so it is switched off rather than deleted.
// (The caller moves its open reports to "Other" first.)
export async function deleteCategory(key: string): Promise<void> {
  const row = await prisma.issueCategory.findUnique({ where: { id: key } });
  if (!row) return;
  await prisma.issueCategory.update({ where: { id: key }, data: { isActive: false, name: `${row.name}#removed-${Date.now()}` } });
}
