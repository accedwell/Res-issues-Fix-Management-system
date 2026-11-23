import type {
  AppNotification,
  AssistantMessage,
  AssistantReply,
  AssistantSubmission,
  Category,
  ChatMessage,
  AttendanceRow,
  ClockCode,
  DutySchedules,
  DutyShift,
  DutyStatus,
  Leave,
  Schedule,
  WorkHours,
  Issue,
  NewIssue,
  Priority,
  Role,
  PartInput,
  Setting,
  SimilarIssue,
  SparePart,
  Staff,
  Status,
  StockMovement,
} from './types'
import { getToken, saveToken } from './authSession'
export { getToken, clearToken } from './authSession'

// Backend address. By default it is the same computer the page was opened from, on port 5000,
// so the app also works from a phone on the same Wi-Fi. Override with VITE_API_URL in a .env file.
const API_URL = import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:5000/api`

export interface ApiUser {
  id: string
  name: string
  email: string
  role: Role
  studentNumber?: string
  block?: string
  room?: string
  specialization?: string
  phone?: string
  createdAt?: string
}

interface AuthResponse {
  token: string
  user: ApiUser
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

// The report's photo as a link the page can show. Loaded with the login token, like every request.
export async function fetchIssuePhoto(id: string): Promise<string> {
  const token = getToken()
  const res = await fetch(`${API_URL}/issues/${id}/photo`, { headers: token ? { Authorization: 'Bearer ' + token } : {} })
  if (!res.ok) throw new Error('The photo could not be loaded.')
  return URL.createObjectURL(await res.blob())
}

export const fetchSimilarIssues = async (category: string, residence: string, room: string) =>
  (
    await request<{ similar: SimilarIssue[] }>(
      'GET',
      `/issues/similar?${new URLSearchParams({ category, residence, room })}`,
    )
  ).similar
export const apiCreateIssue = async (issue: NewIssue) => (await request<{ issue: Issue }>('POST', '/issues', issue)).issue
export const apiEditIssue = (id: string, changes: Omit<NewIssue, 'photo'>) => request('PATCH', `/issues/${id}`, changes)
export const apiCancelIssue = (id: string) => request('DELETE', `/issues/${id}`)
export const apiReceiveIssue = (id: string) => request('POST', `/issues/${id}/receive`)
export const apiAssignIssue = (id: string, staffId: string, priority: Priority) =>
  request('POST', `/issues/${id}/assign`, { staffId, priority })
export const apiUpdateProgress = (id: string, status: Status, note: string) =>
  request('POST', `/issues/${id}/progress`, { status, note })
export const apiConfirmResolution = (id: string, rating: number | null, comment: string) =>
  request('POST', `/issues/${id}/confirm`, { rating, comment })
export const apiReportNotFixed = (id: string, reason: string) => request('POST', `/issues/${id}/not-fixed`, { reason })
// The assigned technician accepts or turns down a new job. A declined job goes to someone else on duty.
export const apiAcceptJob = (id: string) => request('POST', `/issues/${id}/accept`)
export const apiDeclineJob = (id: string, reason: string) =>
  request<{ ok: boolean; passedTo: string | null }>('POST', `/issues/${id}/decline`, { reason })
// The staff manager phoned the technician, who accepted the job.
export const apiAcceptedByPhone = (id: string) => request('POST', `/issues/${id}/accepted-by-phone`)

// ===== AI report assistant =====

// Whether the server has the assistant switched on (it needs a Groq key in backend/.env).
export const fetchAssistantEnabled = async () => (await request<{ enabled: boolean }>('GET', '/assistant')).enabled
// One turn of the conversation: the messages so far in, the assistant's reply and draft report out.
export const apiAskAssistant = (messages: AssistantMessage[]) =>
  request<AssistantReply>('POST', '/assistant/chat', { messages })
// Files the assistant's report; the server assigns it to the matching maintenance person straight away.
export const apiSubmitAssistantReport = async (report: AssistantSubmission) =>
  (await request<{ issue: Issue }>('POST', '/issues/assistant', report)).issue

// The chat on a report. Opening it marks the other person's messages as read.
export const fetchChat = (id: string) => request<{ messages: ChatMessage[]; canSend: boolean }>('GET', `/issues/${id}/messages`)
export const apiSendMessage = (id: string, body: string) =>
  request<{ messages: ChatMessage[]; canSend: boolean }>('POST', `/issues/${id}/messages`, { body })

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
  phone?: string
  studentNumber?: string
  block?: string
  room?: string
}

export const apiAddUser = (user: NewUserInput) => request('POST', '/users', user)
export const apiRemoveUser = (id: string) => request<{ unassignedJobs: number }>('DELETE', `/users/${id}`)
// Students: { block, room }. Maintenance staff: { specialization }.
export const apiEditUser = (id: string, details: { block?: string; room?: string; specialization?: string; phone?: string }) =>
  request('PATCH', `/users/${id}`, details)
export const apiAddCategory = (name: string, icon: string) => request('POST', '/categories', { name, icon })
export const apiEditCategory = (key: string, name: string, icon: string) =>
  request('PATCH', `/categories/${key}`, { name, icon })
export const apiRemoveCategory = (key: string) => request<{ movedReports: number }>('DELETE', `/categories/${key}`)
export const apiSetSetting = (key: string, on: boolean) => request('PATCH', `/settings/${key}`, { on })

// ===== Parts store (maintenance staff and the staff manager) =====

export const fetchParts = () => request<{ parts: SparePart[]; movements: StockMovement[] }>('GET', '/parts')
export const apiTakePart = (id: string, quantity: number, issueId: string, note: string) =>
  request<{ part: SparePart }>('POST', `/parts/${id}/take`, { quantity, issueId: issueId || undefined, note })
export const apiRequestPart = (id: string, note: string) => request('POST', `/parts/${id}/request`, { note })
export const apiRestockPart = (id: string, quantity: number, note: string) =>
  request<{ part: SparePart }>('POST', `/parts/${id}/restock`, { quantity, note })
export const apiAddPart = (part: PartInput) => request<{ part: SparePart }>('POST', '/parts', part)
export const apiEditPart = (id: string, part: PartInput) => request<{ part: SparePart }>('PATCH', `/parts/${id}`, part)
export const apiRemovePart = (id: string) => request('DELETE', `/parts/${id}`)

// ===== Clock-in (QR code) =====

// Technicians
export const fetchMyDuty = () => request<DutyStatus>('GET', '/duty/me')
export const apiClockIn = (code: string) => request<DutyStatus>('POST', '/duty/clock-in', { code })
// handBack: unfinished jobs to give back to the staff manager when leaving.
export const apiClockOut = (handBack: string[] = []) => request<DutyStatus>('POST', '/duty/clock-out', { handBack })
export const apiStartBreak = (minutes: number) => request<DutyStatus>('POST', '/duty/break', { minutes })
export const apiEndBreak = () => request<DutyStatus>('POST', '/duty/break/end')
// The supervisor or system admin updating a technician's availability for them (no QR code needed).
export const apiStaffClockIn = (userId: string) => request('POST', `/duty/staff/${userId}/clock-in`)
export const apiStaffClockOut = (userId: string, handBack: string[]) => request('POST', `/duty/staff/${userId}/clock-out`, { handBack })
export const apiStaffBreak = (userId: string, minutes: number) => request('POST', `/duty/staff/${userId}/break`, { minutes })
export const apiStaffEndBreak = (userId: string) => request('POST', `/duty/staff/${userId}/break/end`)

// Staff manager
export const fetchClockInCode = () => request<ClockCode>('GET', '/duty/code')
export const apiRenewClockInCode = () => request<{ ok: boolean }>('POST', '/duty/code')
export const apiSetCodeMode = (mode: ClockCode['mode']) => request<{ mode: ClockCode['mode'] }>('PUT', '/duty/mode', { mode })
export const fetchShiftsToday = async () => (await request<{ shifts: DutyShift[] }>('GET', '/duty/shifts')).shifts
export const fetchSchedules = () => request<DutySchedules>('GET', '/duty/schedules')
export const apiSetTeamHours = (hours: WorkHours) => request<{ team: WorkHours }>('PUT', '/duty/hours', hours)
// null puts them back on the team's hours.
export const apiSetSchedule = (userId: string, hours: WorkHours | null) =>
  request<{ schedule: Schedule }>('PUT', `/duty/schedules/${userId}`, hours ?? { useTeam: true })
export const apiAddLeave = (leave: Omit<Leave, 'id'>) => request<{ leave: Leave }>('POST', '/duty/leave', leave)
export const apiRemoveLeave = (id: string) => request('DELETE', `/duty/leave/${id}`)
export const fetchAttendance = (month: string) =>
  request<{ month: string; rows: AttendanceRow[] }>('GET', `/duty/attendance?month=${encodeURIComponent(month)}`)

// ===== Live updates =====

export type Topic = 'issues' | 'notifications' | 'users' | 'staff' | 'categories' | 'settings' | 'parts' | 'duty'

const RECONNECT_MS = 3000
const ALL_TOPICS: Topic[] = ['issues', 'notifications', 'users', 'staff', 'categories', 'settings', 'parts', 'duty']

// Opens the server's live-update stream. Calls onChange with the kinds of data that changed.
// Voice-call messages ("call" events) are passed to onCall. Returns a function that closes it.
// The stream is opened with a one-time ticket (not the login token, which would end up in the URL),
// so after a dropped connection it reconnects with a fresh ticket, and catches up on what it missed.
export function connectLiveUpdates(onChange: (topics: Topic[]) => void, onCall: (signal: CallSignal) => void) {
  if (!getToken() || typeof EventSource === 'undefined') return () => {}
  let source: EventSource | null = null
  let retry: number | undefined
  let closed = false
  let missed = false

  const open = async () => {
    const ticket = await request<{ ticket: string }>('POST', '/events/ticket')
      .then((r) => r.ticket)
      .catch(() => null)
    if (closed) return
    if (!ticket) {
      // Server unreachable: keep trying.
      retry = window.setTimeout(() => void open(), RECONNECT_MS)
      return
    }
    const s = new EventSource(`${API_URL}/events?ticket=${encodeURIComponent(ticket)}`)
    source = s
    s.onmessage = (e) => {
      try {
        const { topics } = JSON.parse(e.data) as { topics: Topic[] }
        if (Array.isArray(topics)) onChange(topics)
      } catch {
        // Ignore anything that isn't a change message.
      }
    }
    s.addEventListener('call', (e) => {
      try {
        onCall(JSON.parse((e as MessageEvent).data) as CallSignal)
      } catch {
        // Ignore a broken call message.
      }
    })
    s.onopen = () => {
      if (!missed) return
      missed = false
      onChange(ALL_TOPICS)
    }
    s.onerror = () => {
      // The ticket is used up, so the browser's own retry would fail: start again with a new one.
      s.close()
      missed = true
      if (!closed) retry = window.setTimeout(() => void open(), RECONNECT_MS)
    }
  }
  void open()

  return () => {
    closed = true
    clearTimeout(retry)
    source?.close()
  }
}

// ===== Voice calls =====

export type CallSignalType = 'ring' | 'answer' | 'ice' | 'end' | 'decline' | 'busy' | 'missed'

// A call message from the other person on a report. "from" is their name, or "Student" for maintenance.
export interface CallSignal {
  issueId: string
  ref: string
  from: string
  type: CallSignalType
  data: unknown
}

// Sends a call message to the other person. delivered is false when they are not on ResiFix right now.
export const apiCallSignal = (issueId: string, type: CallSignalType, data?: unknown) =>
  request<{ delivered: boolean }>('POST', `/calls/${issueId}`, { type, data })
