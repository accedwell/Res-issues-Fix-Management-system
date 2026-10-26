import type { MouseEvent } from 'react'
import { CATEGORY_SPECIALIZATION, DONE_STATUSES, GENERAL_SPECIALIZATION } from './data/constants'
import type { AppNotification, Auth, Issue, Staff } from './types'

export const formatDate = (date: string) =>
  new Date(date).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })

// Runs an action from a button inside a clickable row without also opening the row.
export const stop = (action: () => void) => (e: MouseEvent) => {
  e.stopPropagation()
  action()
}

export const isOpen = (issue: Issue) => !DONE_STATUSES.includes(issue.status)

// Whether a notification is meant for the logged-in user.
export const isForUser = (n: AppNotification, auth: Auth) =>
  (!!n.userId && n.userId === auth.userId) || (!!n.role && n.role === auth.role)

// Whether an issue belongs in one of the quick views (see ISSUE_VIEWS).
export function matchesView(issue: Issue, view: string): boolean {
  if (view === 'open') return isOpen(issue)
  if (view === 'unassigned') return isOpen(issue) && !issue.assignedTo
  if (view === 'urgent') return isOpen(issue) && issue.priority === 'Urgent'
  if (view === 'done') return !isOpen(issue)
  return true
}

// A student can send back any resolved or closed report if the problem is still there (or has come back).
export const canReportNotFixed = (issue: Issue) => DONE_STATUSES.includes(issue.status)

// Picks the staff member whose job matches the issue category, preferring whoever has the fewest open jobs.
// Returns undefined only when there is no maintenance staff at all.
export function recommendStaff(issue: Issue, staff: Staff[]): Staff | undefined {
  const specialization = CATEGORY_SPECIALIZATION[issue.category] ?? GENERAL_SPECIALIZATION
  const matching = staff.filter((s) => s.specialization === specialization)
  const general = staff.filter((s) => s.specialization === GENERAL_SPECIALIZATION)
  const pool = matching.length ? matching : general.length ? general : staff
  return pool.reduce<Staff | undefined>((best, s) => (!best || s.openJobs < best.openJobs ? s : best), undefined)
}

export const initials = (name: string) =>
  name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
