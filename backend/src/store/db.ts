import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createSeedData } from "./seed.js";
import type { Data } from "../types.js";

// The whole app's data lives in one JSON file. This is the only module that touches it,
// so swapping in a real database later only means rewriting the files in src/store/.

const DEFAULT_FILE = resolve(dirname(fileURLToPath(import.meta.url)), "../../data/db.json");
export const DATA_FILE = process.env.DATA_FILE ? resolve(process.env.DATA_FILE) : DEFAULT_FILE;

let data: Data | null = null;

function load(): Data {
  if (existsSync(DATA_FILE)) {
    return JSON.parse(readFileSync(DATA_FILE, "utf8")) as Data;
  }
  console.log(`No data file found — creating ${DATA_FILE} with sample data.`);
  data = createSeedData();
  save();
  return data;
}

export function db(): Data {
  if (!data) data = load();
  return data;
}

// Write to a temp file first, then rename, so a crash never leaves a half-written file.
export function save(): void {
  if (!data) return;
  mkdirSync(dirname(DATA_FILE), { recursive: true });
  const temp = DATA_FILE + ".tmp";
  writeFileSync(temp, JSON.stringify(data, null, 2));
  renameSync(temp, DATA_FILE);
}

export function resetData(): void {
  data = createSeedData();
  save();
}

export const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
