import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import { EmptyState, IssueRow, StatRow } from '../components/common'
import { Icon } from '../components/Icon'
import { useApp } from '../context/appContext'
import { BLOCKS, PRIORITIES } from '../data/constants'
import { formatDate, isOpen, stop } from '../utils'
import type { Priority } from '../types'

export function StudentDashboard({ tab }: { tab: string }) {
  if (tab === 'report') return <ReportIssue />
  if (tab === 'reports') return <MyReports />
  if (tab === 'notifications') return <Notifications />
  return <Overview />
}

function useMyIssues() {
  const { issues, auth } = useApp()
  return issues.filter((issue) => issue.studentId === auth.studentId)
}

function Overview() {
  const { notifications, auth, setTab } = useApp()
  const mine = useMyIssues()
  const open = mine.filter(isOpen).length
  const unread = notifications.filter((n) => n.studentId === auth.studentId && !n.read).length

  return (
    <div>
      <StatRow
        items={[
          { icon: 'list', value: mine.length, label: 'Total reports', bg: 'var(--slate-bg)', fg: 'var(--blue-deep)' },
          { icon: 'refresh', value: open, label: 'Currently open', bg: 'var(--warn-bg)', fg: 'var(--warn)' },
          { icon: 'check-circle', value: mine.length - open, label: 'Resolved / closed', bg: 'var(--good-bg)', fg: 'var(--good)' },
          { icon: 'bell', value: unread, label: 'Unread notifications', bg: '#e6f7f6', fg: 'var(--teal-deep)' },
        ]}
      />
      <div className="card">
        <div className="card-head">
          <h2>Recent reports</h2>
          <button className="btn btn-ghost btn-sm" onClick={() => setTab('reports')}>
            View all
          </button>
        </div>
        {mine.length ? (
          mine.slice(0, 4).map((issue) => <IssueRow key={issue.id} issue={issue} />)
        ) : (
          <EmptyState icon="list" title="No reports yet" sub="Report your first residence issue to see it here." />
        )}
      </div>
      <div className="card">
        <div className="card-head">
          <h2>Report a new issue</h2>
          <button className="btn btn-primary btn-sm" onClick={() => setTab('report')}>
            <Icon name="plus-circle" /> Report Issue
          </button>
        </div>
        <p className="card-sub" style={{ margin: 0 }}>
          Broken lights, leaking taps, damaged furniture, Wi-Fi issues, security concerns and more — get it logged in
          under a minute.
        </p>
      </div>
    </div>
  )
}

function ReportIssue() {
  const { categories, addIssue, setTab } = useApp()
  const [form, setForm] = useState({
    title: '',
    category: categories[0].key,
    priority: 'Normal' as Priority,
    residence: BLOCKS[0],
    room: '',
    description: '',
  })
  const [photoName, setPhotoName] = useState('')

  const field =
    (key: keyof typeof form) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm({ ...form, [key]: e.target.value })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    addIssue({ ...form, photo: !!photoName })
  }

  return (
    <div className="card">
      <h2>Report a residence issue</h2>
      <p className="card-sub">Fields marked with an asterisk are required. A reference number is generated automatically.</p>
      <form onSubmit={submit}>
        <div className="field">
          <label>Title *</label>
          <input type="text" value={form.title} onChange={field('title')} placeholder="e.g. Broken bathroom tap" required />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div className="field">
            <label>Category *</label>
            <select value={form.category} onChange={field('category')} required>
              {categories.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Priority</label>
            <select value={form.priority} onChange={field('priority')}>
              {PRIORITIES.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div className="field">
            <label>Block *</label>
            <select value={form.residence} onChange={field('residence')} required>
              {BLOCKS.map((block) => (
                <option key={block}>{block}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Room / Location *</label>
            <input type="text" value={form.room} onChange={field('room')} placeholder="e.g. 204 or Common Room" required />
          </div>
        </div>
        <div className="field">
          <label>Description *</label>
          <textarea
            value={form.description}
            onChange={field('description')}
            placeholder="Describe the problem in detail..."
            required
          />
        </div>
        <div className="field">
          <label>Photo (optional)</label>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              border: '1px dashed var(--border)',
              borderRadius: 9,
              padding: 12,
              color: 'var(--ink-soft)',
              fontSize: 12.5,
            }}
          >
            <Icon name="image" /> Attach a photo of the problem (demo only — no file is uploaded)
            <label className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }}>
              {photoName || 'Choose file'}
              <input
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => setPhotoName(e.target.files?.[0]?.name || '')}
              />
            </label>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          <button className="btn btn-primary" type="submit">
            <Icon name="check" /> Submit report
          </button>
          <button className="btn btn-ghost" type="button" onClick={() => setTab('overview')}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}

function MyReports() {
  const { setModal } = useApp()
  const mine = useMyIssues()

  return (
    <div className="card">
      <h2>My Reports</h2>
      <p className="card-sub">{mine.length} report(s) submitted so far.</p>
      {mine.length ? (
        mine.map((issue) => (
          <IssueRow
            key={issue.id}
            issue={issue}
            extra={
              issue.status === 'Resolved' ? (
                <span style={{ display: 'inline-flex', gap: 6 }}>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={stop(() => setModal({ type: 'notfixed', issueId: issue.id }))}
                  >
                    Not fixed
                  </button>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={stop(() => setModal({ type: 'feedback', issueId: issue.id }))}
                  >
                    Confirm
                  </button>
                </span>
              ) : undefined
            }
          />
        ))
      ) : (
        <EmptyState icon="list" title="No reports yet" sub='Use "Report an Issue" to submit your first report.' />
      )}
    </div>
  )
}

function Notifications() {
  const { notifications, auth, markNotificationsRead } = useApp()
  const studentId = auth.studentId ?? ''
  const mine = notifications.filter((n) => n.studentId === studentId)
  // Keep highlighting what was unread when the page opened.
  const [unreadOnOpen] = useState(() => new Set(mine.filter((n) => !n.read).map((n) => n.id)))

  // Mark everything as read when the student leaves this page.
  useEffect(() => () => markNotificationsRead(studentId), [markNotificationsRead, studentId])

  return (
    <div className="card">
      <h2>Notifications</h2>
      <p className="card-sub">Updates on your reports — received, assigned, in progress and resolved.</p>
      {mine.length ? (
        mine.map((n) => (
          <div key={n.id} className={'notif-item' + (n.read && !unreadOnOpen.has(n.id) ? '' : ' unread')}>
            <div className="icon-badge">
              <Icon name="bell" />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: 12.5 }}>{n.message}</p>
              <time>{formatDate(n.date)}</time>
            </div>
          </div>
        ))
      ) : (
        <EmptyState icon="bell" title="No notifications yet" sub="You’ll see updates here as your reports progress." />
      )}
    </div>
  )
}
