import type { MouseEvent } from 'react'
import { DONE_STATUSES } from './data/constants'
import type { Issue } from './types'

export const formatDate = (date: string) =>
  new Date(date).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })

// Runs an action from a button inside a clickable row without also opening the row.
export const stop = (action: () => void) => (e: MouseEvent) => {
  e.stopPropagation()
  action()
}

export const isOpen = (issue: Issue) => !DONE_STATUSES.includes(issue.status)

export const initials = (name: string) =>
  name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
