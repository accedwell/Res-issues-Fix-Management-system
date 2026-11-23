import { isAvailable, openShifts } from "../store/duty.js";
import { listLeave, localDay, onLeaveOn } from "../store/schedules.js";
import { listIssues } from "../store/issues.js";
import { listUsers } from "../store/users.js";
import { DONE_STATUSES, type Issue, type User } from "../types.js";

// Which staff specialization handles each issue category. Anything not listed goes to general maintenance.
export const CATEGORY_SPECIALIZATION: Record<string, string> = {
  plumbing: "Plumbing",
  water: "Plumbing",
  electrical: "Electrical",
  lighting: "Electrical",
  wifi: "IT / Wi-Fi",
};

export const GENERAL_SPECIALIZATION = "General Maintenance";

export interface StaffWithWorkload {
  id: string;
  name: string;
  specialization: string;
  openJobs: number;
  // Clocked in, and when.
  onDuty: boolean;
  onDutySince: string | null;
  // The supervisor / system admin who clocked them in for them; null when they clocked in themselves.
  clockedInBy: string | null;
  // Number to call them on (only staff roles load this list).
  phone: string | null;
  // On a break until breakUntil: clocked in, but no new jobs.
  onBreak: boolean;
  breakUntil: string | null;
  onLeaveToday: boolean;
  // On duty and not on a break: only these technicians get new jobs automatically.
  available: boolean;
}

// Every maintenance staff member with how many unfinished jobs they currently have.
export async function staffWorkload(): Promise<StaffWithWorkload[]> {
  const today = localDay();
  const [staff, issues, shifts, leave] = await Promise.all([listUsers("maintenance"), listIssues(), openShifts(), listLeave({ from: today, to: today })]);
  return staff.map((s: User) => {
    const shift = shifts.get(s.id);
    const available = isAvailable(shift);
    return {
      id: s.id,
      name: s.name,
      specialization: s.specialization ?? GENERAL_SPECIALIZATION,
      openJobs: issues.filter((i) => i.assignedTo === s.id && !DONE_STATUSES.includes(i.status)).length,
      onDuty: !!shift,
      onDutySince: shift?.clockInAt ?? null,
      clockedInBy: shift?.clockedInBy ?? null,
      phone: s.phone ?? null,
      onBreak: !!shift && !available,
      breakUntil: shift && !available ? shift.breakUntil : null,
      onLeaveToday: onLeaveOn(leave, s.id, today),
      available,
    };
  });
}

// Picks the staff member whose job matches the issue category, preferring whoever has the fewest open jobs.
// Falls back to general maintenance, then to anyone. People on duty (and not on a break) always come first.
// With onDutyOnly (automatic assigning), nobody else is picked: undefined means nobody is available.
// Without it (the staff manager's suggestion), it falls back to everyone when nobody is in.
// exclude leaves people out (technicians who already declined this job).
export async function recommendStaff(
  issue: Pick<Issue, "category">,
  options: { onDutyOnly?: boolean; exclude?: string[] } = {},
): Promise<StaffWithWorkload | undefined> {
  const everyone = (await staffWorkload()).filter((s) => !options.exclude?.includes(s.id));
  const onDuty = everyone.filter((s) => s.available);
  const staff = onDuty.length || options.onDutyOnly ? onDuty : everyone;
  const specialization = CATEGORY_SPECIALIZATION[issue.category] ?? GENERAL_SPECIALIZATION;
  const matching = staff.filter((s) => s.specialization === specialization);
  const general = staff.filter((s) => s.specialization === GENERAL_SPECIALIZATION);
  const pool = matching.length ? matching : general.length ? general : staff;
  return pool.reduce<StaffWithWorkload | undefined>((best, s) => (!best || s.openJobs < best.openJobs ? s : best), undefined);
}
