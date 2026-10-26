
import express from "express";
import cors from "cors";
import "dotenv/config";
import prisma from "./lib/prisma.js";
import { broadcastChanges, eventsHandler } from "./lib/events.js";
import { errorHandler } from "./lib/http.js";
import { authRouter } from "./routes/auth.js";
import { categoriesRouter } from "./routes/categories.js";
import { issuesRouter } from "./routes/issues.js";
import { notificationsRouter } from "./routes/notifications.js";
import { settingsRouter } from "./routes/settings.js";
import { usersRouter } from "./routes/users.js";
import { DATA_FILE, db } from "./store/db.js";

const app = express();
const PORT = process.env.PORT || 5000;

// CLIENT_URL can list several origins separated by commas. Vite moves to 5174 when 5173 is busy.
const allowedOrigins = (process.env.CLIENT_URL || "http://localhost:5173,http://localhost:5174")
  .split(",")
  .map((origin) => origin.trim());

// Outside production, also allow the app opened from another device on the same network
// (e.g. a phone visiting http://192.168.0.238:5173).
const LOCAL_NETWORK = /^https?:\/\/(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$/;
const isAllowedOrigin = (origin: string) =>
  allowedOrigins.includes(origin) || (process.env.NODE_ENV !== "production" && LOCAL_NETWORK.test(origin));

app.use(cors({ origin: (origin, done) => done(null, !origin || isAllowedOrigin(origin)) }));
app.use(express.json());
app.use(broadcastChanges);

// Live updates for every logged-in browser.
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
app.use("/api/notifications", notificationsRouter);
app.use("/api/users", usersRouter);
app.use("/api/categories", categoriesRouter);
app.use("/api/settings", settingsRouter);

app.use("/api", (_req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.use(errorHandler);

db(); // Load (or create) the data file before taking requests.

// Listens on every network interface, so other devices on the same Wi-Fi can connect.
app.listen(Number(PORT), "0.0.0.0", () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Data file: ${DATA_FILE}`);
});
