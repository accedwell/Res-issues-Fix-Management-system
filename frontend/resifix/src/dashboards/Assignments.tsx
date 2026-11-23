import { useState } from 'react'
import { CallButton } from '../components/CallButton'
import { EmptyState } from '../components/common'
import { Icon } from '../components/Icon'
import { useApp } from '../context/appContext'
import { assignmentSource, awaitingAcceptance, isOpen, notAcceptedInTime, stop, timeAgo } from '../utils'
import type { Issue } from '../types'

// The system admin's view of who is doing which open job: whether the system or the staff manager
// assigned it, and whether the technician has accepted it. Jobs not accepted within 2 minutes are
// flagged so someone can phone the technician, then record "Accepted by phone".

const FILTERS = [
  { key: 'all', label: 'All assigned jobs' },
  { key: 'system', label: 'Assigned by the system' },
  { key: 'manager', label: 'Assigned by the staff manager' },
  { key: 'waiting', label: 'Waiting to be accepted' },
  { key: 'late', label: 'Not accepted — call' },
] as const
type FilterKey = (typeof FILTERS)[number]['key']

function matches(issue: Issue, filter: FilterKey): boolean {
  if (filter === 'system') return assignmentSource(issue).bySystem
  if (filter === 'manager') return !assignmentSource(issue).bySystem
  if (filter === 'waiting') return awaitingAcceptance(issue)
  if (filter === 'late') return notAcceptedInTime(issue)
  return true
}

function AcceptanceCell({ issue }: { issue: Issue }) {
  const { confirmAcceptedByPhone } = useApp()
  const [busy, setBusy] = useState(false)
  if (!awaitingAcceptance(issue)) {
    return <span className="status-pill status-closed">Accepted{issue.acceptedAt ? ` ${timeAgo(issue.acceptedAt)}` : ''}</span>
  }
  const late = notAcceptedInTime(issue)
  return (
    <span className="assign-accept">
      <span className={'accept-tag ' + (late ? 'late' : 'waiting')} style={{ marginLeft: 0 }}>
        {late ? 'Not accepted — call them' : 'Waiting to accept'}
      </span>
      {late && <CallButton phone={issue.assignedToPhone} name={issue.assignedToName} />}
      {late && (
        <button
          className="btn btn-navy btn-sm"
          disabled={busy}
          onClick={stop(async () => {
            setBusy(true)
            if (!(await confirmAcceptedByPhone(issue))) setBusy(false)
          })}
        >
          <Icon name="check" /> {busy ? 'Saving…' : 'Accepted by phone'}
        </button>
      )}
    </span>
  )
}

export function Assignments() {
  const { issues, setModal } = useApp()
  const [filter, setFilter] = useState<FilterKey>('all')

  // Open jobs with someone assigned, jobs that need a phone call first, then the newest assignments.
  const assigned = issues
    .filter((i) => isOpen(i) && i.assignedTo)
    .sort(
      (a, b) =>
        Number(notAcceptedInTime(b)) - Number(notAcceptedInTime(a)) ||
        Date.parse(b.assignedAt ?? '') - Date.parse(a.assignedAt ?? ''),
    )
  const shown = assigned.filter((i) => matches(i, filter))

  const tiles: { key: FilterKey; label: string; icon: string; accent: string; count: number }[] = [
    { key: 'all', label: 'Open jobs assigned', icon: 'tools', accent: 'var(--mint-soft)', count: assigned.length },
    { key: 'system', label: 'Assigned by the system', icon: 'refresh', accent: 'var(--mint-soft)', count: assigned.filter((i) => matches(i, 'system')).length },
    { key: 'waiting', label: 'Waiting to be accepted', icon: 'clock', accent: 'var(--warn)', count: assigned.filter((i) => matches(i, 'waiting')).length },
    { key: 'late', label: 'Not accepted — call', icon: 'phone', accent: 'var(--bad)', count: assigned.filter((i) => matches(i, 'late')).length },
  ]

  return (
    <div>
      <div className="stat-row">
        {tiles.map((t) => (
          <button
            key={t.key}
            className={'stat-tile assign-tile' + (filter === t.key ? ' active' : '')}
            style={{ ['--accent' as string]: t.accent }}
            onClick={() => setFilter(t.key)}
          >
            <span className="top">
              <span className="icon-badge">
                <Icon name={t.icon} />
              </span>
            </span>
            <b>{t.count}</b>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      <div className="card">
        <div className="card-head">
          <p className="card-sub">
            Who is doing each open job, who assigned it, and whether they have accepted it. Click a job for its full history.
          </p>
          <select value={filter} onChange={(e) => setFilter(e.target.value as FilterKey)} aria-label="Show">
            {FILTERS.map((f) => (
              <option key={f.key} value={f.key}>
                {f.label}
              </option>
            ))}
          </select>
        </div>

        {shown.length ? (
          <table className="simple users-table assign-table">
            <tbody>
              <tr className="users-head">
                <th>Job</th>
                <th>Technician</th>
                <th>Assigned by</th>
                <th>Assigned</th>
                <th>Accepted?</th>
              </tr>
              {shown.map((issue) => {
                const source = assignmentSource(issue)
                return (
                  <tr key={issue.id} className="assign-row" onClick={() => setModal({ type: 'detail', issueId: issue.id })}>
                    <td data-label="Job">
                      <span className="assign-job">
                        <span className="ref">{issue.ref}</span>
                        <b>{issue.title}</b>
                        <span className="hotspot-note">
                          {issue.residence} · {issue.room}
                          {issue.priority === 'Urgent' ? ' · Urgent' : ''}
                        </span>
                      </span>
                    </td>
                    <td data-label="Technician">
                      <span className="assign-job">
                        {issue.assignedToName ?? '—'}
                        {issue.assignedToPhone && <span className="hotspot-note">{issue.assignedToPhone}</span>}
                      </span>
                    </td>
                    <td data-label="Assigned by">
                      <span className="assign-job">
                        <span className={'assign-source' + (source.bySystem ? ' system' : '')}>{source.bySystem ? 'System' : 'Staff manager'}</span>
                        <span className="hotspot-note">{source.detail}</span>
                      </span>
                    </td>
                    <td data-label="Assigned">{issue.assignedAt ? timeAgo(issue.assignedAt) : '—'}</td>
                    <td data-label="Accepted?">
                      <AcceptanceCell issue={issue} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : (
          <EmptyState icon="check-circle" title="Nothing here" sub="No open jobs match this view right now." />
        )}
      </div>
    </div>
  )
}
