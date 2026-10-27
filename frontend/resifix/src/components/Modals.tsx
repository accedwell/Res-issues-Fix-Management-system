import { useState, type ChangeEvent } from 'react'
import { Icon } from './Icon'
import { IssuePhoto } from './IssuePhoto'
import { ProgressSteps } from './ProgressSteps'
import { useApp } from '../context/appContext'
import { PasswordInput } from './PasswordInput'
import {
  BLOCKS, CATEGORY_ICONS, GENERAL_SPECIALIZATION, PRIORITIES, PRIORITY_CLASS, ROLE_NAMES, SPECIALIZATIONS, STATUS_CLASS,
} from '../data/constants'
import { canEditReport, canReportNotFixed, formatDate, isOpen, notResolvedReason, recommendStaff } from '../utils'
import type { Category, Issue, Priority, Role, Status } from '../types'

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
    case 'removeCategory':
      content = <RemoveCategoryModal categoryKey={modal.categoryKey} close={close} />
      break
    default:
      if (!issue) return null
      content = {
        detail: <DetailModal issue={issue} close={close} />,
        assign: <AssignModal issue={issue} close={close} />,
        update: <UpdateModal issue={issue} close={close} />,
        feedback: <FeedbackModal issue={issue} />,
        notfixed: <NotFixedModal issue={issue} close={close} />,
        editReport: <EditReportModal issue={issue} close={close} />,
        cancelReport: <CancelReportModal issue={issue} close={close} />,
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
  const { catInfo, auth, setModal, staff: staffList, receiveIssue } = useApp()
  const [busy, setBusy] = useState(false)
  const isAdmin = auth.role === 'admin'
  const category = catInfo(issue.category)
  const assignedName = issue.assignedToName ?? staffList.find((s) => s.id === issue.assignedTo)?.name
  const notResolved = notResolvedReason(issue)
  const studentCanEdit = canEditReport(issue, auth)
  const studentCanReopen = auth.role === 'student' && issue.studentId === auth.studentId && canReportNotFixed(issue)

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
      <div style={{ margin: '4px 0 16px' }}>
        <ProgressSteps issue={issue} />
      </div>
      {notResolved && (
        <div className="not-resolved-box">
          <b>
            <Icon name="x" /> {assignedName ?? 'Maintenance'} could not fix this yet
          </b>
          <p>“{notResolved.reason}”</p>
          <span>
            {formatDate(notResolved.date)}
            {studentCanReopen ? ' · If it is still a problem, use “Still not fixed” below to push it again.' : ''}
          </span>
        </div>
      )}
      {issue.reopened ? (
        <div className="field-error" style={{ margin: '0 0 10px', fontWeight: 700 }}>
          Re-opened {issue.reopened}× — student reported it was not fixed.
        </div>
      ) : null}
      <p style={{ fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.55 }}>{issue.description}</p>
      <IssuePhoto issue={issue} />
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
            <td>{assignedName || '—'}</td>
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
          <b style={{ fontSize: 12.5 }}>Student feedback — {issue.feedback.rating !== null ? `${issue.feedback.rating}/5` : 'not rated'}</b>
          <p style={{ margin: '4px 0 0', fontSize: 12 }}>{issue.feedback.comment}</p>
        </div>
      )}
      <div className="modal-actions">
        {isAdmin && issue.status === 'Submitted' && (
          <button
            className="btn btn-ghost"
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              if (!(await receiveIssue(issue))) setBusy(false)
            }}
          >
            <Icon name="check" /> {busy ? 'Saving…' : 'Mark as received'}
          </button>
        )}
        {isAdmin && isOpen(issue) && (
          <button className="btn btn-primary" onClick={() => setModal({ type: 'assign', issueId: issue.id })}>
            {issue.assignedTo ? 'Reassign' : 'Assign'}
          </button>
        )}
        {studentCanEdit && (
          <>
            <button className="btn btn-ghost" onClick={() => setModal({ type: 'cancelReport', issueId: issue.id })}>
              <Icon name="x" /> Cancel report
            </button>
            <button className="btn btn-primary" onClick={() => setModal({ type: 'editReport', issueId: issue.id })}>
              Edit report
            </button>
          </>
        )}
        {studentCanReopen && (
          <button className="btn btn-ghost" onClick={() => setModal({ type: 'notfixed', issueId: issue.id })}>
            <Icon name="refresh" /> Still not fixed
          </button>
        )}
        <button className="btn btn-ghost" onClick={close}>
          Close
        </button>
      </div>
    </div>
  )
}

function AssignModal({ issue, close }: IssueModalProps) {
  const { assignIssue, staff, catInfo } = useApp()
  const recommended = recommendStaff(issue, staff)
  const [staffId, setStaffId] = useState(issue.assignedTo || recommended?.id || '')
  const [priority, setPriority] = useState<Priority>(issue.priority)
  const [busy, setBusy] = useState(false)

  if (!recommended) {
    return (
      <div className="modal">
        <h3>Assign maintenance staff</h3>
        <p className="modal-sub">There are no maintenance staff accounts yet. Ask the system administrator to add one.</p>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={close}>
            Close
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="modal">
      <h3>Assign maintenance staff</h3>
      <p className="modal-sub">
        {issue.ref} — {issue.title}
      </p>
      <div className="auto-match">
        <Icon name="check-circle" />
        <div>
          <b>
            Auto-matched: {recommended.name} ({recommended.specialization})
          </b>
          <span>
            Best fit for {catInfo(issue.category).name} issues · {recommended.openJobs} open job(s)
          </span>
        </div>
        {staffId !== recommended.id && (
          <button className="btn btn-ghost btn-sm" onClick={() => setStaffId(recommended.id)}>
            Use
          </button>
        )}
      </div>
      <div className="field">
        <label>Maintenance staff</label>
        <select value={staffId} onChange={(e) => setStaffId(e.target.value)}>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.id === recommended.id ? '★ ' : ''}
              {s.name} — {s.specialization} ({s.openJobs} open)
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
        <button
          className="btn btn-primary"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            if (!(await assignIssue(issue, staffId, priority))) setBusy(false)
          }}
        >
          {busy ? 'Assigning…' : 'Assign'}
        </button>
      </div>
    </div>
  )
}

function UpdateModal({ issue, close }: IssueModalProps) {
  const { updateProgress } = useApp()
  const [status, setStatus] = useState<Status>('In Progress')
  const [comment, setComment] = useState('')
  const [error, setError] = useState('')
  // The admin and student need to know why a job could not be fixed.
  const needsComment = status === 'Not Resolved'

  const save = () => {
    if (needsComment && !comment.trim()) return setError('Please explain why it could not be resolved.')
    updateProgress(issue, status, comment)
  }

  return (
    <div className="modal">
      <h3>Update progress</h3>
      <p className="modal-sub">
        {issue.ref} — {issue.title}
      </p>
      <div className="field">
        <label>New status</label>
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as Status)
            setError('')
          }}
        >
          <option>In Progress</option>
          <option>Not Resolved</option>
          <option>Resolved</option>
        </select>
      </div>
      <div className="field">
        <label>Comment{needsComment && ' (required)'}</label>
        <textarea
          value={comment}
          onChange={(e) => {
            setComment(e.target.value)
            setError('')
          }}
          placeholder={needsComment ? 'Why could it not be fixed? e.g. waiting for a part, needs a contractor' : 'What did you do / find?'}
        />
        {error && <div className="field-error">{error}</div>}
      </div>
      <div className="modal-actions">
        <button className="btn btn-ghost" onClick={close}>
          Cancel
        </button>
        <button className="btn btn-primary" onClick={save}>
          Save update
        </button>
      </div>
    </div>
  )
}

function FeedbackModal({ issue }: { issue: Issue }) {
  const { confirmResolution, setModal } = useApp()
  // No stars picked means the student chose not to rate.
  const [rating, setRating] = useState<number | null>(null)
  const [comment, setComment] = useState('')
  const fixer = issue.assignedToName

  return (
    <div className="modal">
      <h3>Confirm resolution</h3>
      <p className="modal-sub">
        {issue.ref} — {issue.title}
      </p>
      <p style={{ fontSize: 12.5, color: 'var(--ink-soft)' }}>Has this issue been fixed to your satisfaction?</p>
      <div className="field">
        <label>{fixer ? `Rate ${fixer}, who fixed it (optional)` : 'Rate the fix (optional)'}</label>
        <div className="stars">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              className={rating !== null && n <= rating ? 'active' : ''}
              // Tapping the chosen star again clears the rating.
              onClick={() => setRating(rating === n ? null : n)}
              aria-label={n + ' star'}
              aria-pressed={rating === n}
            >
              <Icon name="star" />
            </button>
          ))}
        </div>
        <p className="field-hint">{rating === null ? 'You can skip this.' : `${rating} out of 5 · tap the star again to clear`}</p>
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

// The student fixes a mistake in their report before the admin has received it.
function EditReportModal({ issue, close }: IssueModalProps) {
  const { editReport, categories } = useApp()
  const [form, setForm] = useState({
    title: issue.title,
    category: issue.category,
    priority: issue.priority,
    residence: issue.residence,
    room: issue.room,
    description: issue.description,
  })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const field = (key: keyof typeof form) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }))

  const save = async () => {
    if (!form.title.trim() || !form.room.trim() || !form.description.trim()) return setError('Please fill in the title, room and description.')
    setBusy(true)
    if (!(await editReport(issue, form))) setBusy(false)
  }

  return (
    <div className="modal">
      <h3>Edit report</h3>
      <p className="modal-sub">
        {issue.ref} — you can change it until the residence admin receives it.
      </p>
      <div className="field">
        <label>Short title</label>
        <input type="text" value={form.title} onChange={field('title')} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div className="field">
          <label>Category</label>
          <select value={form.category} onChange={field('category')}>
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
        <div className="field">
          <label>Block</label>
          <select value={form.residence} onChange={field('residence')}>
            {BLOCKS.map((b) => (
              <option key={b}>{b}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Room / location</label>
          <input type="text" value={form.room} onChange={field('room')} />
        </div>
      </div>
      <div className="field">
        <label>What's happening?</label>
        <textarea value={form.description} onChange={field('description')} />
      </div>
      {error && <div className="field-error">{error}</div>}
      <div className="modal-actions">
        <button className="btn btn-ghost" onClick={close}>
          Cancel
        </button>
        <button className="btn btn-primary" disabled={busy} onClick={save}>
          <Icon name="check" /> {busy ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </div>
  )
}

// Asks before removing the report for good.
function CancelReportModal({ issue, close }: IssueModalProps) {
  const { cancelReport } = useApp()
  const [busy, setBusy] = useState(false)

  return (
    <div className="modal">
      <h3>Cancel this report?</h3>
      <p className="modal-sub">
        {issue.ref} — {issue.title}
      </p>
      <p style={{ fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.55 }}>
        The report will be removed and the residence admin will be told it was cancelled. This can't be undone — if the
        problem comes back, report it again.
      </p>
      <div className="modal-actions">
        <button className="btn btn-ghost" onClick={close}>
          Keep report
        </button>
        <button
          className="btn btn-danger"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            if (!(await cancelReport(issue))) setBusy(false)
          }}
        >
          {busy ? 'Cancelling…' : 'Yes, cancel report'}
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

const NEW_USER_ROLES: Role[] = ['student', 'admin', 'maintenance', 'sysadmin']

function AddUserModal({ close }: { close: () => void }) {
  const { addUser } = useApp()
  const [form, setForm] = useState({
    name: '', role: 'maintenance' as Role, email: '', password: '',
    specialization: GENERAL_SPECIALIZATION, studentNumber: '', block: BLOCKS[0], room: '',
  })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const field = (key: keyof typeof form) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm({ ...form, [key]: e.target.value })

  const submit = async () => {
    const isStudent = form.role === 'student'
    if (!form.name.trim() || !form.email.trim()) return setError('Please fill in name and email.')
    if (form.password.length < 8) return setError('The password must be at least 8 characters.')
    if (isStudent && (!form.studentNumber.trim() || !form.room.trim())) return setError('Please fill in the student number and room.')
    setError('')
    setBusy(true)
    const ok = await addUser({
      name: form.name.trim(),
      email: form.email.trim(),
      role: form.role,
      password: form.password,
      ...(form.role === 'maintenance' ? { specialization: form.specialization } : {}),
      ...(isStudent ? { studentNumber: form.studentNumber.trim(), block: form.block, room: form.room.trim() } : {}),
    })
    if (!ok) setBusy(false)
  }

  return (
    <div className="modal">
      <h3>Add user</h3>
      <p className="modal-sub">Create a new account. Give the person their email and starting password.</p>
      <div className="field">
        <label>Full name</label>
        <input type="text" value={form.name} onChange={field('name')} placeholder="e.g. Zanele Khumalo" />
      </div>
      <div className="field">
        <label>Role</label>
        <select value={form.role} onChange={field('role')}>
          {NEW_USER_ROLES.map((role) => (
            <option key={role} value={role}>
              {ROLE_NAMES[role]}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label>Email address</label>
        <input type="email" value={form.email} onChange={field('email')} placeholder="name@campus.ac.za" autoComplete="off" />
      </div>
      <div className="field">
        <label>Starting password</label>
        <PasswordInput value={form.password} onChange={field('password')} autoComplete="new-password" />
        <div className="field-hint">At least 8 characters. They can change it with “Forgot password?”.</div>
      </div>
      {form.role === 'maintenance' && (
        <div className="field">
          <label>Specialization</label>
          <select value={form.specialization} onChange={field('specialization')}>
            {SPECIALIZATIONS.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
      )}
      {form.role === 'student' && (
        <>
          <div className="field">
            <label>Student number</label>
            <input type="text" value={form.studentNumber} onChange={field('studentNumber')} placeholder="e.g. 22045678" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div className="field">
              <label>Block</label>
              <select value={form.block} onChange={field('block')}>
                {BLOCKS.map((b) => (
                  <option key={b}>{b}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Room</label>
              <input type="text" value={form.room} onChange={field('room')} placeholder="e.g. 204" />
            </div>
          </div>
        </>
      )}
      {error && <div className="field-error">{error}</div>}
      <div className="modal-actions">
        <button className="btn btn-ghost" onClick={close}>
          Cancel
        </button>
        <button className="btn btn-primary" disabled={busy} onClick={submit}>
          <Icon name="check" /> {busy ? 'Adding…' : 'Add user'}
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
        {user ? `Remove ${user.name} (${user.role})? They will no longer be able to log in. This cannot be undone.` : ''}
      </p>
      <div className="modal-actions">
        <button className="btn btn-ghost" onClick={close}>
          Cancel
        </button>
        <button className="btn btn-danger" onClick={() => removeUser(userId)}>
          <Icon name="x" /> Remove user
        </button>
      </div>
    </div>
  )
}

function RemoveCategoryModal({ categoryKey, close }: { categoryKey: string; close: () => void }) {
  const { catInfo, issues, removeCategory } = useApp()
  const category = catInfo(categoryKey)
  const affected = issues.filter((i) => i.category === categoryKey).length

  return (
    <div className="modal">
      <h3>Remove category</h3>
      <p className="modal-sub">
        Remove the “{category.name}” category? Students will no longer be able to choose it.
      </p>
      {affected > 0 && (
        <p style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
          {affected} existing report(s) in this category will be moved to “Other”.
        </p>
      )}
      <div className="modal-actions">
        <button className="btn btn-ghost" onClick={close}>
          Cancel
        </button>
        <button className="btn btn-danger" onClick={() => removeCategory(categoryKey)}>
          <Icon name="x" /> Remove category
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
