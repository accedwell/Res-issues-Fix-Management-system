import type { ReactNode } from 'react'
import { Icon } from './Icon'
import { useApp } from '../context/appContext'
import { PRIORITY_CLASS, STATUS_CLASS } from '../data/constants'
import { formatDate } from '../utils'
import type { Issue } from '../types'

export interface StatItem {
  icon: string
  value: number | string
  label: string
  bg: string
  fg: string
}

export function StatRow({ items }: { items: StatItem[] }) {
  return (
    <div className="stat-row">
      {items.map((item) => (
        <div className="stat-tile" key={item.label}>
          <div className="top">
            <div className="icon-badge" style={{ background: item.bg, color: item.fg }}>
              <Icon name={item.icon} />
            </div>
          </div>
          <b>{item.value}</b>
          <span>{item.label}</span>
        </div>
      ))}
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

  return (
    <div className="issue-row" onClick={() => setModal({ type: 'detail', issueId: issue.id })}>
      <div className="issue-cat-badge">
        <Icon name={category.icon} />
      </div>
      <div className="issue-main">
        <div className="ref">{issue.ref}</div>
        <div className="title">{issue.title}</div>
        <div className="meta">
          {issue.residence} · Room {issue.room} · {formatDate(issue.dateReported)}
        </div>
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
