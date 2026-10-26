import prisma from "../lib/prisma.js";
import type { Setting } from "../types.js";

// Settings are stored as key / "true" or "false" / description (the label shown to the admin).
// Keys starting with "_" are internal counters and are never shown.

const toSetting = (row: { key: string; value: string; description: string | null }): Setting => ({
  key: row.key,
  label: row.description ?? row.key,
  on: row.value === "true",
});

export async function listSettings(): Promise<Setting[]> {
  const rows = await prisma.systemSetting.findMany({ where: { NOT: { key: { startsWith: "_" } } }, orderBy: { key: "asc" } });
  return rows.map(toSetting);
}

export async function isSettingOn(key: string): Promise<boolean> {
  const row = await prisma.systemSetting.findUnique({ where: { key } });
  return row?.value === "true";
}

export async function setSetting(key: string, on: boolean): Promise<Setting | undefined> {
  if (key.startsWith("_") || !(await prisma.systemSetting.findUnique({ where: { key } }))) return undefined;
  return toSetting(await prisma.systemSetting.update({ where: { key }, data: { value: String(on) } }));
}

export async function listBlocks(): Promise<string[]> {
  const rows = await prisma.residenceBlock.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });
  return rows.map((b) => b.name);
}
