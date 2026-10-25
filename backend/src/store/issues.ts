import { db, save } from "./db.js";
import type { Issue } from "../types.js";

export interface IssueQuery {
  studentId?: string;
  assignedTo?: string;
  status?: string;
  category?: string;
  residence?: string;
  search?: string;
}

// Newest first.
export async function listIssues(query: IssueQuery = {}): Promise<Issue[]> {
  const search = query.search?.toLowerCase();
  return db()
    .issues.filter(
      (i) =>
        (!query.studentId || i.studentId === query.studentId) &&
        (!query.assignedTo || i.assignedTo === query.assignedTo) &&
        (!query.status || i.status === query.status) &&
        (!query.category || i.category === query.category) &&
        (!query.residence || i.residence === query.residence) &&
        (!search || [i.ref, i.title, i.description, i.room, i.studentName].some((f) => f.toLowerCase().includes(search))),
    )
    .sort((a, b) => b.dateReported.localeCompare(a.dateReported));
}

export async function getIssue(id: string): Promise<Issue | undefined> {
  return db().issues.find((i) => i.id === id);
}

export async function insertIssue(issue: Issue): Promise<Issue> {
  db().issues.push(issue);
  save();
  return issue;
}

export async function updateIssue(id: string, changes: Partial<Issue>): Promise<Issue> {
  const issue = db().issues.find((i) => i.id === id);
  if (!issue) throw new Error(`Issue ${id} not found`);
  Object.assign(issue, changes);
  save();
  return issue;
}

// Reserves the next reference number, e.g. ISS-2026-00133.
export async function nextIssueRef(): Promise<string> {
  const data = db();
  const number = data.nextIssueNumber++;
  save();
  return `ISS-${new Date().getFullYear()}-${String(number).padStart(5, "0")}`;
}
