// npm run import-json [file] — copies data saved by the old JSON-file version of the backend
// (default: data/db.json) into the database, replacing what is there.
import "dotenv/config";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import prisma from "../lib/prisma.js";
import { loadData } from "../store/importData.js";
import type { Data } from "../types.js";

const file = resolve(process.argv[2] ?? "data/db.json");
const data = JSON.parse(readFileSync(file, "utf8")) as Data;

await loadData(data);
await prisma.$disconnect();
console.log(`Imported ${file} into the database:`);
console.log(`  ${data.users.length} users, ${data.issues.length} issues, ${data.notifications.length} notifications,`);
console.log(`  ${data.categories.length} categories, ${data.blocks.length} blocks, ${data.settings.length} settings`);
