export type Role = 'student' | 'admin' | 'maintenance' | 'sysadmin' | 'supervisor'

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

// An open report of the same kind in the same block, shown before a student submits (no names).
export interface SimilarIssue {
  ref: string
  title: string
  status: Status
  room: string
  dateReported: string
  sameRoom: boolean
  mine: boolean
}

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
  // Clocked in with the QR code, and since when. Only on-duty technicians get new jobs automatically.
  onDuty: boolean
  onDutySince: string | null
  // Clocked in but on a break until breakUntil: no new jobs.
  onBreak: boolean
  breakUntil: string | null
  onLeaveToday: boolean
  // On duty and not on a break.
  available: boolean
  // The supervisor / system admin who clocked them in for them; null when they scanned in themselves.
  clockedInBy?: string | null
  // Number to call them on, when the system admin has saved one.
  phone?: string | null
}

// When the working day starts and ends, e.g. "07:30" and "16:30", and the weekdays worked
// (0 = Sunday ... 6 = Saturday). Set by the staff manager.
export interface WorkHours {
  start: string
  end: string
  days: number[]
}

// One technician's hours. custom is false when they just follow the team's hours.
export interface Schedule extends WorkHours {
  custom: boolean
}

// Days away; dates are "YYYY-MM-DD", both days included.
export interface Leave {
  id: string
  userId: string
  startDate: string
  endDate: string
  reason: string
}

// The logged-in technician's own clock-in state.
export interface DutyStatus {
  onDuty: boolean
  since: string | null
  onBreak: boolean
  breakUntil: string | null
  // Forgetting to clock out ends the shift after this many hours.
  maxHours: number
  // Break lengths they can pick, in minutes.
  breakOptions: number[]
  schedule: Schedule
  onLeaveToday: boolean
  // Their leave from today on.
  leave: Leave[]
}

// One clock-in today, for the staff manager's list.
export interface DutyShift {
  id: string
  userId: string
  name: string
  clockInAt: string
  clockOutAt: string | null
  autoClosed: boolean
  onBreak: boolean
  breakMinutes: number
  // Minutes late (0 = on time or early; null on a day they don't normally work).
  lateMinutes: number | null
  // Minutes before the end of work they clocked out, when they left early.
  earlyMinutes: number | null
  // Who did it for them (supervisor / system admin); null when they did it themselves.
  clockedInBy?: string | null
  clockedOutBy?: string | null
}

// The code to show at the office: the printed daily code, or the wall screen's 30-second code.
export interface ClockCode {
  mode: 'daily' | 'rotating'
  code: string
  day: string
  // Wall screen only: when the next code appears.
  changesAt: string | null
  rotateSeconds: number
}

// What the staff manager's Clock-in page needs about hours and leave.
export interface DutySchedules {
  team: WorkHours
  today: string
  people: { userId: string; schedule: Schedule; onLeaveToday: boolean }[]
  leave: Leave[]
}

// One technician's month in the attendance report.
export interface AttendanceRow {
  userId: string
  name: string
  specialization: string
  scheduledDays: number
  daysWorked: number
  missedDays: number
  leaveDays: number
  lateDays: number
  lateMinutes: number
  earlyLeaves: number
  forgotClockOut: number
  hoursWorked: number
  breakMinutes: number
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
  // Staff only (supervisor, staff manager, system admin): the technician's number, to call them.
  assignedToPhone?: string | null
  dateReported: string
  reportedAt?: string
  photo: boolean
  history: HistoryEntry[]
  feedback: Feedback | null
  reopened?: number
  // When it was last assigned, and when the technician accepted it (null while waiting for them to accept).
  assignedAt?: string | null
  acceptedAt?: string | null
  // Sent by the server when the viewer may see the chat on this report (see Chat.tsx).
  chat?: ChatSummary | null
  // Only on reports filed with the AI assistant: its notes for maintenance (likely cause, what to bring).
  assistantNotes?: string
}

// ===== AI report assistant =====

export interface AssistantMessage {
  role: 'user' | 'assistant'
  content: string
}

// The report the assistant has put together from the conversation so far.
export interface ReportDraft {
  title: string
  category: string
  priority: Priority
  room: string
  description: string
  maintenanceNotes: string
}

export interface AssistantReply {
  reply: string
  // True once the assistant knows what is wrong and where, so the report can be submitted.
  ready: boolean
  draft: ReportDraft
}

// What the app sends to file the assistant's report. The same submissionId is sent again on a
// retry, so a double tap or lost connection never files the report twice.
export interface AssistantSubmission extends ReportDraft {
  submissionId: string
  photo?: PhotoUpload
}

export interface NewIssue {
  title: string
  category: string
  priority: Priority
  residence: string
  room: string
  description: string
  photo?: PhotoUpload
}

// A report photo on its way to the server: data is base64 without the "data:" prefix.
export interface PhotoUpload {
  mimeType: string
  data: string
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
  // What the system administrator can correct (see EditUserModal).
  kind: Role
  block?: string
  room?: string
  specialization?: string
  phone?: string
}

// A spare part in the maintenance store room.
export interface SparePart {
  id: string
  name: string
  // Issue category key it is for (e.g. 'electrical'), or '' for general use.
  category: string
  unit: string
  quantity: number
  // Order more when stock drops to this.
  minQuantity: number
  location: string
  // At or below the order level.
  low: boolean
}

// One change to stock: a part taken for a job, or more added by the staff manager.
export interface StockMovement {
  id: string
  partId: string
  partName: string
  unit: string
  type: 'added' | 'taken' | 'restocked'
  // Positive in, negative out.
  change: number
  // How many were left afterwards.
  balance: number
  by: string | null
  issueId: string | null
  issueRef: string | null
  note: string
  at: string
}

// What the staff manager fills in to add or edit a part.
export interface PartInput {
  name: string
  category: string
  unit: string
  minQuantity: number
  location: string
  // Starting stock; only used when adding a part.
  quantity?: number
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
  // Students: the block and room they registered with. Their reports always use this block.
  block?: string
  room?: string
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
  | { type: 'overdue' }
  | { type: 'detail' | 'assign' | 'update' | 'feedback' | 'notfixed' | 'editReport' | 'cancelReport' | 'chat' | 'decline'; issueId: string }
  | { type: 'addUser' }
  | { type: 'removeUser'; userId: string }
  | { type: 'editUser'; userId: string }
  | { type: 'addCategory' }
  | { type: 'editCategory'; categoryKey: string }
  | { type: 'removeCategory'; categoryKey: string }
  | { type: 'addPart' }
  | { type: 'takePart' | 'restockPart' | 'editPart' | 'removePart' | 'requestPart'; partId: string }

// Chat on a report between the student and the assigned staff member. Admins can only read it.
export interface ChatSummary {
  canSend: boolean
  total: number
  unread: number
}

export interface ChatMessage {
  id: string
  body: string
  at: string // ISO time
  mine: boolean
  // "You", the staff member's name, or "Student" (maintenance never sees the student's name).
  from: string
}
