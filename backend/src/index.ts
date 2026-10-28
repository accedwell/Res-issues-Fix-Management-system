
import express from "express";
import cors from "cors";
import helmet from "helmet";
import "dotenv/config";
import prisma from "./lib/prisma.js";
import { broadcast, broadcastChanges, eventsHandler, ticketHandler } from "./lib/events.js";
import { errorHandler, isDevMode } from "./lib/http.js";
import { requireAuth } from "./middleware/auth.js";
import { authRouter } from "./routes/auth.js";
import { callsRouter } from "./routes/calls.js";
import { categoriesRouter } from "./routes/categories.js";
import { issuesRouter } from "./routes/issues.js";
import { notificationsRouter } from "./routes/notifications.js";
import { settingsRouter } from "./routes/settings.js";
import { usersRouter } from "./routes/users.js";
import { alertOverdueReports } from "./services/issueWorkflow.js";

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
app.use("/api/calls", callsRouter);
app.use("/api/notifications", notificationsRouter);
app.use("/api/users", usersRouter);
app.use("/api/categories", categoriesRouter);
app.use("/api/settings", settingsRouter);

app.use("/api", (_req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.use(errorHandler);

// Listens on every network interface, so other devices on the same Wi-Fi can connect.
app.listen(Number(PORT), "0.0.0.0", () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log("Data is stored in PostgreSQL (DATABASE_URL in .env).");
});

// Once an hour (and at start-up), alert students whose reports have gone overdue. Each report
// alerts its student only once.
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
setInterval(checkOverdue, 60 * 60 * 1000);
