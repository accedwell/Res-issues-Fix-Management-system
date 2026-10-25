import { useState, type ChangeEvent } from 'react'
import { Icon } from './Icon'
import { useApp } from '../context/appContext'
import { CATEGORY_ICONS, PRIORITIES, PRIORITY_CLASS, STAFF, STATUS_CLASS, USER_ROLES } from '../data/constants'
import { formatDate } from '../utils'
import type { Category, Issue, Priority, Status } from '../types'

export function ModalHost() {
  const { modal, setModal, issues } = useApp()
  if (!modal) return null

  const close = () => setModal(null)
  const issue = 'issueId' in modal ? issues.find((i) => i.id === modal.issueId) : undefined

  let content = null
  switch (modal.type) {
    case 'addUser':
      content = <AddUserModal close={close} />
      break
    case 'removeUser':
      content = <RemoveUserModal userId={modal.userId} close={close} />
      break
    case 'addCategory':
      content = <AddCategoryModal close={close} />
      break
    case 'editCategory':
      content = <EditCategoryModal categoryKey={modal.categoryKey} close={close} />
      break
    default:
      if (!issue) return null
      content = {
        detail: <DetailModal issue={issue} close={close} />,
        assign: <AssignModal issue={issue} close={close} />,
        update: <UpdateModal issue={issue} close={close} />,
        feedback: <FeedbackModal issue={issue} />,
        notfixed: <NotFixedModal issue={issue} close={close} />,
      }[modal.type]
  }

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) close()
      }}
    >
      {content}
    </div>
  )
}

interface IssueModalProps {
  issue: Issue
  close: () => void
}

function DetailModal({ issue, close }: IssueModalProps) {
  const { catInfo } = useApp()
  const category = catInfo(issue.category)
  const staff = STAFF.find((s) => s.id === issue.assignedTo)

  return (
    <div className="modal">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--ink-soft)', fontWeight: 700 }}>{issue.ref}</div>
          <h3>{issue.title}</h3>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={close} aria-label="Close">
          <Icon name="x" />
        </button>
      </div>
      <div style={{ display: 'flex', gap: 8, margin: '8px 0 14px', flexWrap: 'wrap' }}>
        <span className={'status-pill ' + STATUS_CLASS[issue.status]}>{issue.status}</span>
        <span className={'priority-pill ' + PRIORITY_CLASS[issue.priority]}>{issue.priority} priority</span>
        <span className="status-pill status-submitted">
          <Icon name={category.icon} /> {category.name}
        </span>
      </div>
      {issue.reopened ? (
        <div className="field-error" style={{ margin: '0 0 10px', fontWeight: 700 }}>
          Re-opened {issue.reopened}× — student reported it was not fixed.
        </div>
      ) : null}
      <p style={{ fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.55 }}>{issue.description}</p>
      <table className="simple" style={{ marginBottom: 14 }}>
        <tbody>
          <tr>
            <td>Block</td>
            <td>{issue.residence}</td>
          </tr>
          <tr>
            <td>Room / Location</td>
            <td>{issue.room}</td>
          </tr>
          <tr>
            <td>Reported by</td>
            <td>{issue.studentName}</td>
          </tr>
          <tr>
            <td>Date reported</td>
            <td>{formatDate(issue.dateReported)}</td>
          </tr>
          <tr>
            <td>Assigned to</td>
            <td>{staff ? staff.name : '—'}</td>
          </tr>
          <tr>
            <td>Photo</td>
            <td>{issue.photo ? 'Attached' : 'None'}</td>
          </tr>
        </tbody>
      </table>
      <h3 style={{ fontSize: 13, marginBottom: 6 }}>History</h3>
      <ul className="timeline">
        {issue.history.map((entry, index) => (
          <li key={index}>
            <div className="dot" />
            <div className="tl-body">
              <b>
                {entry.status} · {formatDate(entry.date)}
              </b>
              <span>{entry.note}</span>
            </div>
          </li>
        ))}
      </ul>
      {issue.feedback && (
        <div className="card" style={{ margin: '14px 0 0', background: 'var(--good-bg)', borderColor: 'transparent' }}>
          <b style={{ fontSize: 12.5 }}>Student feedback — {issue.feedback.rating}/5</b>
          <p style={{ margin: '4px 0 0', fontSize: 12 }}>{issue.feedback.comment}</p>
        </div>
      )}
      <div className="modal-actions">
        <button className="btn btn-ghost" onClick={close}>
          Close
        </button>
      </div>
    </div>
  )
}

function AssignModal({ issue, close }: IssueModalProps) {
  const { assignIssue } = useApp()
  const [staffId, setStaffId] = useState(issue.assignedTo || STAFF[0].id)
  const [priority, setPriority] = useState<Priority>(issue.priority)

  return (
    <div className="modal">
      <h3>Assign maintenance staff</h3>
      <p className="modal-sub">
        {issue.ref} — {issue.title}
      </p>
      <div className="field">
        <label>Maintenance staff</label>
        <select value={staffId} onChange={(e) => setStaffId(e.target.value)}>
          {STAFF.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} — {s.specialization}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label>Priority</label>
        <select value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
          {PRIORITIES.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
      </div>
      <div className="modal-actions">
        <button className="btn btn-ghost" onClick={close}>
          Cancel
        </button>
        <button className="btn btn-primary" onClick={() => assignIssue(issue, staffId, priority)}>
          Assign
        </button>
      </div>
    </div>
  )
}

function UpdateModal({ issue, close }: IssueModalProps) {
  const { updateProgress } = useApp()
  const [status, setStatus] = useState<Status>('In Progress')
  const [comment, setComment] = useState('')

  return (
    <div className="modal">
      <h3>Update progress</h3>
      <p className="modal-sub">
        {issue.ref} — {issue.title}
      </p>
      <div className="field">
        <label>New status</label>
        <select value={status} onChange={(e) => setStatus(e.target.value as Status)}>
          <option>In Progress</option>
          <option>Resolved</option>
        </select>
      </div>
      <div className="field">
        <label>Comment</label>
        <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="What did you do / find?" />
      </div>
      <div className="modal-actions">
        <button className="btn btn-ghost" onClick={close}>
          Cancel
        </button>
        <button className="btn btn-primary" onClick={() => updateProgress(issue, status, comment)}>
          Save update
        </button>
      </div>
    </div>
  )
}

function FeedbackModal({ issue }: { issue: Issue }) {
  const { confirmResolution, setModal } = useApp()
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')

  return (
    <div className="modal">
      <h3>Confirm resolution</h3>
      <p className="modal-sub">
        {issue.ref} — {issue.title}
      </p>
      <p style={{ fontSize: 12.5, color: 'var(--ink-soft)' }}>Has this issue been fixed to your satisfaction?</p>
      <div className="field">
        <label>Rate the service</label>
        <div className="stars">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              className={n <= rating ? 'active' : ''}
              onClick={() => setRating(n)}
              aria-label={n + ' star'}
            >
              <Icon name="star" />
            </button>
          ))}
        </div>
      </div>
      <div className="field">
        <label>Comment (optional)</label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Any comments about how this was handled?"
        />
      </div>
      <div className="modal-actions">
        <button className="btn btn-ghost" onClick={() => setModal({ type: 'notfixed', issueId: issue.id })}>
          Not fixed
        </button>
        <button className="btn btn-primary" onClick={() => confirmResolution(issue, rating, comment)}>
          <Icon name="check" /> Confirm &amp; submit
        </button>
      </div>
    </div>
  )
}

function NotFixedModal({ issue, close }: IssueModalProps) {
  const { reportNotFixed } = useApp()
  const [reason, setReason] = useState('')
  const [showError, setShowError] = useState(false)

  return (
    <div className="modal">
      <h3>Report: issue not fixed</h3>
      <p className="modal-sub">
        {issue.ref} — {issue.title}
      </p>
      <p style={{ fontSize: 12.5, color: 'var(--ink-soft)', lineHeight: 1.5 }}>
        Tell us what is still wrong. The report will be re-opened and sent back to maintenance.
      </p>
      <div className="field">
        <label>What is still not fixed? *</label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. The tap is still leaking under the basin."
        />
      </div>
      {showError && <div className="field-error">Please describe what is still wrong.</div>}
      <div className="modal-actions">
        <button className="btn btn-ghost" onClick={close}>
          Cancel
        </button>
        <button
          className="btn btn-primary"
          onClick={() => {
            if (!reason.trim()) {
              setShowError(true)
              return
            }
            reportNotFixed(issue, reason.trim())
          }}
        >
          Re-open issue
        </button>
      </div>
    </div>
  )
}

function AddUserModal({ close }: { close: () => void }) {
  const { addUser } = useApp()
  const [form, setForm] = useState({ name: '', role: USER_ROLES[0], email: '', extra: '' })
  const [showError, setShowError] = useState(false)

  const field = (key: keyof typeof form) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm({ ...form, [key]: e.target.value })

  return (
    <div className="modal">
      <h3>Add user</h3>
      <p className="modal-sub">Create a new account for the platform.</p>
      <div className="field">
        <label>Full name</label>
        <input type="text" value={form.name} onChange={field('name')} placeholder="e.g. Zanele Khumalo" />
      </div>
      <div className="field">
        <label>Role</label>
        <select value={form.role} onChange={field('role')}>
          {USER_ROLES.map((role) => (
            <option key={role}>{role}</option>
          ))}
        </select>
      </div>
      <div className="field">
        <label>Email address</label>
        <input type="email" value={form.email} onChange={field('email')} placeholder="you@campus.ac.za" />
      </div>
      <div className="field">
        <label>Details</label>
        <input
          type="text"
          value={form.extra}
          onChange={field('extra')}
          placeholder="e.g. Block A · Room 101, or specialization"
        />
      </div>
      {showError && <div className="field-error">Please fill in name and email.</div>}
      <div className="modal-actions">
        <button className="btn btn-ghost" onClick={close}>
          Cancel
        </button>
        <button
          className="btn btn-primary"
          onClick={() => {
            if (!form.name.trim() || !form.email.trim()) {
              setShowError(true)
              return
            }
            addUser({ name: form.name.trim(), role: form.role, email: form.email.trim(), extra: form.extra.trim() || '—' })
          }}
        >
          <Icon name="check" /> Add user
        </button>
      </div>
    </div>
  )
}

function RemoveUserModal({ userId, close }: { userId: string; close: () => void }) {
  const { users, removeUser } = useApp()
  const user = users.find((u) => u.id === userId)

  return (
    <div className="modal">
      <h3>Remove user</h3>
      <p className="modal-sub">
        {user ? `Remove ${user.name} (${user.role})? This cannot be undone in this prototype.` : ''}
      </p>
      <div className="modal-actions">
        <button className="btn btn-ghost" onClick={close}>
          Cancel
        </button>
        <button className="btn btn-primary" style={{ background: 'var(--bad)' }} onClick={() => removeUser(userId)}>
          <Icon name="x" /> Remove user
        </button>
      </div>
    </div>
  )
}

interface CategoryFormProps {
  title: string
  sub: string
  initial: Pick<Category, 'name' | 'icon'>
  cta: string
  onSave: (name: string, icon: string) => void
  close: () => void
}

function CategoryForm({ title, sub, initial, cta, onSave, close }: CategoryFormProps) {
  const [name, setName] = useState(initial.name)
  const [icon, setIcon] = useState(initial.icon)
  const [showError, setShowError] = useState(false)

  return (
    <div className="modal">
      <h3>{title}</h3>
      <p className="modal-sub">{sub}</p>
      <div className="field">
        <label>Category name</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Pest Control" />
      </div>
      <div className="field">
        <label>Icon</label>
        <select value={icon} onChange={(e) => setIcon(e.target.value)}>
          {CATEGORY_ICONS.map((i) => (
            <option key={i}>{i}</option>
          ))}
        </select>
      </div>
      {showError && <div className="field-error">Please enter a category name.</div>}
      <div className="modal-actions">
        <button className="btn btn-ghost" onClick={close}>
          Cancel
        </button>
        <button
          className="btn btn-primary"
          onClick={() => {
            if (!name.trim()) {
              setShowError(true)
              return
            }
            onSave(name.trim(), icon)
          }}
        >
          <Icon name="check" /> {cta}
        </button>
      </div>
    </div>
  )
}

function AddCategoryModal({ close }: { close: () => void }) {
  const { addCategory } = useApp()
  return (
    <CategoryForm
      title="Add category"
      sub="Create a new issue category students can select when reporting."
      initial={{ name: '', icon: CATEGORY_ICONS[0] }}
      cta="Add category"
      onSave={addCategory}
      close={close}
    />
  )
}

function EditCategoryModal({ categoryKey, close }: { categoryKey: string; close: () => void }) {
  const { catInfo, editCategory } = useApp()
  return (
    <CategoryForm
      title="Edit category"
      sub="Update this category’s name and icon."
      initial={catInfo(categoryKey)}
      cta="Save changes"
      onSave={(name, icon) => editCategory(categoryKey, name, icon)}
      close={close}
    />
  )
}
