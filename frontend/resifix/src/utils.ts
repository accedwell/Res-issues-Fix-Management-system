import type { MouseEvent } from 'react'
import { CATEGORY_SPECIALIZATION, DONE_STATUSES, GENERAL_SPECIALIZATION, OVERDUE_AFTER_DAYS } from './data/constants'
import type { AppNotification, Auth, Issue, Staff } from './types'

export const formatDate = (date: string) =>
  new Date(date).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })

// Runs an action from a button inside a clickable row without also opening the row.
export const stop = (action: () => void) => (e: MouseEvent) => {
  e.stopPropagation()
  action()
}

export const isOpen = (issue: Issue) => !DONE_STATUSES.includes(issue.status)

const DAY_MS = 24 * 60 * 60 * 1000

// Whole days since the issue was reported (dates are YYYY-MM-DD, counted in UTC like the server).
export const daysOpen = (issue: Issue) =>
  Math.max(0, Math.floor((Date.parse(new Date().toISOString().slice(0, 10)) - Date.parse(issue.dateReported)) / DAY_MS))

// Still open after the time allowed for its priority.
export const isOverdue = (issue: Issue) => isOpen(issue) && daysOpen(issue) > OVERDUE_AFTER_DAYS[issue.priority]

// Whether a notification is meant for the logged-in user.
export const isForUser = (n: AppNotification, auth: Auth) =>
  (!!n.userId && n.userId === auth.userId) || (!!n.role && n.role === auth.role)

// Whether an issue belongs in one of the quick views (see ISSUE_VIEWS).
export function matchesView(issue: Issue, view: string): boolean {
  if (view === 'open') return isOpen(issue)
  if (view === 'unassigned') return isOpen(issue) && !issue.assignedTo
  if (view === 'urgent') return isOpen(issue) && issue.priority === 'Urgent'
  if (view === 'overdue') return isOverdue(issue)
  if (view === 'reopened') return (issue.reopened ?? 0) > 0
  if (view === 'done') return !isOpen(issue)
  return true
}

// A student can send back a report that was resolved or closed (the problem is still there or came back),
// that maintenance could not resolve, or that is overdue. The server uses the same rule.
export const canReportNotFixed = (issue: Issue) =>
  DONE_STATUSES.includes(issue.status) || issue.status === 'Not Resolved' || isOverdue(issue)

// Picks the staff member whose job matches the issue category, preferring whoever has the fewest open jobs.
// Returns undefined only when there is no maintenance staff at all.
export function recommendStaff(issue: Issue, staff: Staff[]): Staff | undefined {
  const specialization = CATEGORY_SPECIALIZATION[issue.category] ?? GENERAL_SPECIALIZATION
  const matching = staff.filter((s) => s.specialization === specialization)
  const general = staff.filter((s) => s.specialization === GENERAL_SPECIALIZATION)
  const pool = matching.length ? matching : general.length ? general : staff
  return pool.reduce<Staff | undefined>((best, s) => (!best || s.openJobs < best.openJobs ? s : best), undefined)
}

// A student can edit or cancel their own report until the admin receives it (the server checks too).
export const canEditReport = (issue: Issue, auth: Auth) =>
  auth.role === 'student' && issue.studentId === auth.studentId && issue.status === 'Submitted'

// Why maintenance marked the job Not Resolved (their comment), while it is still in that state.
export function notResolvedReason(issue: Issue): { date: string; reason: string } | undefined {
  if (issue.status !== 'Not Resolved') return undefined
  const entry = [...issue.history].reverse().find((h) => h.status === 'Not Resolved')
  return entry ? { date: entry.date, reason: entry.note } : undefined
}

const NOT_FIXED_NOTE = 'Student reported the issue is NOT fixed: '

// The most recent time a student sent the issue back, with their reason.
export function lastReopen(issue: Issue): { date: string; reason: string } | undefined {
  const entry = [...issue.history].reverse().find((h) => h.note.startsWith(NOT_FIXED_NOTE))
  return entry ? { date: entry.date, reason: entry.note.slice(NOT_FIXED_NOTE.length) } : undefined
}

// Rooms are typed by students, so compare them ignoring case and extra spaces.
export const sameRoom = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

export const initials = (name: string) =>
  name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
