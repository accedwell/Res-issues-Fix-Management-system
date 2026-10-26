export type Role = "student" | "admin" | "maintenance" | "sysadmin";

export type Status = "Submitted" | "Received" | "Assigned" | "In Progress" | "Resolved" | "Closed";

export type Priority = "Low" | "Normal" | "High" | "Urgent";

export const ROLES: Role[] = ["student", "admin", "maintenance", "sysadmin"];
export const STATUSES: Status[] = ["Submitted", "Received", "Assigned", "In Progress", "Resolved", "Closed"];
export const PRIORITIES: Priority[] = ["Low", "Normal", "High", "Urgent"];
export const DONE_STATUSES: Status[] = ["Resolved", "Closed"];

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  passwordHash: string;
  createdAt: string;
  // Students
  studentNumber?: string;
  block?: string;
  room?: string;
  // Maintenance staff
  specialization?: string;
}

// What the API sends back — never includes the password hash.
export type PublicUser = Omit<User, "passwordHash">;

export interface Category {
  key: string;
  name: string;
  icon: string;
}

export interface HistoryEntry {
  status: Status;
  date: string;
  note: string;
}

export interface Feedback {
  rating: number;
  comment: string;
}

export interface Issue {
  id: string;
  ref: string;
  title: string;
  category: string;
  description: string;
  residence: string;
  room: string;
  priority: Priority;
  status: Status;
  studentId: string;
  studentName: string;
  assignedTo: string | null;
  dateReported: string;
  photo: boolean;
  history: HistoryEntry[];
  feedback: Feedback | null;
  reopened: number;
}

export interface Notification {
  id: string;
  userId: string;
  message: string;
  date: string;
  read: boolean;
  // The issue it is about, so the app can open it from the bell.
  issueId?: string;
}

export interface Setting {
  key: string;
  label: string;
  on: boolean;
}

// A pending "forgot password" request. Only a hash of the code is stored.
export interface PasswordReset {
  userId: string;
  codeHash: string;
  expiresAt: number;
  attempts: number;
}

export interface Data {
  users: User[];
  issues: Issue[];
  notifications: Notification[];
  categories: Category[];
  settings: Setting[];
  blocks: string[];
  // Running number used for issue references (ISS-<year>-<number>).
  nextIssueNumber: number;
  // Optional so data files created before this feature still load.
  passwordResets?: PasswordReset[];
}
