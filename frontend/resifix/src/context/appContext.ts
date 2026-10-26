import { createContext, useContext } from 'react'
import type { NewUserInput } from '../api'
import type {
  AppNotification, Auth, Category, Filters, Issue, Modal, NewIssue, Priority, Role, Route, Setting, Staff, Status, User,
} from '../types'

export interface AppState {
  route: Route
  setRoute: (route: Route) => void
  auth: Auth
  // True while a saved login is being checked after the page loads.
  restoring: boolean
  // False until the first load of data after logging in has finished.
  ready: boolean
  // Whether the live-update connection to the server is open.
  live: boolean
  login: (name: string, role: Role, userId: string) => void
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
  filters: Filters
  setFilters: (filters: Filters) => void
  // The actions below save to the server; each resolves to true when it worked.
  addIssue: (issue: NewIssue) => Promise<boolean>
  receiveIssue: (issue: Issue) => Promise<boolean>
  assignIssue: (issue: Issue, staffId: string, priority: Priority) => Promise<boolean>
  updateProgress: (issue: Issue, status: Status, note: string) => Promise<boolean>
  confirmResolution: (issue: Issue, rating: number, comment: string) => Promise<boolean>
  reportNotFixed: (issue: Issue, reason: string) => Promise<boolean>
  addUser: (user: NewUserInput) => Promise<boolean>
  removeUser: (userId: string) => Promise<boolean>
  addCategory: (name: string, icon: string) => Promise<boolean>
  editCategory: (key: string, name: string, icon: string) => Promise<boolean>
  removeCategory: (key: string) => Promise<boolean>
  toggleSetting: (key: string) => Promise<boolean>
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
