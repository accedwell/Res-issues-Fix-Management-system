import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { broadcast } from "./events.js";

// Runs the Python auto-assigner (backend/auto_assign/assign_issues.py) for one new report.
// It runs in the background, so the student's "Submit" never waits for the AI. When it finishes,
// every open browser reloads reports and notifications, so the technician sees the job straight away.
// If Python or the script is missing, or it fails, the report simply waits for the staff manager as before.

const SCRIPT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../../auto_assign");
const SCRIPT = join(SCRIPT_DIR, "assign_issues.py");
const TIME_LIMIT_MS = 60_000;

// The auto-assigner's own Python (its virtual environment) if it was set up, otherwise the system one.
// AUTO_ASSIGN_PYTHON in .env can point somewhere else.
function pythonCommand(): string {
  if (process.env.AUTO_ASSIGN_PYTHON) return process.env.AUTO_ASSIGN_PYTHON;
  const venv = process.platform === "win32" ? join(SCRIPT_DIR, ".venv", "Scripts", "python.exe") : join(SCRIPT_DIR, ".venv", "bin", "python");
  return existsSync(venv) ? venv : process.platform === "win32" ? "python" : "python3";
}

// Switched off with AUTO_ASSIGN=off in .env, and always inside automated tests.
export const isAutoAssignOn = () => process.env.AUTO_ASSIGN !== "off" && !process.env.NODE_TEST_CONTEXT && existsSync(SCRIPT);

export function runAutoAssign(issueId: string, ref: string): void {
  if (!isAutoAssignOn()) return;

  let output = "";
  const child = spawn(pythonCommand(), [SCRIPT, issueId], {
    cwd: SCRIPT_DIR,
    env: { ...process.env, PYTHONIOENCODING: "utf-8" },
    windowsHide: true,
  });
  const timer = setTimeout(() => child.kill(), TIME_LIMIT_MS);
  child.stdout.on("data", (chunk) => (output += chunk));
  child.stderr.on("data", (chunk) => (output += chunk));

  child.on("error", (err) => {
    clearTimeout(timer);
    console.error(`Auto-assign could not start for ${ref} (${err.message}). It will wait for the staff manager.`);
  });
  child.on("close", (code) => {
    clearTimeout(timer);
    const summary = output.trim().split("\n").slice(-3).join(" | ");
    if (code === 0) console.log(`Auto-assign ${ref}: ${summary}`);
    else console.error(`Auto-assign failed for ${ref} (exit ${code}): ${summary}`);
    broadcast(["issues", "notifications", "staff"]);
  });
}
