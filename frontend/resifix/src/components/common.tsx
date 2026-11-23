import type { ReactNode } from 'react'
import { ChatButton } from './Chat'
import { Icon } from './Icon'
import { useApp } from '../context/appContext'
import { STATUS_CLASS } from '../data/constants'
import { awaitingAcceptance, formatDate, notAcceptedInTime, notResolvedReason } from '../utils'
import type { Issue } from '../types'

export function EmptyState({ icon, title, sub }: { icon: string; title: string; sub: string }) {
  return (
    <div className="empty-state">
      <div className="icon-badge">
        <Icon name={icon} />
      </div>
      <b>{title}</b>
      <p style={{ margin: '4px 0 0', fontSize: 12 }}>{sub}</p>
    </div>
  )
}

// Shows that an assigned job has not been accepted yet: "New job" for the technician, who it is
// waiting for to the student, and for the staff manager "Waiting to accept", turning into
// "Not accepted — call" after 2 minutes.
export function AcceptTag({ issue }: { issue: Issue }) {
  const { auth } = useApp()
  if (!awaitingAcceptance(issue)) return null
  if (auth.role === 'student') {
    return <span className="accept-tag waiting">Assigned to {issue.assignedToName ?? 'maintenance'} · waiting for them to accept</span>
  }
  if (auth.role === 'maintenance') return <span className="accept-tag new">New job — accept or decline</span>
  if (notAcceptedInTime(issue)) {
    return <span className="accept-tag late">Not accepted — call {issue.assignedToName ?? 'the technician'}</span>
  }
  return <span className="accept-tag waiting">Waiting for {issue.assignedToName ?? 'the technician'} to accept</span>
}

export function IssueRow({ issue, extra }: { issue: Issue; extra?: ReactNode }) {
  const { catInfo, setModal, auth } = useApp()
  const category = catInfo(issue.category)
  const notResolved = notResolvedReason(issue)

  return (
    <div className="issue-row" onClick={() => setModal({ type: 'detail', issueId: issue.id })}>
      <div className="issue-cat-badge">
        <Icon name={category.icon} />
      </div>
      <div className="issue-main">
        <div className="ref">{issue.ref}</div>
        <div className="title">
          {issue.title}
          {issue.reopened ? <span className="reopened-tag">Re-opened {issue.reopened}×</span> : null}
          <AcceptTag issue={issue} />
        </div>
        <div className="meta">
          {issue.residence} · Room {issue.room} · {formatDate(issue.dateReported)}
        </div>
        {notResolved && (
          <div className="not-resolved-note">
            <Icon name="x" /> Not resolved: {notResolved.reason}
          </div>
        )}
      </div>
      {/* One grid cell for the chat icon and the status, so the row keeps its four columns. Admins open
          chats from the report details instead, to keep their long lists tidy. */}
      <span className="issue-status">
        {auth.role !== 'admin' && auth.role !== 'supervisor' && <ChatButton issue={issue} />}
        <span className={'status-pill ' + STATUS_CLASS[issue.status]}>{issue.status}</span>
      </span>
      {extra ?? (
        <span className="icon-inline" style={{ color: 'var(--ink-soft)' }}>
          <Icon name="arrow-right" />
        </span>
      )}
    </div>
  )
}
