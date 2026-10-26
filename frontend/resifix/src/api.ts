import type { AppNotification, Category, Issue, NewIssue, Priority, Role, Setting, Staff, Status } from './types'

// Backend address. By default it is the same computer the page was opened from, on port 5000,
// so the app also works from a phone on the same Wi-Fi. Override with VITE_API_URL in a .env file.
const API_URL = import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:5000/api`
const TOKEN_KEY = 'resifix-token'

export interface ApiUser {
  id: string
  name: string
  email: string
  role: Role
  studentNumber?: string
  block?: string
  room?: string
  specialization?: string
  createdAt?: string
}

interface AuthResponse {
  token: string
  user: ApiUser
}

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    // Storage can be blocked (private mode); requests just go without a token.
    return null
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = getToken()

  let res: Response
  try {
    res = await fetch(API_URL + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new Error('Cannot reach the ResiFix server. Make sure the backend is running.')
  }

  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Something went wrong. Please try again.')
  return data as T
}

function saveToken(token: string) {
  try {
    localStorage.setItem(TOKEN_KEY, token)
  } catch {
    // Ignore — the user stays logged in until the page is refreshed.
  }
}

export function clearToken() {
  try {
    localStorage.removeItem(TOKEN_KEY)
  } catch {
    // Nothing to clear.
  }
}

export async function apiLogin(email: string, password: string): Promise<ApiUser> {
  const { token, user } = await request<AuthResponse>('POST', '/auth/login', { email, password })
  saveToken(token)
  return user
}

export interface SignupInput {
  firstName: string
  lastName: string
  studentNumber: string
  email: string
  block: string
  room: string
  password: string
}

export interface ForgotPasswordResponse {
  message: string
  // Only sent by a development backend, because email isn't set up yet.
  devCode?: string
}

export function apiForgotPassword(email: string): Promise<ForgotPasswordResponse> {
  return request<ForgotPasswordResponse>('POST', '/auth/forgot-password', { email })
}

export function apiResetPassword(email: string, code: string, password: string): Promise<{ message: string }> {
  return request<{ message: string }>('POST', '/auth/reset-password', { email, code, password })
}

export async function apiSignup(input: SignupInput): Promise<ApiUser> {
  const { token, user } = await request<AuthResponse>('POST', '/auth/signup', input)
  saveToken(token)
  return user
}

// ===== Session =====

// The logged-in user for a saved token, so a page refresh keeps you logged in.
export async function apiMe(): Promise<ApiUser> {
  return (await request<{ user: ApiUser }>('GET', '/auth/me')).user
}

// ===== Shared data =====

export const fetchIssues = async () => (await request<{ issues: Issue[] }>('GET', '/issues')).issues
export const fetchNotifications = async () =>
  (await request<{ notifications: AppNotification[] }>('GET', '/notifications')).notifications
export const fetchCategories = async () => (await request<{ categories: Category[] }>('GET', '/categories')).categories
export const fetchStaff = async () => (await request<{ staff: Staff[] }>('GET', '/users/staff')).staff
export const fetchUsers = async () => (await request<{ users: ApiUser[] }>('GET', '/users')).users
export const fetchSettings = async () => (await request<{ settings: Setting[] }>('GET', '/settings')).settings

// ===== Issues =====

export const apiCreateIssue = async (issue: NewIssue) => (await request<{ issue: Issue }>('POST', '/issues', issue)).issue
export const apiAssignIssue = (id: string, staffId: string, priority: Priority) =>
  request('POST', `/issues/${id}/assign`, { staffId, priority })
export const apiUpdateProgress = (id: string, status: Status, note: string) =>
  request('POST', `/issues/${id}/progress`, { status, note })
export const apiConfirmResolution = (id: string, rating: number, comment: string) =>
  request('POST', `/issues/${id}/confirm`, { rating, comment })
export const apiReportNotFixed = (id: string, reason: string) => request('POST', `/issues/${id}/not-fixed`, { reason })

// ===== Notifications =====

export const apiReadAllNotifications = () => request('POST', '/notifications/read-all')
export const apiReadNotification = (id: string) => request('POST', `/notifications/${id}/read`)

// ===== System administration =====

export interface NewUserInput {
  name: string
  email: string
  role: Role
  password: string
  specialization?: string
  studentNumber?: string
  block?: string
  room?: string
}

export const apiAddUser = (user: NewUserInput) => request('POST', '/users', user)
export const apiRemoveUser = (id: string) => request<{ unassignedJobs: number }>('DELETE', `/users/${id}`)
export const apiAddCategory = (name: string, icon: string) => request('POST', '/categories', { name, icon })
export const apiEditCategory = (key: string, name: string, icon: string) =>
  request('PATCH', `/categories/${key}`, { name, icon })
export const apiRemoveCategory = (key: string) => request<{ movedReports: number }>('DELETE', `/categories/${key}`)
export const apiSetSetting = (key: string, on: boolean) => request('PATCH', `/settings/${key}`, { on })

// ===== Live updates =====

export type Topic = 'issues' | 'notifications' | 'users' | 'staff' | 'categories' | 'settings'

// Opens the server's live-update stream. Calls onChange with the kinds of data that changed.
// The browser reconnects by itself if the connection drops. Returns a function that closes it.
export function connectLiveUpdates(onChange: (topics: Topic[]) => void, onStatus: (connected: boolean) => void) {
  const token = getToken()
  if (!token || typeof EventSource === 'undefined') return () => {}
  const source = new EventSource(`${API_URL}/events?token=${encodeURIComponent(token)}`)
  source.onopen = () => onStatus(true)
  source.onerror = () => onStatus(false)
  source.onmessage = (e) => {
    try {
      const { topics } = JSON.parse(e.data) as { topics: Topic[] }
      if (Array.isArray(topics)) onChange(topics)
    } catch {
      // Ignore anything that isn't a change message.
    }
  }
  return () => source.close()
}
