import prisma from "../lib/prisma.js";

// Clock-in for maintenance technicians: a shift runs from pressing "Clock in" to clocking out.
// Only technicians on duty and not on a break get new jobs automatically.

export interface DutyShift {
  id: string;
  userId: string;
  clockInAt: string;
  clockOutAt: string | null;
  autoClosed: boolean;
  breakUntil: string | null;
  breakMinutes: number;
  // Name of whoever did it for them (supervisor / system admin); null when they did it themselves.
  clockedInBy: string | null;
  clockedOutBy: string | null;
}

// Someone who forgets to clock out is clocked out after this many hours.
export const MAX_SHIFT_HOURS = 12;

type ShiftRow = {
  id: string;
  userId: string;
  clockInAt: Date;
  clockOutAt: Date | null;
  autoClosed: boolean;
  breakUntil: Date | null;
  breakMinutes: number;
  clockedInBy: string | null;
  clockedOutBy: string | null;
};

const toShift = (row: ShiftRow): DutyShift => ({
  id: row.id,
  userId: row.userId,
  clockInAt: row.clockInAt.toISOString(),
  clockOutAt: row.clockOutAt?.toISOString() ?? null,
  autoClosed: row.autoClosed,
  breakUntil: row.breakUntil?.toISOString() ?? null,
  breakMinutes: row.breakMinutes,
  clockedInBy: row.clockedInBy,
  clockedOutBy: row.clockedOutBy,
});

// ===== Shifts =====

export async function openShift(userId: string): Promise<DutyShift | undefined> {
  const row = await prisma.dutyShift.findFirst({ where: { userId, clockOutAt: null }, orderBy: { clockInAt: "desc" } });
  return row ? toShift(row) : undefined;
}

// Starts a shift. If they are already on duty the existing shift is kept (started is false).
// byName: who clocked them in, when someone did it for them.
export async function clockIn(userId: string, byName: string | null = null): Promise<{ shift: DutyShift; started: boolean }> {
  const current = await openShift(userId);
  if (current) return { shift: current, started: false };
  return { shift: toShift(await prisma.dutyShift.create({ data: { userId, clockedInBy: byName } })), started: true };
}

// Minutes of a break that has run until "end" (or until it was due to finish, if earlier).
function breakTaken(row: { breakStartedAt: Date | null; breakUntil: Date | null }, end = new Date()): number {
  if (!row.breakStartedAt || !row.breakUntil) return 0;
  const until = Math.min(end.getTime(), row.breakUntil.getTime());
  return Math.max(0, Math.round((until - row.breakStartedAt.getTime()) / 60_000));
}

// Ends the open shift, if there is one (a break in progress ends with it).
export async function clockOut(userId: string, byName: string | null = null): Promise<DutyShift | undefined> {
  const row = await prisma.dutyShift.findFirst({ where: { userId, clockOutAt: null }, orderBy: { clockInAt: "desc" } });
  if (!row) return undefined;
  const now = new Date();
  return toShift(
    await prisma.dutyShift.update({
      where: { id: row.id },
      data: { clockOutAt: now, clockedOutBy: byName, breakMinutes: row.breakMinutes + breakTaken(row, now), breakStartedAt: null, breakUntil: null },
    }),
  );
}

// ===== Breaks =====

export const BREAK_MINUTES = [15, 30, 45, 60];

export async function startBreak(userId: string, minutes: number): Promise<DutyShift | undefined> {
  const row = await prisma.dutyShift.findFirst({ where: { userId, clockOutAt: null }, orderBy: { clockInAt: "desc" } });
  if (!row) return undefined;
  const now = new Date();
  // Starting a new break closes any earlier one first.
  return toShift(
    await prisma.dutyShift.update({
      where: { id: row.id },
      data: {
        breakMinutes: row.breakMinutes + breakTaken(row, now),
        breakStartedAt: now,
        breakUntil: new Date(now.getTime() + minutes * 60_000),
      },
    }),
  );
}

// "I'm back": ends the break now. Returns undefined if they weren't on a break.
export async function endBreak(userId: string): Promise<DutyShift | undefined> {
  const row = await prisma.dutyShift.findFirst({ where: { userId, clockOutAt: null, breakUntil: { not: null } } });
  if (!row) return undefined;
  return toShift(
    await prisma.dutyShift.update({
      where: { id: row.id },
      data: { breakMinutes: row.breakMinutes + breakTaken(row), breakStartedAt: null, breakUntil: null },
    }),
  );
}

// Breaks whose time is up: they count as back. Returns those shifts.
export async function endFinishedBreaks(): Promise<DutyShift[]> {
  const rows = await prisma.dutyShift.findMany({ where: { clockOutAt: null, breakUntil: { lte: new Date() } } });
  const ended: DutyShift[] = [];
  for (const row of rows) {
    ended.push(
      toShift(
        await prisma.dutyShift.update({
          where: { id: row.id },
          data: { breakMinutes: row.breakMinutes + breakTaken(row), breakStartedAt: null, breakUntil: null },
        }),
      ),
    );
  }
  return ended;
}

// ===== Lists =====

// Every open shift by technician, so the assigner and the staff manager know who is in.
export async function openShifts(): Promise<Map<string, DutyShift>> {
  const rows = await prisma.dutyShift.findMany({ where: { clockOutAt: null } });
  return new Map(rows.map((r) => [r.userId, toShift(r)]));
}

// On duty and not on a break: the people who can be given new jobs.
export const isAvailable = (shift: DutyShift | undefined) => !!shift && (!shift.breakUntil || Date.parse(shift.breakUntil) <= Date.now());

// Shifts that started between two moments, oldest first.
export async function shiftsBetween(from: Date, to: Date): Promise<DutyShift[]> {
  const rows = await prisma.dutyShift.findMany({ where: { clockInAt: { gte: from, lt: to } }, orderBy: { clockInAt: "asc" } });
  return rows.map(toShift);
}

// Shifts started since midnight (server time), newest first, for the staff manager's list.
export async function shiftsToday(): Promise<DutyShift[]> {
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  return (await shiftsBetween(midnight, new Date(Date.now() + 60_000))).reverse();
}

// Clocks out everyone who has been on duty longer than MAX_SHIFT_HOURS. Returns who it was.
export async function closeForgottenShifts(): Promise<DutyShift[]> {
  const cutoff = new Date(Date.now() - MAX_SHIFT_HOURS * 60 * 60 * 1000);
  const stale = await prisma.dutyShift.findMany({ where: { clockOutAt: null, clockInAt: { lt: cutoff } } });
  const closed: DutyShift[] = [];
  for (const shift of stale) {
    const end = new Date(shift.clockInAt.getTime() + MAX_SHIFT_HOURS * 60 * 60 * 1000);
    closed.push(
      toShift(
        await prisma.dutyShift.update({
          where: { id: shift.id },
          data: { clockOutAt: end, autoClosed: true, breakMinutes: shift.breakMinutes + breakTaken(shift, end), breakStartedAt: null, breakUntil: null },
        }),
      ),
    );
  }
  return closed;
}
