import { useState } from 'react'
import { EmptyState, IssueRow, StatRow } from '../components/common'
import { useApp } from '../context/appContext'
import { daysTaken } from '../exportCsv'
import { issuesInPeriod, monthPeriod } from '../periodReport'
import { formatDate, isOpen, isOverdue, stop } from '../utils'
import type { Issue } from '../types'

export function MaintenanceDashboard({ tab }: { tab: string }) {
  const { issues, setModal } = useApp()
  if (tab === 'reports') return <MyWorkReport issues={issues} />

  const completed = tab === 'completed'
  // The server only sends maintenance staff the jobs assigned to them.
  const tasks = issues.filter((i) => (completed ? !isOpen(i) : isOpen(i)))

  return (
    <div className="card">
      <p className="card-sub">{tasks.length} issue(s)</p>
      {tasks.length ? (
        tasks.map((issue) => (
          <IssueRow
            key={issue.id}
            issue={issue}
            extra={
              completed ? (
                <span className="status-pill status-closed">Done</span>
              ) : (
                <button className="btn btn-navy btn-sm" onClick={stop(() => setModal({ type: 'update', issueId: issue.id }))}>
                  Update
                </button>
              )
            }
          />
        ))
      ) : (
        <EmptyState
          icon="tools"
          title={completed ? 'Nothing completed yet' : 'No tasks assigned'}
          sub="New assignments from residence administrators will appear here."
        />
      )}
    </div>
  )
}

const average = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null)

// A staff member's own report: how many jobs, how fast, and what students said. Students stay
// anonymous — the server never sends their names to maintenance staff.
function MyWorkReport({ issues }: { issues: Issue[] }) {
  const { setModal } = useApp()
  // "all" or a month as YYYY-MM. Months listed are the ones with jobs, newest first.
  const [month, setMonth] = useState('all')
  const months = [...new Set(issues.map((i) => i.dateReported.slice(0, 7)))].sort().reverse()
  const jobs = month === 'all' ? issues : issuesInPeriod(issues, monthPeriod(month))

  const done = jobs.filter((i) => !isOpen(i))
  const avgDays = average(done.map(daysTaken))
  const rated = jobs.flatMap((i) => (i.feedback?.rating != null ? [i.feedback.rating] : []))
  const avgRating = average(rated)
  const feedback = jobs.filter((i) => i.feedback).sort((a, b) => b.dateReported.localeCompare(a.dateReported))

  return (
    <>
      <div className="card">
        <div className="card-head">
          <p className="card-sub">Your jobs and what students said about your work.</p>
          <div className="toolbar" style={{ margin: 0 }}>
            <select value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Period">
              <option value="all">All time</option>
              {months.map((m) => (
                <option key={m} value={m}>
                  {monthPeriod(m).label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <StatRow
          items={[
            { icon: 'tools', value: jobs.length, label: 'Jobs assigned', bg: 'var(--slate-bg)', fg: 'var(--blue-deep)' },
            { icon: 'check-circle', value: done.length, label: 'Finished', bg: 'var(--good-bg)', fg: 'var(--good)' },
            { icon: 'clock', value: jobs.filter(isOverdue).length, label: 'Overdue now', bg: 'var(--bad-bg)', fg: 'var(--bad)' },
            { icon: 'refresh', value: avgDays === null ? '—' : `${avgDays.toFixed(1)} d`, label: 'Average days to fix', bg: 'var(--slate-bg)', fg: 'var(--mint-soft)' },
            { icon: 'star', value: avgRating === null ? '—' : `${avgRating.toFixed(1)}★`, label: `Average rating (${rated.length})`, bg: 'var(--warn-bg)', fg: 'var(--warn)' },
          ]}
        />
      </div>

      <div className="card">
        <h2>Student feedback</h2>
        <p className="card-sub">Ratings and comments left when students confirmed your fixes. Names are not shown.</p>
        {feedback.length ? (
          <ul className="hotspot-list">
            {feedback.map((i) => {
              const rating = i.feedback?.rating ?? null
              return (
                <li key={i.id}>
                  <button
                    className={'hotspot-row' + (rating !== null && rating <= 2 ? ' low-rating' : '')}
                    onClick={() => setModal({ type: 'detail', issueId: i.id })}
                  >
                    <span className="hotspot-head">
                      <b>
                        {i.ref} · {i.title}
                      </b>
                      {rating !== null ? (
                        <span className={'rating-pill' + (rating <= 2 ? ' low' : '')}>{rating}★</span>
                      ) : (
                        <span className="hotspot-note">Not rated</span>
                      )}
                    </span>
                    <span className="reopen-reason">{i.feedback?.comment ? `“${i.feedback.comment}”` : 'No comment'}</span>
                    <span className="hotspot-note">Reported {formatDate(i.dateReported)}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        ) : (
          <EmptyState icon="star" title="No feedback yet" sub="Students can rate your work when they confirm a fix." />
        )}
      </div>
    </>
  )
}
