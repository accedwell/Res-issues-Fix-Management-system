// "admin" is the staff manager. The supervisor assigns jobs to technicians.
export type Role = "student" | "admin" | "maintenance" | "sysadmin" | "supervisor";

export type Status = "Submitted" | "Received" | "Assigned" | "In Progress" | "Not Resolved" | "Resolved" | "Closed";

export type Priority = "Low" | "Normal" | "High" | "Urgent";

export const ROLES: Role[] = ["student", "admin", "maintenance", "sysadmin", "supervisor"];
export const STATUSES: Status[] = ["Submitted", "Received", "Assigned", "In Progress", "Not Resolved", "Resolved", "Closed"];
export const PRIORITIES: Priority[] = ["Low", "Normal", "High", "Urgent"];
export const DONE_STATUSES: Status[] = ["Resolved", "Closed"];
// Places in a block that belong to nobody. Besides their own room, students can only report these,
// so nobody can report a problem in another student's room. Keep in step with the app's list.
export const SHARED_PLACES = ["Hallway", "Laundry room", "Study area", "Elevator (Lift)", "Stairs / entrance", "Outside the block"];
// Students can follow up on an unresolved report after 24 elapsed hours.
export const OVERDUE_AFTER_DAYS: Record<Priority, number> = { Urgent: 1, High: 1, Normal: 1, Low: 1 };

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
  // Staff: the number the supervisor calls, e.g. when a job is not accepted. Never sent to students.
  phone?: string;
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
  // Exact time it happened (ISO). Sent to the app; not needed when adding a new entry.
  at?: string;
}

export interface Feedback {
  // 1-5, or null when the student confirmed without rating.
  rating: number | null;
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
  reportedAt?: string;
  photo: boolean;
  history: HistoryEntry[];
  feedback: Feedback | null;
  reopened: number;
  // When it was last assigned, and when the technician accepted it (null while waiting for them to accept).
  assignedAt?: string | null;
  acceptedAt?: string | null;
  // Only on reports filed with the AI assistant: its notes for maintenance (likely cause, what to bring).
  assistantNotes?: string;
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

// A spare part in the maintenance store room.
export interface SparePart {
  id: string;
  name: string;
  // Issue category key it is for (e.g. "electrical"), or "" for general use.
  category: string;
  unit: string;
  quantity: number;
  // Order more when stock drops to this.
  minQuantity: number;
  location: string;
  // True when stock is at or below minQuantity.
  low: boolean;
}

export type StockChangeType = "added" | "taken" | "restocked";

// One change to stock: a part taken for a job, or more added by the staff manager.
export interface StockMovement {
  id: string;
  partId: string;
  partName: string;
  unit: string;
  type: StockChangeType;
  // Positive in, negative out.
  change: number;
  // How many were left afterwards.
  balance: number;
  by: string | null;
  issueId: string | null;
  issueRef: string | null;
  note: string;
  at: string;
}

// Sample parts for `npm run reset-data`.
export interface SeedPart {
  name: string;
  category: string;
  unit: string;
  quantity: number;
  minQuantity: number;
  location: string;
  // Sample uses: who took one and for which job.
  taken?: { userId: string; issueId: string; quantity: number; note: string; date: string }[];
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
  // Spare parts in the store room. Optional for the same reason.
  parts?: SeedPart[];
}
