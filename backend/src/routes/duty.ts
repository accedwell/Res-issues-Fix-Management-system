import { Router } from "express";
import { currentUser, requireAuth, requireRole } from "../middleware/auth.js";
import { runAutoAssign } from "../lib/autoAssign.js";
import { badRequest, notFound } from "../lib/http.js";
import { rateLimit } from "../lib/rateLimit.js";
import { attendanceReport, shiftTiming } from "../services/attendance.js";
import { handBackJob, managersAndSupervisors } from "../services/issueWorkflow.js";
import {
  BREAK_MINUTES, clockIn, clockOut, endBreak, getCodeMode, getDailyCode, getScreenCode, isClockInCodeValid, MAX_SHIFT_HOURS,
  openShift, renewCodes, ROTATE_SECONDS, setCodeMode, shiftsToday, startBreak, type DutyShift,
} from "../store/duty.js";
import { addNotification } from "../store/notifications.js";
import {
  addLeave, allSchedules, checkHours, clockTime, DATE_PATTERN, getSchedule, getTeamHours, listLeave, localDay, onLeaveOn, removeLeave,
  setSchedule, setTeamHours, timingNote, type Schedule,
} from "../store/schedules.js";
import { getUser, listUsers } from "../store/users.js";
import type { User } from "../types.js";

// Clocking in and out, breaks, schedules, leave and attendance.
// Technicians clock in by scanning the QR code at the maintenance office (or typing the code under
// it). Only technicians on duty and not on a break get new jobs automatically. The staff manager is
// told about every clock-in, clock-out and break, with the time and whether it was late or early.
export const dutyRouter = Router();
dutyRouter.use(requireAuth);

// Stops anyone guessing the code by trying thousands of them.
const codeAttempts = rateLimit({ max: 10, minutes: 15, message: "Too many tries. Please wait a few minutes and scan the QR code again." });

// Attendance news goes to the staff manager and the supervisors.
export async function tellManagers(message: string) {
  for (const manager of await managersAndSupervisors()) await addNotification(manager.id, message);
}

const onBreak = (shift: DutyShift | undefined) => !!shift?.breakUntil && Date.parse(shift.breakUntil) > Date.now();

// What a technician's own card shows.
async function myStatus(userId: string) {
  const [shift, schedule, leave] = await Promise.all([openShift(userId), getSchedule(userId), listLeave({ userId, from: localDay() })]);
  const today = localDay();
  return {
    onDuty: !!shift,
    since: shift?.clockInAt ?? null,
    onBreak: onBreak(shift),
    breakUntil: onBreak(shift) ? shift?.breakUntil ?? null : null,
    maxHours: MAX_SHIFT_HOURS,
    breakOptions: BREAK_MINUTES,
    schedule,
    onLeaveToday: onLeaveOn(leave, userId, today),
    leave,
  };
}

// ===== Technicians =====

// GET /api/duty/me
dutyRouter.get("/me", requireRole("maintenance"), async (req, res) => {
  res.json(await myStatus(currentUser(req).id));
});

// The four availability steps. A technician does them for themselves; the supervisor or system admin
// can do them for a technician (e.g. one without a phone). "by" is whoever did it for them: the staff
// manager's message then says so, and the technician gets a notification.
const recordedBy = (by?: User) => (by ? ` (recorded by ${by.name})` : "");

async function clockInFor(tech: User, by?: User) {
  if (onLeaveOn(await listLeave({ userId: tech.id, from: localDay() }), tech.id, localDay())) {
    throw badRequest(by ? `${tech.name} is on leave today. Remove the leave first if they are working.` : "You are on leave today. Ask the staff manager to remove the leave if you are working.");
  }
  const { shift, started } = await clockIn(tech.id, by?.name ?? null);
  if (started) {
    const schedule = await getSchedule(tech.id);
    await tellManagers(`Clocked in: ${tech.name} at ${clockTime(shift.clockInAt)} — ${timingNote(shift.clockInAt, "in", schedule)}${recordedBy(by)}.`);
    if (by) await addNotification(tech.id, `Availability: ${by.name} clocked you in at ${clockTime(shift.clockInAt)}. You can now get new jobs.`);
  }
  // Reports that were waiting because nobody was on duty can go out now.
  runAutoAssign();
}

async function clockOutFor(tech: User, handBack: unknown[], by?: User) {
  for (const id of handBack.slice(0, 50)) await handBackJob(tech, String(id));
  const shift = await clockOut(tech.id, by?.name ?? null);
  if (shift?.clockOutAt) {
    const schedule = await getSchedule(tech.id);
    await tellManagers(`Clocked out: ${tech.name} at ${clockTime(shift.clockOutAt)} — ${timingNote(shift.clockOutAt, "out", schedule)}${recordedBy(by)}.`);
    if (by) await addNotification(tech.id, `Availability: ${by.name} clocked you out at ${clockTime(shift.clockOutAt)}. No new jobs come to you until you are clocked in again.`);
  }
  // Handed-back jobs can go to whoever is still on duty.
  if (handBack.length) runAutoAssign();
}

async function breakFor(tech: User, minutes: number, by?: User) {
  if (!BREAK_MINUTES.includes(minutes)) throw badRequest(`A break is ${BREAK_MINUTES.join(", ")} minutes`);
  const shift = await startBreak(tech.id, minutes);
  if (!shift?.breakUntil) throw badRequest(by ? `${tech.name} is not clocked in` : "Clock in first");
  await tellManagers(`On break: ${tech.name} at ${clockTime(new Date())} for ${minutes} min (back at ${clockTime(shift.breakUntil)})${recordedBy(by)}.`);
  if (by) await addNotification(tech.id, `Availability: ${by.name} started a ${minutes}-minute break for you (back at ${clockTime(shift.breakUntil)}).`);
}

async function endBreakFor(tech: User, by?: User) {
  if (await endBreak(tech.id)) {
    await tellManagers(`Back from break: ${tech.name} at ${clockTime(new Date())}${recordedBy(by)}.`);
    if (by) await addNotification(tech.id, `Availability: ${by.name} ended your break. You can get new jobs again.`);
    runAutoAssign();
  }
}

// POST /api/duty/clock-in — { code }. The code comes from the QR code or is typed in.
dutyRouter.post("/clock-in", requireRole("maintenance"), codeAttempts, async (req, res) => {
  const user = currentUser(req);
  const code = typeof req.body?.code === "string" ? req.body.code : "";
  if (!code.trim()) throw badRequest("Scan the clock-in QR code at the maintenance office, or type the code under it");
  if (!(await isClockInCodeValid(code))) {
    const screen = (await getCodeMode()) === "rotating";
    throw badRequest(
      screen
        ? "That code has expired or is wrong. Scan the screen at the maintenance office again."
        : "That clock-in code is not today's. Scan the QR code at the maintenance office again.",
    );
  }
  await clockInFor(user);
  res.json(await myStatus(user.id));
});

// POST /api/duty/clock-out — { handBack?: [issue ids] }. Jobs not handed back stay theirs.
dutyRouter.post("/clock-out", requireRole("maintenance"), async (req, res) => {
  const user = currentUser(req);
  await clockOutFor(user, Array.isArray(req.body?.handBack) ? req.body.handBack : []);
  res.json(await myStatus(user.id));
});

// POST /api/duty/break — { minutes }. No new jobs until the break is over.
dutyRouter.post("/break", requireRole("maintenance"), async (req, res) => {
  const user = currentUser(req);
  await breakFor(user, Number(req.body?.minutes));
  res.json(await myStatus(user.id));
});

// POST /api/duty/break/end — "I'm back".
dutyRouter.post("/break/end", requireRole("maintenance"), async (req, res) => {
  const user = currentUser(req);
  await endBreakFor(user);
  res.json(await myStatus(user.id));
});

// ===== For a technician: supervisor and system administrator =====
// Updating a technician's availability for them, e.g. one who has no phone. No QR code is needed:
// the supervisor is the one vouching that they are at work.

// POST /api/duty/staff/:userId/clock-in
dutyRouter.post("/staff/:userId/clock-in", requireRole("supervisor", "sysadmin"), async (req, res) => {
  const tech = await technician(String(req.params.userId));
  await clockInFor(tech, currentUser(req));
  res.json(await myStatus(tech.id));
});

// POST /api/duty/staff/:userId/clock-out — { handBack?: [issue ids] }
dutyRouter.post("/staff/:userId/clock-out", requireRole("supervisor", "sysadmin"), async (req, res) => {
  const tech = await technician(String(req.params.userId));
  await clockOutFor(tech, Array.isArray(req.body?.handBack) ? req.body.handBack : [], currentUser(req));
  res.json(await myStatus(tech.id));
});

// POST /api/duty/staff/:userId/break — { minutes }
dutyRouter.post("/staff/:userId/break", requireRole("supervisor", "sysadmin"), async (req, res) => {
  const tech = await technician(String(req.params.userId));
  await breakFor(tech, Number(req.body?.minutes), currentUser(req));
  res.json(await myStatus(tech.id));
});

// POST /api/duty/staff/:userId/break/end
dutyRouter.post("/staff/:userId/break/end", requireRole("supervisor", "sysadmin"), async (req, res) => {
  const tech = await technician(String(req.params.userId));
  await endBreakFor(tech, currentUser(req));
  res.json(await myStatus(tech.id));
});

// ===== Staff manager (and system administrator) =====
dutyRouter.use(requireRole("admin", "sysadmin"));

// GET /api/duty/code — the code to show: today's printed code, or the wall screen's current one.
dutyRouter.get("/code", async (_req, res) => {
  const mode = await getCodeMode();
  const daily = await getDailyCode();
  const screen = mode === "rotating" ? await getScreenCode() : null;
  res.json({ mode, day: daily.day, code: screen?.code ?? daily.code, changesAt: screen?.changesAt ?? null, rotateSeconds: ROTATE_SECONDS });
});

// POST /api/duty/code — new codes now; the old ones stop working straight away.
dutyRouter.post("/code", async (_req, res) => {
  await renewCodes();
  res.json({ ok: true });
});

// PUT /api/duty/mode — { mode: "daily" | "rotating" }.
dutyRouter.put("/mode", async (req, res) => {
  const mode = req.body?.mode;
  if (mode !== "daily" && mode !== "rotating") throw badRequest("Mode must be daily or rotating");
  await setCodeMode(mode);
  res.json({ mode });
});

// GET /api/duty/shifts — today's clock-ins with names and late / early minutes.
dutyRouter.get("/shifts", async (_req, res) => {
  const [shifts, staff] = await Promise.all([shiftsToday(), listUsers("maintenance")]);
  const names = new Map(staff.map((s) => [s.id, s.name]));
  const schedules = await allSchedules(staff.map((s) => s.id));
  res.json({
    shifts: shifts
      .filter((s) => names.has(s.userId))
      .map((s) => ({ ...s, name: names.get(s.userId), onBreak: onBreak(s), ...shiftTiming(s, schedules.get(s.userId) as Schedule) })),
  });
});

// GET /api/duty/schedules — the team's hours, each technician's own schedule, and leave from today on.
dutyRouter.get("/schedules", async (_req, res) => {
  const staff = await listUsers("maintenance");
  const [team, schedules, leave] = await Promise.all([getTeamHours(), allSchedules(staff.map((s) => s.id)), listLeave({ from: localDay() })]);
  const today = localDay();
  res.json({
    team,
    today,
    people: staff.map((s) => ({ userId: s.id, schedule: schedules.get(s.id), onLeaveToday: onLeaveOn(leave, s.id, today) })),
    leave,
  });
});

// PUT /api/duty/hours — the team's hours: { start, end, days }.
dutyRouter.put("/hours", async (req, res) => {
  const hours = checkHours(req.body ?? {});
  if (typeof hours === "string") throw badRequest(hours);
  res.json({ team: await setTeamHours(hours) });
});

async function technician(id: string) {
  const user = await getUser(id);
  if (!user || user.role !== "maintenance") throw notFound("Technician not found");
  return user;
}

// PUT /api/duty/schedules/:userId — { start, end, days } for their own hours, or { useTeam: true }.
dutyRouter.put("/schedules/:userId", async (req, res) => {
  const user = await technician(String(req.params.userId));
  if (req.body?.useTeam) return res.json({ schedule: await setSchedule(user.id, null) });
  const hours = checkHours(req.body ?? {});
  if (typeof hours === "string") throw badRequest(hours);
  const schedule = await setSchedule(user.id, hours);
  const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  await addNotification(user.id, `Your work hours are now ${hours.days.map((d) => names[d]).join(", ")}, ${hours.start}–${hours.end}.`);
  res.json({ schedule });
});

// POST /api/duty/leave — { userId, startDate, endDate, reason }.
dutyRouter.post("/leave", async (req, res) => {
  const user = await technician(String(req.body?.userId ?? ""));
  const startDate = String(req.body?.startDate ?? "");
  const endDate = String(req.body?.endDate ?? "") || startDate;
  if (!DATE_PATTERN.test(startDate) || !DATE_PATTERN.test(endDate)) throw badRequest("Pick the first and last day of leave");
  if (endDate < startDate) throw badRequest("The last day can't be before the first day");
  const reason = String(req.body?.reason ?? "").trim().slice(0, 80);
  const leave = await addLeave(user.id, startDate, endDate, reason);
  const span = startDate === endDate ? startDate : `${startDate} to ${endDate}`;
  await addNotification(user.id, `Leave recorded for you: ${span}${reason ? ` (${reason})` : ""}. You won't get new jobs then.`);
  res.status(201).json({ leave });
});

// DELETE /api/duty/leave/:id
dutyRouter.delete("/leave/:id", async (req, res) => {
  if (!(await removeLeave(String(req.params.id)))) throw notFound("Leave not found");
  res.json({ ok: true });
});

// GET /api/duty/attendance?month=2026-11
dutyRouter.get("/attendance", async (req, res) => {
  const month = typeof req.query.month === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(req.query.month) ? req.query.month : localDay().slice(0, 7);
  res.json({ month, rows: await attendanceReport(month) });
});
