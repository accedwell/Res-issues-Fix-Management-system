import { db, save } from "./db.js";
import type { Category } from "../types.js";

// The fallback category. It always exists and always stays last in the list.
export const OTHER_CATEGORY = "other";

export async function listCategories(): Promise<Category[]> {
  return db().categories;
}

export async function getCategory(key: string): Promise<Category | undefined> {
  return db().categories.find((c) => c.key === key);
}

export async function insertCategory(category: Category): Promise<Category> {
  const categories = db().categories;
  const otherIndex = categories.findIndex((c) => c.key === OTHER_CATEGORY);
  categories.splice(otherIndex === -1 ? categories.length : otherIndex, 0, category);
  save();
  return category;
}

export async function updateCategory(key: string, changes: Partial<Omit<Category, "key">>): Promise<Category> {
  const category = db().categories.find((c) => c.key === key);
  if (!category) throw new Error(`Category ${key} not found`);
  Object.assign(category, changes);
  save();
  return category;
}

export async function deleteCategory(key: string): Promise<void> {
  const data = db();
  data.categories = data.categories.filter((c) => c.key !== key);
  save();
}
