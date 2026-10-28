import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import { CameraCapture } from '../components/CameraCapture'
import { EmptyState, IssueRow, StatRow } from '../components/common'
import { Icon } from '../components/Icon'
import { ProgressSteps } from '../components/ProgressSteps'
import { useApp } from '../context/appContext'
import { fetchSimilarIssues } from '../api'
import { canUseWebcam, preparePhoto, type PreparedPhoto } from '../photo'
import { BLOCKS, DEFAULT_FILTERS, ISSUE_VIEWS, OVERDUE_AFTER_DAYS, PRIORITIES, SHARED_PLACES } from '../data/constants'
import { canReportNotFixed, formatDate, isForUser, isOpen, matchesView, stop } from '../utils'
import type { Issue, Priority, SimilarIssue } from '../types'

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

// Opens My Reports with one quick view (all, open or done) selected.
function useShowReports() {
  const { setFilters, setTab } = useApp()
  return (view: string) => {
    setFilters({ ...DEFAULT_FILTERS, view })
    setTab('reports')
  }
}

// Opens the report form, with a category already picked if one is given.
function useStartReport() {
  const { setFilters, setTab } = useApp()
  return (category = 'all') => {
    setFilters({ ...DEFAULT_FILTERS, category })
    setTab('report')
  }
}

const REPORT_VIEWS = ISSUE_VIEWS.filter((v) => ['all', 'open', 'done'].includes(v.key))

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

function greeting(hour: number) {
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

// One line under the banner's report saying who has it and what happens next.
function spotlightNote(issue: Issue) {
  const fixer = issue.assignedToName
  if (issue.status === 'Resolved') return `${fixer ? 'Fixed by ' + fixer : 'Marked as fixed'}. Tap to confirm it worked.`
  if (issue.status === 'Not Resolved') return `${fixer ?? 'Maintenance'} could not fix it yet. Tap to see why.`
  if (fixer) return `${fixer} is on it.`
  return 'Waiting for a fixer to be assigned.'
}

// Welcome banner: who you are, what needs you, and the quickest way to report something.
function WelcomeBanner({ mine }: { mine: Issue[] }) {
  const { auth, setModal } = useApp()
  const startReport = useStartReport()
  const [hour] = useState(() => new Date().getHours())
  const firstName = (auth.name ?? 'there').split(' ')[0]

  const toConfirm = mine.filter((i) => i.status === 'Resolved')
  const open = mine.filter(isOpen)
  // The report to show on the right: one that needs you, otherwise the newest open one.
  const spotlight = toConfirm[0] ?? open[0]

  let message = 'Everything is sorted. Spotted something broken? Report it in under a minute.'
  if (!mine.length) message = 'Something broken in your room or block? Report it here and follow it all the way to fixed.'
  else if (toConfirm.length) message = `${plural(toConfirm.length, 'fix is', 'fixes are')} waiting for you to confirm.`
  else if (open.length) message = `${plural(open.length, 'report is', 'reports are')} being worked on. We'll let you know as things change.`

  return (
    <section className="st-banner">
      <div className="st-banner-photo" aria-hidden="true" />
      <div className="st-banner-copy">
        <span className="st-banner-eyebrow">
          <span className="pulse" /> {greeting(hour)}
        </span>
        <h1>Hi {firstName}, how is your room?</h1>
        <p>{message}</p>
        <div className="st-banner-cta">
          <button className="btn btn-primary" onClick={() => startReport()}>
            <Icon name="plus-circle" /> Report an issue
          </button>
        </div>
      </div>

      {spotlight ? (
        <button className="st-banner-card" onClick={() => setModal({ type: 'detail', issueId: spotlight.id })}>
          <span className="st-banner-card-head">
            <span>
              <span className="ref">{spotlight.ref}</span>
              <b>{spotlight.title}</b>
            </span>
            {spotlight.status === 'Resolved' && <span className="st-banner-flag">Confirm fix</span>}
          </span>
          <ProgressSteps issue={spotlight} />
          <span className="st-banner-card-foot">
            <Icon name={spotlight.status === 'Resolved' ? 'check-circle' : spotlight.assignedToName ? 'tools' : 'clock'} />
            {spotlightNote(spotlight)}
          </span>
        </button>
      ) : (
        <div className="st-banner-card st-banner-card-calm">
          <span className="st-calm-icon">
            <Icon name="check-circle" />
          </span>
          <b>No open reports</b>
          <span>Your room is all good. We're here if anything breaks.</span>
        </div>
      )}
    </section>
  )
}

function Overview() {
  const { notifications, auth, setTab, setModal, categories } = useApp()
  const showReports = useShowReports()
  const startReport = useStartReport()
  const mine = useMyIssues()
  const open = mine.filter(isOpen).length
  const unread = notifications.filter((n) => isForUser(n, auth) && !n.read).length
  const toConfirm = mine.filter((i) => i.status === 'Resolved')

  return (
    <div>
      <WelcomeBanner mine={mine} />
      <StatRow
        items={[
          { icon: 'list', value: mine.length, label: 'Total reports', bg: 'var(--slate-bg)', fg: 'var(--blue-deep)', onClick: () => showReports('all') },
          { icon: 'refresh', value: open, label: 'Currently open', bg: 'var(--warn-bg)', fg: 'var(--warn)', onClick: () => showReports('open') },
          { icon: 'check-circle', value: mine.length - open, label: 'Resolved / closed', bg: 'var(--good-bg)', fg: 'var(--good)', onClick: () => showReports('done') },
          { icon: 'bell', value: unread, label: 'Unread notifications', bg: '#e6f7f6', fg: 'var(--teal-deep)', onClick: () => setTab('notifications') },
        ]}
      />

      {toConfirm.length > 0 && (
        <div className="card st-action-card">
          <div className="card-head">
            <h2>
              <Icon name="check-circle" /> Was it fixed?
            </h2>
          </div>
          <p className="card-sub">Maintenance marked these as fixed. Let us know if it worked — rating the fixer is optional.</p>
          {toConfirm.map((issue) => (
            <IssueRow
              key={issue.id}
              issue={issue}
              extra={
                <span style={{ display: 'inline-flex', gap: 6 }}>
                  <button className="btn btn-ghost btn-sm" onClick={stop(() => setModal({ type: 'notfixed', issueId: issue.id }))}>
                    Not fixed
                  </button>
                  <button className="btn btn-primary btn-sm" onClick={stop(() => setModal({ type: 'feedback', issueId: issue.id }))}>
                    Yes, confirm
                  </button>
                </span>
              }
            />
          ))}
        </div>
      )}

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
        <h2>What's broken?</h2>
        <p className="card-sub">Tap a category to start a report — it takes under a minute.</p>
        <div className="category-grid st-quick-grid">
          {categories.map((c) => (
            <button key={c.key} className="category-tile" onClick={() => startReport(c.key)}>
              <span className="badge">
                <Icon name={c.icon} />
              </span>
              {c.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// What each priority means, so students can pick the right one.
const PRIORITY_HELP: Record<Priority, string> = {
  Low: 'Can wait — small or cosmetic',
  Normal: 'Annoying, but you can manage',
  High: 'Affects daily life or study',
  Urgent: 'Safety risk, flooding, no power',
}

// While a student fills in the form: open reports of the same kind in the same block, so they can
// see it is already known before reporting it again. They can still submit if it's a different problem.
function AlreadyReported({ category, residence, room }: { category: string; residence: string; room: string }) {
  const { catInfo } = useApp()
  const [similar, setSimilar] = useState<SimilarIssue[]>([])

  useEffect(() => {
    if (!category) return
    let current = true
    // Wait until the student stops typing the room before asking.
    const timer = setTimeout(() => {
      fetchSimilarIssues(category, residence, room)
        .then((found) => current && setSimilar(found))
        .catch(() => current && setSimilar([]))
    }, 400)
    return () => {
      current = false
      clearTimeout(timer)
    }
  }, [category, residence, room])

  const shown = category ? similar : []
  if (!shown.length) return null
  const inRoom = shown.some((s) => s.sameRoom)

  return (
    <div className="already-reported" role="status">
      <b>
        <Icon name="flag" />
        {inRoom
          ? `This may already be reported in ${room.trim()}`
          : `${plural(shown.length, 'open report', 'open reports')} for ${catInfo(category).name} in ${residence}`}
      </b>
      <ul>
        {shown.map((s) => (
          <li key={s.ref} className={s.sameRoom ? 'same-room' : ''}>
            <span>
              <span className="ref">{s.ref}</span> {s.title}
              {s.mine && <span className="mine-tag">Your report</span>}
            </span>
            <small>
              {s.room} · reported {formatDate(s.dateReported)} · {s.status}
            </small>
          </li>
        ))}
      </ul>
      <p>If it's the same problem, there's no need to report it again — maintenance already knows. If it's a different problem, carry on.</p>
    </div>
  )
}

// "Take a photo" opens the phone camera (or the laptop webcam); "Upload a photo" picks a saved picture.
function PhotoButtons({
  onFile,
  openCamera,
  disabled = false,
  small = false,
}: {
  onFile: (file: File | undefined) => void
  openCamera: () => void
  disabled?: boolean
  small?: boolean
}) {
  const size = small ? ' btn-sm' : ''
  const pick = (e: ChangeEvent<HTMLInputElement>) => {
    onFile(e.target.files?.[0])
    e.target.value = '' // so the same picture can be chosen again after Remove
  }
  return (
    <>
      {canUseWebcam() ? (
        <button type="button" className={'btn btn-primary' + size} onClick={openCamera} disabled={disabled}>
          <Icon name="camera" /> Take a photo
        </button>
      ) : (
        <label className={'btn btn-primary' + size}>
          <Icon name="camera" /> Take a photo
          <input type="file" accept="image/*" capture="environment" disabled={disabled} onChange={pick} />
        </label>
      )}
      <label className={'btn btn-ghost' + size}>
        <Icon name="image" /> Upload a photo
        <input type="file" accept="image/*" disabled={disabled} onChange={pick} />
      </label>
    </>
  )
}

function ReportIssue() {
  const { categories, addIssue, setTab, filters, auth } = useApp()
  const preset = categories.some((c) => c.key === filters.category) ? filters.category : ''
  // The block and room from sign-up. The block is fixed; the room can be swapped for a shared
  // place in the same block (hallway, bathroom...) with "Somewhere else in my block".
  const homeBlock = auth.block ?? ''
  const homeRoom = auth.room ?? ''
  const [elsewhere, setElsewhere] = useState(!homeRoom)
  const [form, setForm] = useState({
    title: '',
    category: preset,
    priority: 'Normal' as Priority,
    residence: homeBlock || BLOCKS[0],
    room: homeRoom,
    description: '',
  })
  const toggleElsewhere = (on: boolean) => {
    setElsewhere(on)
    setForm((f) => ({ ...f, room: on ? '' : homeRoom }))
  }
  const [photo, setPhoto] = useState<PreparedPhoto | null>(null)
  const [photoError, setPhotoError] = useState('')
  const [preparing, setPreparing] = useState(false)
  const [camera, setCamera] = useState(false)

  const choosePhoto = async (file: File | undefined) => {
    if (!file) return
    setPhotoError('')
    setError('')
    setPreparing(true)
    try {
      setPhoto(await preparePhoto(file))
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : 'That photo could not be used.')
    }
    setPreparing(false)
  }
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const field =
    (key: keyof typeof form) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    if (!form.category) return setError('Please pick what kind of problem it is.')
    setError('')
    setBusy(true)
    // On success the app moves to My Reports; on failure the form stays filled in so it can be retried.
    if (!(await addIssue({ ...form, photo: photo?.upload }))) setBusy(false)
  }

  const days = OVERDUE_AFTER_DAYS[form.priority]

  return (
    <div className="card st-report">
      <div className="st-report-head">
        <span className="badge">
          <Icon name="plus-circle" />
        </span>
        <div>
          <h2>Report a residence issue</h2>
          <p className="card-sub" style={{ margin: 0 }}>
            Four quick steps. You'll get a reference number and updates as it's fixed.
          </p>
        </div>
      </div>

      <form onSubmit={submit}>
        <section className="st-step">
          <h3>
            <span className="st-step-num">1</span> What kind of problem is it?
          </h3>
          <div className="st-cat-picker" role="radiogroup" aria-label="Category">
            {categories.map((c) => (
              <button
                key={c.key}
                type="button"
                role="radio"
                aria-checked={form.category === c.key}
                className={'st-cat' + (form.category === c.key ? ' active' : '')}
                onClick={() => {
                  setForm((f) => ({ ...f, category: c.key }))
                  setError('')
                }}
              >
                <Icon name={c.icon} />
                <span>{c.name}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="st-step">
          <h3>
            <span className="st-step-num">2</span> Tell us about it
          </h3>
          <div className="field">
            <label>Short title *</label>
            <input type="text" value={form.title} onChange={field('title')} placeholder="e.g. Broken bathroom tap" required />
          </div>
          <div className="field">
            <label>What's happening? *</label>
            <textarea
              value={form.description}
              onChange={field('description')}
              placeholder="e.g. The tap under the basin has been dripping since Monday and the floor gets wet."
              required
            />
          </div>
        </section>

        <section className="st-step">
          <h3>
            <span className="st-step-num">3</span> Where is it?
          </h3>
          <div className="st-two">
            <div className="field">
              <label>Block *</label>
              {homeBlock ? (
                <input type="text" value={homeBlock} readOnly className="locked" title="Your block from sign-up" />
              ) : (
                <select value={form.residence} onChange={field('residence')} required>
                  {BLOCKS.map((block) => (
                    <option key={block}>{block}</option>
                  ))}
                </select>
              )}
            </div>
            <div className="field">
              <label>{elsewhere ? 'Where in the block? *' : 'Room *'}</label>
              {elsewhere ? (
                <select value={form.room} onChange={field('room')} required>
                  <option value="" disabled>
                    Choose a shared place
                  </option>
                  {SHARED_PLACES.map((place) => (
                    <option key={place}>{place}</option>
                  ))}
                </select>
              ) : (
                <input type="text" value={homeRoom} readOnly className="locked" title="Your room from sign-up" />
              )}
            </div>
          </div>
          {homeRoom && (
            <label className="st-check">
              <input type="checkbox" checked={elsewhere} onChange={(e) => toggleElsewhere(e.target.checked)} />
              It's somewhere else in my block (hallway, bathroom, common room…)
            </label>
          )}
          <AlreadyReported category={form.category} residence={form.residence} room={form.room} />
        </section>

        <section className="st-step">
          <h3>
            <span className="st-step-num">4</span> How urgent is it?
          </h3>
          <div className="st-priority" role="radiogroup" aria-label="Priority">
            {PRIORITIES.map((p) => (
              <button
                key={p}
                type="button"
                role="radio"
                aria-checked={form.priority === p}
                className={'st-prio st-prio-' + p.toLowerCase() + (form.priority === p ? ' active' : '')}
                onClick={() => setForm((f) => ({ ...f, priority: p }))}
              >
                <b>{p}</b>
                <span>{PRIORITY_HELP[p]}</span>
              </button>
            ))}
          </div>
          <p className="field-hint">
            <Icon name="clock" /> {form.priority} issues are usually sorted within {plural(days, 'day', 'days')}.
          </p>

          <div className="field" style={{ marginTop: 14 }}>
            <label>Photo (optional)</label>
            {photo ? (
              <div className="st-photo">
                <img src={photo.preview} alt="Your photo of the problem" />
                <div>
                  <b>Photo added</b>
                  <small>Maintenance will see this with your report.</small>
                  <span className="st-photo-actions">
                    <PhotoButtons onFile={choosePhoto} openCamera={() => setCamera(true)} small />
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPhoto(null)}>
                      <Icon name="x" /> Remove
                    </button>
                  </span>
                </div>
              </div>
            ) : (
              <div className="st-drop">
                <Icon name="image" />
                <span className="st-drop-text">
                  <b>{preparing ? 'Preparing photo…' : 'Add a photo of the problem'}</b>
                  <small>Take a picture now or upload one you already have. It helps maintenance bring the right tools.</small>
                  <span className="st-photo-actions">
                    <PhotoButtons onFile={choosePhoto} openCamera={() => setCamera(true)} disabled={preparing} />
                  </span>
                </span>
              </div>
            )}
            {photoError && <div className="field-error">{photoError}</div>}
            {camera && <CameraCapture onCapture={choosePhoto} close={() => setCamera(false)} />}
          </div>
        </section>

        {error && <div className="field-error">{error}</div>}
        <div className="st-report-actions">
          <button className="btn btn-ghost" type="button" onClick={() => setTab('overview')}>
            Cancel
          </button>
          <button className="btn btn-primary btn-lg" type="submit" disabled={busy || preparing}>
            <Icon name="check" /> {busy ? 'Submitting…' : 'Submit report'}
          </button>
        </div>
      </form>
    </div>
  )
}

function MyReports() {
  const { setModal, filters, setFilters, catInfo } = useApp()
  const startReport = useStartReport()
  const all = useMyIssues()
  const view = REPORT_VIEWS.some((v) => v.key === filters.view) ? filters.view : 'all'
  // Search by title, reference number, room or category.
  const search = filters.search.trim().toLowerCase()
  const mine = all.filter(
    (issue) =>
      matchesView(issue, view) &&
      (!search || [issue.title, issue.ref, issue.room, catInfo(issue.category).name].join(' ').toLowerCase().includes(search)),
  )

  return (
    <div className="card">
      <div className="card-head">
        <p className="card-sub">{plural(all.length, 'report', 'reports')} submitted so far. Tap a report to see its full progress.</p>
        <button className="btn btn-primary btn-sm" onClick={() => startReport()}>
          <Icon name="plus-circle" /> New report
        </button>
      </div>
      <div className="toolbar">
        <input
          type="search"
          placeholder="Search by title, reference or room..."
          value={filters.search}
          onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          aria-label="Search my reports"
          style={{ flex: '1 1 220px' }}
        />
        {REPORT_VIEWS.map((v) => (
          <button
            key={v.key}
            type="button"
            className={'btn btn-sm ' + (view === v.key ? 'btn-primary' : 'btn-ghost')}
            aria-pressed={view === v.key}
            onClick={() => setFilters({ ...filters, view: v.key })}
          >
            {v.key === 'all' ? 'All reports' : v.label}
          </button>
        ))}
      </div>
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
              ) : issue.status === 'Submitted' ? (
                // Until the admin receives it, fixing the report is more useful than chasing it.
                <button className="btn btn-ghost btn-sm" onClick={stop(() => setModal({ type: 'editReport', issueId: issue.id }))}>
                  Edit
                </button>
              ) : canReportNotFixed(issue) ? (
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={stop(() => setModal({ type: 'notfixed', issueId: issue.id }))}
                >
                  Still not fixed?
                </button>
              ) : undefined
            }
          />
        ))
      ) : (
        <EmptyState
          icon={search ? 'search' : 'list'}
          title={!all.length ? 'No reports yet' : search ? 'No reports match your search' : 'Nothing in this view'}
          sub={
            !all.length
              ? 'Use "Report an Issue" to submit your first report.'
              : search
                ? 'Try other words, or search by reference number like ISS-2026-00125.'
                : 'Try another filter above.'
          }
        />
      )}
    </div>
  )
}

function Notifications() {
  const { notifications, auth, markNotificationsRead, setModal, issues } = useApp()
  const mine = notifications.filter((n) => isForUser(n, auth))
  // Keep highlighting what was unread when the page opened.
  const [unreadOnOpen] = useState(() => new Set(mine.filter((n) => !n.read).map((n) => n.id)))

  // Mark everything as read when the student leaves this page.
  useEffect(() => () => markNotificationsRead(), [markNotificationsRead])

  return (
    <div className="card">
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
            {n.issueId && issues.some((i) => i.id === n.issueId) && (
              <button
                className="btn btn-ghost btn-sm"
                style={{ alignSelf: 'center' }}
                onClick={() => setModal({ type: 'detail', issueId: n.issueId as string })}
              >
                View
              </button>
            )}
          </div>
        ))
      ) : (
        <EmptyState icon="bell" title="No notifications yet" sub="You’ll see updates here as your reports progress." />
      )}
    </div>
  )
}
