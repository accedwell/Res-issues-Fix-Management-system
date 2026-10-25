import { createContext, useContext } from 'react'
import type {
  AppNotification, Auth, Category, Filters, Issue, Modal, NewIssue, Priority, Role, Route, Setting, Status, User,
} from '../types'

export interface AppState {
  route: Route
  setRoute: (route: Route) => void
  auth: Auth
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
  categories: Category[]
  settings: Setting[]
  filters: Filters
  setFilters: (filters: Filters) => void
  addIssue: (issue: NewIssue) => void
  assignIssue: (issue: Issue, staffId: string, priority: Priority) => void
  updateProgress: (issue: Issue, status: Status, note: string) => void
  confirmResolution: (issue: Issue, rating: number, comment: string) => void
  reportNotFixed: (issue: Issue, reason: string) => void
  addUser: (user: Omit<User, 'id'>) => void
  removeUser: (userId: string) => void
  addCategory: (name: string, icon: string) => void
  editCategory: (key: string, name: string, icon: string) => void
  removeCategory: (key: string) => void
  toggleSetting: (key: string) => void
  markNotificationsRead: (studentId: string) => void
  catInfo: (key: string) => Category
}

export const AppContext = createContext<AppState | null>(null)

export function useApp(): AppState {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside AppProvider')
  return ctx
}
