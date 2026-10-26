import { daysOpen, isOpen, isOverdue } from './utils'
import type { Category, Issue, Status } from './types'

// Turns issues into a CSV file that opens cleanly in Excel, and downloads it.

// The day the issue last reached a status, or '' if it never did.
const lastDate = (issue: Issue, status: Status) => [...issue.history].reverse().find((h) => h.status === status)?.date ?? ''

// Open issues: days since reported. Finished ones: days it took to fix (report to resolved, or closed).
function daysTaken(issue: Issue): number {
  const fixed = lastDate(issue, 'Resolved') || lastDate(issue, 'Closed')
  if (isOpen(issue) || !fixed) return daysOpen(issue)
  return Math.max(0, Math.round((Date.parse(fixed) - Date.parse(issue.dateReported)) / 86_400_000))
}

// Quote every cell, and stop text that starts like a formula (=, +, -, @) from running in Excel.
function cell(value: string | number): string {
  let text = String(value)
  if (/^[=+\-@\t\r]/.test(text)) text = "'" + text
  return '"' + text.replace(/"/g, '""') + '"'
}

const COLUMNS: [string, (issue: Issue, categoryName: string) => string | number][] = [
  ['Reference', (i) => i.ref],
  ['Title', (i) => i.title],
  ['Category', (_, c) => c],
  ['Priority', (i) => i.priority],
  ['Status', (i) => i.status],
  ['Block', (i) => i.residence],
  ['Room / location', (i) => i.room],
  ['Reported by', (i) => i.studentName],
  ['Date reported', (i) => i.dateReported],
  ['Assigned to', (i) => i.assignedToName ?? ''],
  ['Days open (or to fix)', (i) => daysTaken(i)],
  ['Overdue', (i) => (isOverdue(i) ? 'Yes' : 'No')],
  ['Times re-opened', (i) => i.reopened ?? 0],
  ['Date resolved', (i) => lastDate(i, 'Resolved')],
  ['Date closed', (i) => lastDate(i, 'Closed')],
  ['Rating (1-5)', (i) => i.feedback?.rating ?? ''],
  ['Feedback comment', (i) => i.feedback?.comment ?? ''],
  ['Description', (i) => i.description],
]

export function issuesToCsv(issues: Issue[], catInfo: (key: string) => Category): string {
  const rows = [
    COLUMNS.map(([name]) => cell(name)).join(','),
    ...issues.map((issue) => COLUMNS.map(([, get]) => cell(get(issue, catInfo(issue.category).name))).join(',')),
  ]
  // The byte-order mark tells Excel the file is UTF-8, so names like "Mokoena · Room 2" show correctly.
  return '﻿' + rows.join('\r\n') + '\r\n'
}

export function downloadIssuesCsv(issues: Issue[], catInfo: (key: string) => Category, name: string) {
  const blob = new Blob([issuesToCsv(issues, catInfo)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${name}-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
