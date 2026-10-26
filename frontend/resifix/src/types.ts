export type Role = 'student' | 'admin' | 'maintenance' | 'sysadmin'

export type Route = 'landing' | 'login' | 'signup' | 'forgot'

export type Status =
  | 'Submitted'
  | 'Received'
  | 'Assigned'
  | 'In Progress'
  | 'Not Resolved'
  | 'Resolved'
  | 'Closed'

export type Priority = 'Low' | 'Normal' | 'High' | 'Urgent'

export interface Category {
  key: string
  name: string
  icon: string
}

export interface Staff {
  id: string
  name: string
  specialization: string
  // Unfinished jobs, as counted by the server.
  openJobs: number
}

export interface HistoryEntry {
  status: Status
  date: string
  note: string
  // Exact time it happened, sent by the server (used to order the activity feed).
  at?: string
}

export interface Feedback {
  // 1-5, or null when the student confirmed without rating.
  rating: number | null
  comment: string
}

export interface Issue {
  id: string
  ref: string
  title: string
  category: string
  description: string
  residence: string
  room: string
  priority: Priority
  status: Status
  studentName: string
  studentId: string
  assignedTo: string | null
  // Sent by the server so students can see who is working on their report.
  assignedToName?: string | null
  dateReported: string
  photo: boolean
  history: HistoryEntry[]
  feedback: Feedback | null
  reopened?: number
}

export interface NewIssue {
  title: string
  category: string
  priority: Priority
  residence: string
  room: string
  description: string
  photo: boolean
}

// Sent either to one person (userId) or to everyone with a role, e.g. all residence admins.
export interface AppNotification {
  id: string
  userId?: string
  role?: Role
  message: string
  date: string
  read: boolean
  // The issue it is about, so it can be opened from the bell.
  issueId?: string
}

export interface User {
  id: string
  name: string
  role: string
  email: string
  extra: string
}

export interface Setting {
  key: string
  label: string
  on: boolean
}

export interface Auth {
  loggedIn: boolean
  role: Role | null
  name: string | null
  userId: string | null
  studentId: string | null
}

export interface Filters {
  // Quick view picked from the dashboard tiles: all, open, unassigned, urgent or done.
  view: string
  status: string
  category: string
  residence: string
  // A maintenance staff member id, to see one person's jobs.
  assignee: string
  // One exact room or location within the chosen block (from the hotspots report).
  room: string
  search: string
}

export interface NavItem {
  key: string
  label: string
  icon: string
}

export type Modal =
  | { type: 'detail' | 'assign' | 'update' | 'feedback' | 'notfixed'; issueId: string }
  | { type: 'addUser' }
  | { type: 'removeUser'; userId: string }
  | { type: 'addCategory' }
  | { type: 'editCategory'; categoryKey: string }
  | { type: 'removeCategory'; categoryKey: string }
