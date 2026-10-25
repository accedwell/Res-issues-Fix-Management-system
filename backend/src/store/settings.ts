import { db, save } from "./db.js";
import type { Setting } from "../types.js";

export async function listSettings(): Promise<Setting[]> {
  return db().settings;
}

export async function isSettingOn(key: string): Promise<boolean> {
  return db().settings.find((s) => s.key === key)?.on ?? false;
}

export async function setSetting(key: string, on: boolean): Promise<Setting | undefined> {
  const setting = db().settings.find((s) => s.key === key);
  if (!setting) return undefined;
  setting.on = on;
  save();
  return setting;
}

export async function listBlocks(): Promise<string[]> {
  return db().blocks;
}
