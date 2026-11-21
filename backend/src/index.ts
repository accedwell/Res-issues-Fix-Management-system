
import express from "express";
import cors from "cors";
import helmet from "helmet";
import "dotenv/config";
import prisma from "./lib/prisma.js";
import { broadcast, broadcastChanges, eventsHandler, ticketHandler } from "./lib/events.js";
import { errorHandler, isDevMode } from "./lib/http.js";
import { requireAuth } from "./middleware/auth.js";
import { assistantRouter } from "./routes/assistant.js";
import { authRouter } from "./routes/auth.js";
import { callsRouter } from "./routes/calls.js";
import { categoriesRouter } from "./routes/categories.js";
import { dutyRouter } from "./routes/duty.js";
import { issuesRouter } from "./routes/issues.js";
import { notificationsRouter } from "./routes/notifications.js";
import { partsRouter } from "./routes/parts.js";
import { settingsRouter } from "./routes/settings.js";
import { usersRouter } from "./routes/users.js";
import { alertOverdueReports } from "./services/issueWorkflow.js";
import { tellManagers } from "./routes/duty.js";
import { runAutoAssign } from "./lib/autoAssign.js";
import { alertMissingClockIns } from "./services/attendance.js";
import { closeForgottenShifts, endFinishedBreaks, MAX_SHIFT_HOURS } from "./store/duty.js";
import { clockTime } from "./store/schedules.js";
import { getUser } from "./store/users.js";
import { addNotification } from "./store/notifications.js";

const app = express();
const PORT = process.env.PORT || 5000;

// CLIENT_URL can list several origins separated by commas. Vite moves to 5174 when 5173 is busy.
const allowedOrigins = (process.env.CLIENT_URL || "http://localhost:5173,http://localhost:5174")
  .split(",")
  .map((origin) => origin.trim());

// With DEV_MODE=true in .env (and never in production), also allow the app opened from another
// device on the same network (e.g. a phone visiting http://192.168.0.238:5173).
const LOCAL_NETWORK = /^https?:\/\/(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$/;
const isAllowedOrigin = (origin: string) => allowedOrigins.includes(origin) || (isDevMode() && LOCAL_NETWORK.test(origin));

// Standard browser protection headers. The API only sends JSON and photos, so the page itself
// (served by Vite or the web host) is not affected; photos are shown on the frontend's address.
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({ origin: (origin, done) => done(null, !origin || isAllowedOrigin(origin)) }));
// Room for one report photo (up to 5 MB, sent as base64).
app.use(express.json({ limit: "8mb" }));
app.use(broadcastChanges);

// Live updates for every logged-in browser.
app.post("/api/events/ticket", requireAuth, ticketHandler);
app.get("/api/events", eventsHandler);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/health/db", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;

    res.json({
      status: "ok",
      database: "connected",
    });
  } catch (error) {
    console.error("Database health check failed:", error);

    res.status(503).json({
      status: "error",
      database: "disconnected",
    });
  }
});

app.use("/api/auth", authRouter);
app.use("/api/issues", issuesRouter);
app.use("/api/assistant", assistantRouter);
app.use("/api/calls", callsRouter);
app.use("/api/notifications", notificationsRouter);
app.use("/api/users", usersRouter);
app.use("/api/categories", categoriesRouter);
app.use("/api/settings", settingsRouter);
app.use("/api/parts", partsRouter);
app.use("/api/duty", dutyRouter);

app.use("/api", (_req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.use(errorHandler);

// Listens on every network interface, so other devices on the same Wi-Fi can connect.
app.listen(Number(PORT), "0.0.0.0", () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log("Data is stored in PostgreSQL (DATABASE_URL in .env).");
});

// Check every minute and at start-up; each reporting/follow-up period alerts only once.
const checkOverdue = () =>
  alertOverdueReports()
    .then((sent) => {
      if (sent) {
        console.log(`Sent ${sent} overdue alert(s) to students.`);
        broadcast(["notifications"]);
      }
    })
    .catch((err) => console.error("Overdue check failed:", err));
void checkOverdue();
setInterval(checkOverdue, 60 * 1000);

// Every minute, for clock-in:
//  - technicians who forgot to clock out are clocked out after MAX_SHIFT_HOURS, so someone who went
//    home does not keep getting new jobs overnight;
//  - breaks whose time is up end, and waiting reports can go to those technicians again;
//  - the staff manager is told about anyone 15 minutes late who has not clocked in (once a day each).
async function checkShifts() {
  let changed = false;
  for (const shift of await closeForgottenShifts()) {
    changed = true;
    await addNotification(shift.userId, `You were clocked out automatically after ${MAX_SHIFT_HOURS} hours. Scan the clock-in QR code when you start again.`);
    const name = (await getUser(shift.userId))?.name;
    if (name) {
      await tellManagers(`Clocked out: ${name} forgot to clock out; the system did it after ${MAX_SHIFT_HOURS} hours (clocked in at ${clockTime(shift.clockInAt)}).`);
    }
  }
  const backFromBreak = await endFinishedBreaks();
  for (const shift of backFromBreak) {
    const name = (await getUser(shift.userId))?.name;
    if (name) await tellManagers(`Back from break: ${name} at ${clockTime(new Date())} (break time over).`);
  }
  if (backFromBreak.length) runAutoAssign();
  const absent = await alertMissingClockIns();
  if (changed || backFromBreak.length || absent) broadcast(["duty", "staff", "notifications"]);
}
const runShiftChecks = () => checkShifts().catch((err) => console.error("Shift check failed:", err));
void runShiftChecks();
setInterval(runShiftChecks, 60 * 1000);
