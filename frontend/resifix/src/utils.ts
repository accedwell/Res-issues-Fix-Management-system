import type { MouseEvent } from 'react'
import { CATEGORY_SPECIALIZATION, DONE_STATUSES, GENERAL_SPECIALIZATION, STAFF } from './data/constants'
import type { Issue, Staff } from './types'

export const formatDate = (date: string) =>
  new Date(date).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })

// Runs an action from a button inside a clickable row without also opening the row.
export const stop = (action: () => void) => (e: MouseEvent) => {
  e.stopPropagation()
  action()
}

export const isOpen = (issue: Issue) => !DONE_STATUSES.includes(issue.status)

// A student can send back any resolved or closed report if the problem is still there (or has come back).
export const canReportNotFixed = (issue: Issue) => DONE_STATUSES.includes(issue.status)

export const openJobCount = (staffId: string, issues: Issue[]) =>
  issues.filter((i) => i.assignedTo === staffId && isOpen(i)).length

// Picks the staff member whose job matches the issue category, preferring whoever has the fewest open jobs.
export function recommendStaff(issue: Issue, issues: Issue[]): Staff {
  const specialization = CATEGORY_SPECIALIZATION[issue.category] ?? GENERAL_SPECIALIZATION
  const matching = STAFF.filter((s) => s.specialization === specialization)
  const general = STAFF.filter((s) => s.specialization === GENERAL_SPECIALIZATION)
  const pool = matching.length ? matching : general.length ? general : STAFF
  return pool.reduce((best, s) => (openJobCount(s.id, issues) < openJobCount(best.id, issues) ? s : best))
}

export const initials = (name: string) =>
  name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
