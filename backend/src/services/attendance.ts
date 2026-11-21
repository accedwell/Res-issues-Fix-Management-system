import prisma from "../lib/prisma.js";
import { notificationKind } from "../store/mappers.js";
import { openShifts, shiftsBetween, type DutyShift } from "../store/duty.js";
import {
  allSchedules, listLeave, localDay, minutesOfDay, minutesOfTime, onLeaveOn, worksOn, type Schedule,
} from "../store/schedules.js";
import { listUsers } from "../store/users.js";

// Attendance for maintenance technicians: who has not clocked in yet, and the monthly report.

// How long after the start of work before the staff manager is told someone has not clocked in.
export const ABSENT_AFTER_MINUTES = 15;

// Tells every staff manager about someone who should be at work and has not clocked in. Sent once
// per person per day: the notification id is fixed, so a second try is simply skipped.
export async function alertMissingClockIns(): Promise<number> {
  const day = localDay();
  const now = minutesOfDay(new Date());
  const [staff, managers, shifts, leave] = await Promise.all([
    listUsers("maintenance"),
    listUsers("admin"),
    openShifts(),
    listLeave({ from: day, to: day }),
  ]);
  if (!staff.length || !managers.length) return 0;
  // Until anyone has used clock-in, nobody is "missing".
  if (!(await prisma.dutyShift.findFirst({ select: { id: true } }))) return 0;
  const schedules = await allSchedules(staff.map((s) => s.id));
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  const clockedInToday = new Set((await shiftsBetween(midnight, new Date(Date.now() + 60_000))).map((s) => s.userId));

  let sent = 0;
  for (const tech of staff) {
    const schedule = schedules.get(tech.id) as Schedule;
    if (!worksOn(schedule, day) || onLeaveOn(leave, tech.id, day)) continue;
    if (shifts.has(tech.id) || clockedInToday.has(tech.id)) continue;
    // Only during their working hours, from 15 minutes after they should have started.
    if (now < minutesOfTime(schedule.start) + ABSENT_AFTER_MINUTES || now >= minutesOfTime(schedule.end)) continue;
    const message = `Not clocked in: ${tech.name} has not clocked in yet (work started ${schedule.start}).`;
    const { count } = await prisma.notification.createMany({
      data: managers.map((m) => ({ id: `absent-${day}-${tech.id}-${m.id}`, userId: m.id, message, ...notificationKind(message) })),
      skipDuplicates: true,
    });
    if (count) sent++;
  }
  return sent;
}

// ===== Monthly report =====

export interface AttendanceRow {
  userId: string;
  name: string;
  specialization: string;
  // Work days in the month so far (from their schedule, leave left out).
  scheduledDays: number;
  daysWorked: number;
  // Scheduled days with no clock-in at all.
  missedDays: number;
  leaveDays: number;
  lateDays: number;
  // Total minutes late across the month.
  lateMinutes: number;
  earlyLeaves: number;
  forgotClockOut: number;
  // Hours on duty, breaks left out.
  hoursWorked: number;
  breakMinutes: number;
}

export interface ShiftTiming {
  // Minutes after the start of work they clocked in (0 when on time or early; null on a day off).
  lateMinutes: number | null;
  // Minutes before the end of work they clocked out (null when still on duty, or not early).
  earlyMinutes: number | null;
}

// Late / early for one shift, against that technician's schedule.
export function shiftTiming(shift: DutyShift, schedule: Schedule): ShiftTiming {
  const day = localDay(new Date(shift.clockInAt));
  if (!worksOn(schedule, day)) return { lateMinutes: null, earlyMinutes: null };
  const late = Math.max(0, minutesOfDay(shift.clockInAt) - minutesOfTime(schedule.start));
  let early: number | null = null;
  if (shift.clockOutAt && !shift.autoClosed && localDay(new Date(shift.clockOutAt)) === day) {
    const diff = minutesOfTime(schedule.end) - minutesOfDay(shift.clockOutAt);
    if (diff > 0) early = diff;
  }
  return { lateMinutes: late, earlyMinutes: early };
}

const monthDays = (month: string, upTo: string): string[] => {
  const [y, m] = month.split("-").map(Number);
  const days: string[] = [];
  for (let d = 1; d <= 31; d++) {
    const date = new Date(y, m - 1, d, 12);
    if (date.getMonth() !== m - 1) break;
    const day = localDay(date);
    if (day > upTo) break;
    days.push(day);
  }
  return days;
};

// Attendance for every technician in a month ("2026-11"). Days after today are not counted, and
// neither are days before anyone ever clocked in (clock-in was not in use yet, so nobody "missed" them).
export async function attendanceReport(month: string): Promise<AttendanceRow[]> {
  const [y, m] = month.split("-").map(Number);
  const from = new Date(y, m - 1, 1);
  const to = new Date(y, m, 1);
  const first = await prisma.dutyShift.findFirst({ orderBy: { clockInAt: "asc" }, select: { clockInAt: true } });
  const inUseFrom = first ? localDay(first.clockInAt) : localDay();
  const days = monthDays(month, localDay()).filter((d) => d >= inUseFrom);
  const [staff, shifts, leave] = await Promise.all([
    listUsers("maintenance"),
    shiftsBetween(from, to),
    listLeave({ from: `${month}-01`, to: `${month}-31` }),
  ]);
  const schedules = await allSchedules(staff.map((s) => s.id));

  return staff.map((tech) => {
    const schedule = schedules.get(tech.id) as Schedule;
    const mine = shifts.filter((s) => s.userId === tech.id);
    // A day's first clock-in decides lateness; its last clock-out decides leaving early.
    const byDay = new Map<string, DutyShift[]>();
    for (const s of mine) {
      const day = localDay(new Date(s.clockInAt));
      byDay.set(day, [...(byDay.get(day) ?? []), s]);
    }
    const workDays = days.filter((d) => worksOn(schedule, d));
    const leaveDays = workDays.filter((d) => onLeaveOn(leave, tech.id, d));
    const scheduled = workDays.filter((d) => !onLeaveOn(leave, tech.id, d));
    // Today only counts as missed once their working day has ended.
    const today = localDay();
    const missed = scheduled.filter((d) => !byDay.has(d) && (d < today || minutesOfDay(new Date()) >= minutesOfTime(schedule.end)));

    let lateDays = 0;
    let lateMinutes = 0;
    let earlyLeaves = 0;
    for (const [, list] of byDay) {
      const first = shiftTiming(list[0], schedule);
      if (first.lateMinutes) {
        lateDays++;
        lateMinutes += first.lateMinutes;
      }
      if (shiftTiming(list[list.length - 1], schedule).earlyMinutes) earlyLeaves++;
    }
    const breakMinutes = mine.reduce((sum, s) => sum + s.breakMinutes, 0);
    const minutesOnDuty = mine.reduce((sum, s) => {
      const end = s.clockOutAt ? Date.parse(s.clockOutAt) : Date.now();
      return sum + Math.max(0, (end - Date.parse(s.clockInAt)) / 60_000);
    }, 0);

    return {
      userId: tech.id,
      name: tech.name,
      specialization: tech.specialization ?? "General Maintenance",
      scheduledDays: scheduled.length,
      daysWorked: byDay.size,
      missedDays: missed.length,
      leaveDays: leaveDays.length,
      lateDays,
      lateMinutes,
      earlyLeaves,
      forgotClockOut: mine.filter((s) => s.autoClosed).length,
      hoursWorked: Math.round(Math.max(0, minutesOnDuty - breakMinutes) / 6) / 10,
      breakMinutes,
    };
  });
}
