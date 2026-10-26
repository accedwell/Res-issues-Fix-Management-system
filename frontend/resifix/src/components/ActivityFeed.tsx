import { useEffect, useState } from 'react'
import { EmptyState } from './common'
import { Icon } from './Icon'
import { useApp } from '../context/appContext'
import { STATUS_CLASS } from '../data/constants'
import { formatDate } from '../utils'
import type { HistoryEntry, Issue } from '../types'

const SHOWN = 8
const MINUTE = 60_000

interface Event {
  issue: Issue
  entry: HistoryEntry
  time: number
  reopened: boolean
}

// Which icon fits each kind of step.
function iconFor(event: Event): string {
  if (event.reopened) return 'refresh'
  return (
    { Submitted: 'plus-circle', Received: 'check', Assigned: 'user', 'In Progress': 'tools', Resolved: 'check-circle', Closed: 'star' } as const
  )[event.entry.status]
}

// "Just now", "5 min ago", "3 h ago", "Yesterday", then the date.
function timeAgo(time: number, now: number): string {
  const minutes = Math.floor((now - time) / MINUTE)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} h ago`
  if (hours < 48) return 'Yesterday'
  return formatDate(new Date(time).toISOString().slice(0, 10))
}

// The latest steps across every issue, newest first. Updates live as people work.
export function ActivityFeed() {
  const { issues, setModal } = useApp()
  const [now, setNow] = useState(() => Date.now())

  // Keep "x min ago" current.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), MINUTE)
    return () => clearInterval(timer)
  }, [])

  const events: Event[] = issues
    .flatMap((issue) =>
      issue.history.map((entry, index) => ({
        issue,
        entry,
        // Older data may only have a day; keep same-day steps of one issue in order.
        time: entry.at ? Date.parse(entry.at) : Date.parse(entry.date) + index,
        reopened: entry.note.startsWith('Student reported the issue is NOT fixed'),
      })),
    )
    .sort((a, b) => b.time - a.time)
    .slice(0, SHOWN)

  return (
    <div className="card">
      <div className="card-head">
        <h2>Recent activity</h2>
      </div>
      <p className="card-sub">The latest updates on every report, as they happen.</p>
      {events.length ? (
        <ul className="activity-list">
          {events.map((e) => (
            <li key={e.issue.id + e.time}>
              <button className="activity-row" onClick={() => setModal({ type: 'detail', issueId: e.issue.id })}>
                <span className={'activity-icon ' + (e.reopened ? 'reopened' : STATUS_CLASS[e.entry.status])}>
                  <Icon name={iconFor(e)} />
                </span>
                <span className="activity-main">
                  <span className="activity-title">
                    <b>{e.issue.ref}</b> {e.issue.title}
                  </span>
                  <span className="activity-note">{e.reopened ? 'Re-opened: ' + e.entry.note.split(': ').slice(1).join(': ') : e.entry.note}</span>
                </span>
                <time className="activity-time" dateTime={new Date(e.time).toISOString()}>
                  {timeAgo(e.time, now)}
                </time>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon="clock" title="No activity yet" sub="New reports and updates will appear here." />
      )}
    </div>
  )
}
