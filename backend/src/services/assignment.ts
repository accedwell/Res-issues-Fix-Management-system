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
}

// Every maintenance staff member with how many unfinished jobs they currently have.
export async function staffWorkload(): Promise<StaffWithWorkload[]> {
  const [staff, issues] = await Promise.all([listUsers("maintenance"), listIssues()]);
  return staff.map((s: User) => ({
    id: s.id,
    name: s.name,
    specialization: s.specialization ?? GENERAL_SPECIALIZATION,
    openJobs: issues.filter((i) => i.assignedTo === s.id && !DONE_STATUSES.includes(i.status)).length,
  }));
}

// Picks the staff member whose job matches the issue category, preferring whoever has the fewest open jobs.
// Falls back to general maintenance, then to anyone. Returns undefined only when there is no maintenance staff.
export async function recommendStaff(issue: Pick<Issue, "category">): Promise<StaffWithWorkload | undefined> {
  const staff = await staffWorkload();
  const specialization = CATEGORY_SPECIALIZATION[issue.category] ?? GENERAL_SPECIALIZATION;
  const matching = staff.filter((s) => s.specialization === specialization);
  const general = staff.filter((s) => s.specialization === GENERAL_SPECIALIZATION);
  const pool = matching.length ? matching : general.length ? general : staff;
  return pool.reduce<StaffWithWorkload | undefined>((best, s) => (!best || s.openJobs < best.openJobs ? s : best), undefined);
}
