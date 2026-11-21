import { createContext, useContext } from 'react'
import type { NewUserInput } from '../api'
import type {
  AppNotification, AssistantSubmission, Auth, Category, DutyStatus, Filters, Issue, Modal, NewIssue, PartInput, Priority, Role, Route, Setting, SparePart, Staff,
  Status, StockMovement, User,
} from '../types'

export interface AppState {
  route: Route
  setRoute: (route: Route) => void
  auth: Auth
  // True while a saved login is being checked after the page loads.
  restoring: boolean
  // False until the first load of data after logging in has finished.
  ready: boolean
  login: (name: string, role: Role, userId: string, home?: { block?: string; room?: string }) => void
  logout: () => void
  tabs: Record<Role, string>
  setTab: (tab: string) => void
  modal: Modal | null
  setModal: (modal: Modal | null) => void
  toast: { msg: string; id: number } | null
  issues: Issue[]
  notifications: AppNotification[]
  users: User[]
  staff: Staff[]
  categories: Category[]
  settings: Setting[]
  // The parts store (maintenance staff and the staff manager only).
  parts: SparePart[]
  // Recent stock changes: all of them for the staff manager, a technician's own for maintenance.
  stockMovements: StockMovement[]
  filters: Filters
  setFilters: (filters: Filters) => void
  // Reload reports and notifications, e.g. after opening a chat so its unread badge clears.
  refreshIssues: () => void
  // The actions below save to the server; each resolves to true when it worked.
  addIssue: (issue: NewIssue) => Promise<boolean>
  // Files a report written with the AI assistant; it goes straight to the matching maintenance person.
  addAssistantIssue: (report: AssistantSubmission) => Promise<boolean>
  receiveIssue: (issue: Issue) => Promise<boolean>
  assignIssue: (issue: Issue, staffId: string, priority: Priority) => Promise<boolean>
  updateProgress: (issue: Issue, status: Status, note: string) => Promise<boolean>
  confirmResolution: (issue: Issue, rating: number | null, comment: string) => Promise<boolean>
  reportNotFixed: (issue: Issue, reason: string) => Promise<boolean>
  editReport: (issue: Issue, changes: Omit<NewIssue, 'photo'>) => Promise<boolean>
  cancelReport: (issue: Issue) => Promise<boolean>
  addUser: (user: NewUserInput) => Promise<boolean>
  removeUser: (userId: string) => Promise<boolean>
  editUser: (userId: string, details: { block?: string; room?: string; specialization?: string }) => Promise<boolean>
  addCategory: (name: string, icon: string) => Promise<boolean>
  editCategory: (key: string, name: string, icon: string) => Promise<boolean>
  removeCategory: (key: string) => Promise<boolean>
  toggleSetting: (key: string) => Promise<boolean>
  takePart: (part: SparePart, quantity: number, issueId: string, note: string) => Promise<boolean>
  requestPart: (part: SparePart, note: string) => Promise<boolean>
  restockPart: (part: SparePart, quantity: number, note: string) => Promise<boolean>
  addPart: (part: PartInput) => Promise<boolean>
  editPart: (id: string, part: PartInput) => Promise<boolean>
  removePart: (part: SparePart) => Promise<boolean>
  // Maintenance only: whether they are clocked in. Null for other roles.
  duty: DutyStatus | null
  // True when the clock-in QR code was scanned and is waiting for the technician to log in.
  pendingClockIn: boolean
  // Clock in with today's code (from the QR code, or typed), and clock out.
  clockIn: (code: string) => Promise<boolean>
  // handBack: unfinished jobs given back to the staff manager when leaving.
  clockOut: (handBack: string[]) => Promise<boolean>
  startBreak: (minutes: number) => Promise<boolean>
  // "I'm back" before the break time is up.
  endBreak: () => Promise<boolean>
  markNotificationsRead: () => void
  markNotificationRead: (id: string) => void
  catInfo: (key: string) => Category
}

export const AppContext = createContext<AppState | null>(null)

export function useApp(): AppState {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside AppProvider')
  return ctx
}
