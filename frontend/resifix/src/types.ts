export type Role = 'student' | 'admin' | 'maintenance' | 'sysadmin'

export type Route = 'landing' | 'login' | 'signup' | 'forgot'

export type Status =
  | 'Submitted'
  | 'Received'
  | 'Assigned'
  | 'In Progress'
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
}

export interface HistoryEntry {
  status: Status
  date: string
  note: string
}

export interface Feedback {
  rating: number
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

export interface AppNotification {
  id: string
  studentId: string
  message: string
  date: string
  read: boolean
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
  studentId: string | null
}

export interface Filters {
  status: string
  category: string
  residence: string
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
