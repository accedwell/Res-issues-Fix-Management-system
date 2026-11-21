import type { ReactNode } from 'react'
import { ChatButton } from './Chat'
import { Icon } from './Icon'
import { useApp } from '../context/appContext'
import { STATUS_CLASS } from '../data/constants'
import { formatDate, notResolvedReason } from '../utils'
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
        {auth.role !== 'admin' && <ChatButton issue={issue} />}
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
