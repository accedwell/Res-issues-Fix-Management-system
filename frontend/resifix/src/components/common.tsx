import type { CSSProperties, ReactNode } from 'react'
import { Icon } from './Icon'
import { useApp } from '../context/appContext'
import { PRIORITY_CLASS, STATUS_CLASS } from '../data/constants'
import { daysOpen, formatDate, isOverdue, notResolvedReason } from '../utils'
import type { Issue } from '../types'

export interface StatItem {
  icon: string
  value: number | string
  label: string
  bg: string
  fg: string
  // When set, the tile becomes a button that opens the matching list.
  onClick?: () => void
}

export function StatRow({ items }: { items: StatItem[] }) {
  return (
    <div className="stat-row">
      {items.map((item) => {
        const content = (
          <>
            <div className="top">
              <div className="icon-badge">
                <Icon name={item.icon} />
              </div>
              {item.onClick && (
                <span className="stat-go">
                  <Icon name="arrow-right" />
                </span>
              )}
            </div>
            <b>{item.value}</b>
            <span>{item.label}</span>
          </>
        )
        const style = { '--accent': item.fg } as CSSProperties
        return item.onClick ? (
          <button
            type="button"
            className="stat-tile stat-tile-link"
            key={item.label}
            style={style}
            onClick={item.onClick}
            aria-label={`${item.label}: ${item.value}. View list`}
          >
            {content}
          </button>
        ) : (
          <div className="stat-tile" key={item.label} style={style}>
            {content}
          </div>
        )
      })}
    </div>
  )
}

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
  const { catInfo, setModal } = useApp()
  const category = catInfo(issue.category)
  const overdue = isOverdue(issue)
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
          {overdue && <span className="overdue-tag">Overdue · {daysOpen(issue)} days</span>}
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
      <span className={'priority-pill ' + PRIORITY_CLASS[issue.priority]}>{issue.priority}</span>
      <span className={'status-pill ' + STATUS_CLASS[issue.status]}>{issue.status}</span>
      {extra ?? (
        <span className="icon-inline" style={{ color: 'var(--ink-soft)' }}>
          <Icon name="arrow-right" />
        </span>
      )}
    </div>
  )
}
