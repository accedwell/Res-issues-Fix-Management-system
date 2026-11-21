import type { WorkHours } from './types'

// Helpers for clock-in, schedules and attendance.

// Weekdays in the order shown (Monday first); the number is JavaScript's (0 = Sunday).
export const WEEK = [
  { day: 1, short: 'Mon' },
  { day: 2, short: 'Tue' },
  { day: 3, short: 'Wed' },
  { day: 4, short: 'Thu' },
  { day: 5, short: 'Fri' },
  { day: 6, short: 'Sat' },
  { day: 0, short: 'Sun' },
]

// "Mon–Fri", "Mon–Sat", "Mon, Wed, Fri", "Every day".
export function describeDays(days: number[]): string {
  const ordered = WEEK.filter((w) => days.includes(w.day))
  if (ordered.length === 7) return 'Every day'
  if (!ordered.length) return 'No days'
  const positions = ordered.map((w) => WEEK.indexOf(w))
  const inARow = positions.every((p, i) => i === 0 || p === positions[i - 1] + 1)
  if (inARow && ordered.length > 2) return `${ordered[0].short}–${ordered[ordered.length - 1].short}`
  return ordered.map((w) => w.short).join(', ')
}

// "Mon–Fri, 07:30–16:30"
export const describeHours = (hours: WorkHours) => `${describeDays(hours.days)}, ${hours.start}–${hours.end}`

// 95 -> "1 h 35 min"
export const span = (minutes: number) =>
  minutes >= 60 ? `${Math.floor(minutes / 60)} h${minutes % 60 ? ` ${minutes % 60} min` : ''}` : `${minutes} min`

// "2026-11-24" -> "Tue 24 Nov"
export const shortDay = (day: string) =>
  new Date(`${day}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })

export const leaveSpan = (start: string, end: string) => (start === end ? shortDay(start) : `${shortDay(start)} – ${shortDay(end)}`)

// Today on this device as "YYYY-MM-DD".
export const todayLocal = () => new Date().toLocaleDateString('en-CA')
