import prisma from "../lib/prisma.js";

// When technicians are meant to work, and when they are away. The staff manager sets the team's
// usual hours, can give one technician their own days and hours, and records leave. These decide
// who counts as late, early or absent. All times are on the server's own clock.

export interface WorkHours {
  start: string; // "07:30"
  end: string; // "16:30"
  // Weekdays worked, 0 = Sunday ... 6 = Saturday.
  days: number[];
}

export interface Schedule extends WorkHours {
  // False when it is just the team's hours.
  custom: boolean;
}

export interface Leave {
  id: string;
  userId: string;
  startDate: string; // "2026-11-24"
  endDate: string;
  reason: string;
}

export const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
export const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const TEAM_KEY = "_work_hours";
const DEFAULT_HOURS: WorkHours = { start: "07:30", end: "16:30", days: [1, 2, 3, 4, 5] };

const validDays = (days: unknown): days is number[] =>
  Array.isArray(days) && days.every((d) => Number.isInteger(d) && d >= 0 && d <= 6);

export function checkHours(hours: { start?: unknown; end?: unknown; days?: unknown }): WorkHours | string {
  const { start, end, days } = hours;
  if (typeof start !== "string" || typeof end !== "string" || !TIME_PATTERN.test(start) || !TIME_PATTERN.test(end)) {
    return "Enter times like 07:30";
  }
  if (end <= start) return "Work must end after it starts";
  if (!validDays(days) || !days.length) return "Pick at least one work day";
  return { start, end, days: [...new Set(days)].sort() };
}

// ===== Team hours =====

export async function getTeamHours(): Promise<WorkHours> {
  const row = await prisma.systemSetting.findUnique({ where: { key: TEAM_KEY } });
  try {
    const saved = row ? (JSON.parse(row.value) as Partial<WorkHours>) : {};
    // Hours saved before work days existed get Monday to Friday.
    const checked = checkHours({ ...saved, days: saved.days ?? DEFAULT_HOURS.days });
    if (typeof checked !== "string") return checked;
  } catch {
    // Fall back to the default.
  }
  return DEFAULT_HOURS;
}

export async function setTeamHours(hours: WorkHours): Promise<WorkHours> {
  const value = JSON.stringify(hours);
  await prisma.systemSetting.upsert({
    where: { key: TEAM_KEY },
    create: { key: TEAM_KEY, value, description: "Work hours" },
    update: { value },
  });
  return hours;
}

// ===== One technician's schedule =====

const toDays = (text: string) => text.split(",").filter(Boolean).map(Number);

export async function getSchedule(userId: string, team?: WorkHours): Promise<Schedule> {
  const row = await prisma.staffSchedule.findUnique({ where: { userId } });
  if (row) return { start: row.startTime, end: row.endTime, days: toDays(row.days), custom: true };
  return { ...(team ?? (await getTeamHours())), custom: false };
}

// Everyone's schedule at once (for lists and the attendance report).
export async function allSchedules(userIds: string[]): Promise<Map<string, Schedule>> {
  const [team, rows] = await Promise.all([getTeamHours(), prisma.staffSchedule.findMany({ where: { userId: { in: userIds } } })]);
  const own = new Map(rows.map((r) => [r.userId, r]));
  return new Map(
    userIds.map((id) => {
      const r = own.get(id);
      return [id, r ? { start: r.startTime, end: r.endTime, days: toDays(r.days), custom: true } : { ...team, custom: false }];
    }),
  );
}

// null goes back to the team's hours.
export async function setSchedule(userId: string, hours: WorkHours | null): Promise<Schedule> {
  if (!hours) {
    await prisma.staffSchedule.deleteMany({ where: { userId } });
    return getSchedule(userId);
  }
  const data = { days: hours.days.join(","), startTime: hours.start, endTime: hours.end };
  await prisma.staffSchedule.upsert({ where: { userId }, create: { userId, ...data }, update: data });
  return { ...hours, custom: true };
}

// ===== Leave =====

const toLeave = (r: { id: string; userId: string; startDate: string; endDate: string; reason: string | null }): Leave => ({
  id: r.id,
  userId: r.userId,
  startDate: r.startDate,
  endDate: r.endDate,
  reason: r.reason ?? "",
});

// Leave that has not ended yet (or that touches the given month), oldest first.
export async function listLeave(options: { userId?: string; from?: string; to?: string } = {}): Promise<Leave[]> {
  const rows = await prisma.staffLeave.findMany({
    where: {
      ...(options.userId ? { userId: options.userId } : {}),
      ...(options.from ? { endDate: { gte: options.from } } : {}),
      ...(options.to ? { startDate: { lte: options.to } } : {}),
    },
    orderBy: { startDate: "asc" },
  });
  return rows.map(toLeave);
}

export async function addLeave(userId: string, startDate: string, endDate: string, reason: string): Promise<Leave> {
  return toLeave(await prisma.staffLeave.create({ data: { userId, startDate, endDate, reason: reason || null } }));
}

export async function removeLeave(id: string): Promise<boolean> {
  const { count } = await prisma.staffLeave.deleteMany({ where: { id } });
  return count > 0;
}

// ===== Dates and times on the server's clock =====

export const localDay = (date = new Date()) => date.toLocaleDateString("en-CA");
export const clockTime = (iso: string | Date) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
export const minutesOfTime = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
export const minutesOfDay = (when: string | Date) => minutesOfTime(clockTime(when));

export const onLeaveOn = (leave: Leave[], userId: string, day: string) =>
  leave.some((l) => l.userId === userId && l.startDate <= day && l.endDate >= day);

export const worksOn = (schedule: WorkHours, day: string) => schedule.days.includes(new Date(`${day}T12:00:00`).getDay());

export function duration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h} h${m ? ` ${m} min` : ""}` : `${m} min`;
}

// "28 min late (work starts 07:30)", "on time", "1 h 20 min early (work ends 16:30)" ...
export function timingNote(when: string, kind: "in" | "out", schedule: WorkHours): string {
  if (!worksOn(schedule, localDay(new Date(when)))) return "not a scheduled work day";
  const target = kind === "in" ? schedule.start : schedule.end;
  const diff = minutesOfDay(when) - minutesOfTime(target);
  const ref = kind === "in" ? `work starts ${target}` : `work ends ${target}`;
  if (diff === 0) return "on time";
  if (kind === "in") return diff > 0 ? `${duration(diff)} late (${ref})` : `${duration(-diff)} early (${ref})`;
  return diff < 0 ? `${duration(-diff)} early (${ref})` : `${duration(diff)} after ${target}`;
}
