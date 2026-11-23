import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { broadcast } from "./events.js";

// Runs the Python auto-assigner (backend/auto_assign/assign_issues.py) for one new report.
// It runs in the background, so the student's "Submit" never waits for the AI. When it finishes,
// every open browser reloads reports and notifications, so the technician sees the job straight away.
// If Python or the script is missing, or it fails, the server assigns the report itself instead (see
// assignWithoutPython), so the student still sees who has it straight away.

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

// With an issue, handles that one new report. Without one (after a technician clocks in), it goes
// through every report still waiting for someone, so they reach whoever is now on duty.
export function runAutoAssign(issueId?: string, ref = "waiting reports"): void {
  if (!isAutoAssignOn()) return;

  let output = "";
  // Runs once, however the Python run ends (it may report an error and then close).
  let finished = false;
  const finish = (ok: boolean) => {
    if (finished) return;
    finished = true;
    clearTimeout(timer);
    if (ok) return broadcast(["issues", "notifications", "staff", "duty"]);
    void assignWithoutPython(issueId)
      .catch((err) => console.error(`Auto-assign (server) failed for ${ref}:`, err instanceof Error ? err.message : err))
      .finally(() => broadcast(["issues", "notifications", "staff", "duty"]));
  };
  const child = spawn(pythonCommand(), issueId ? [SCRIPT, issueId] : [SCRIPT], {
    cwd: SCRIPT_DIR,
    // AUTO_ASSIGN_GROQ_API_KEY gives it its own key, so it doesn't share the assistant's free limit.
    env: { ...process.env, GROQ_API_KEY: process.env.AUTO_ASSIGN_GROQ_API_KEY || process.env.GROQ_API_KEY, PYTHONIOENCODING: "utf-8" },
    windowsHide: true,
  });
  const timer = setTimeout(() => child.kill(), TIME_LIMIT_MS);
  child.stdout.on("data", (chunk) => (output += chunk));
  child.stderr.on("data", (chunk) => (output += chunk));

  child.on("error", (err) => {
    console.error(`Python auto-assign could not start for ${ref} (${err.message}). The server assigns it instead.`);
    finish(false);
  });
  child.on("close", (code) => {
    const summary = output.trim().split("\n").slice(-3).join(" | ");
    if (code === 0) console.log(`Auto-assign ${ref}: ${summary}`);
    else console.error(`Python auto-assign failed for ${ref} (exit ${code}): ${summary}. The server assigns it instead.`);
    finish(code === 0);
  });
}

// The same job as the Python script, without the AI: gives the report (or every report still waiting)
// to the best matching technician on duty, using the backend's own rules (assignment.ts). Reports that
// were assigned in the meantime are left alone. With nobody on duty, an urgent new report alerts the
// staff manager and it waits for the next technician to clock in.
async function assignWithoutPython(issueId?: string): Promise<void> {
  // Loaded here: issueWorkflow.ts itself uses runAutoAssign.
  const { alertNobodyOnDuty, assignIssue } = await import("../services/issueWorkflow.js");
  const { getIssue, listIssues } = await import("../store/issues.js");
  const waiting = (issue: { assignedTo: string | null; status: string }) =>
    !issue.assignedTo && (issue.status === "Submitted" || issue.status === "Received");

  const issues = issueId
    ? [await getIssue(issueId)].filter((i) => !!i)
    : (await listIssues()).filter(waiting).reverse(); // oldest first
  for (const issue of issues) {
    if (!waiting(issue)) continue;
    try {
      const assigned = await assignIssue(issue.id, undefined, undefined, "automatically by the auto-assigner", true);
      console.log(`Auto-assign (server) ${issue.ref}: assigned to ${assigned.assignedTo}`);
    } catch {
      // Nobody on duty: stop here, the rest would fail the same way.
      if (issueId) await alertNobodyOnDuty(issue);
      console.log(`Auto-assign (server) ${issue.ref}: no technician on duty, waiting.`);
      return;
    }
  }
}
