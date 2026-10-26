import { useState, type ChangeEvent } from 'react'
import { EmptyState, IssueRow, StatRow } from '../components/common'
import { ActivityFeed } from '../components/ActivityFeed'
import { Icon } from '../components/Icon'
import { TrendChart } from '../components/TrendChart'
import { useApp } from '../context/appContext'
import { downloadIssuesCsv } from '../exportCsv'
import { buildReportHtml, customPeriod, issuesInPeriod, monthPeriod, openReport } from '../periodReport'
import { BLOCKS, DEFAULT_FILTERS, ISSUE_VIEWS, STATUSES, STATUS_CLASS } from '../data/constants'
import { daysOpen, formatDate, initials, isOpen, isOverdue, lastReopen, matchesView, sameRoom, stop } from '../utils'
import type { Filters, Issue } from '../types'

export function AdminDashboard({ tab }: { tab: string }) {
  if (tab === 'issues') return <AllIssues />
  if (tab === 'reports') return <Reports />
  return <Overview />
}

// Buttons shown on an issue row for the residence admin.
// New reports can be marked as received; open ones can be assigned or reassigned.
function AdminIssueActions({ issue }: { issue: Issue }) {
  const { setModal, receiveIssue } = useApp()
  const [busy, setBusy] = useState(false)
  if (!isOpen(issue)) return null

  return (
    <span style={{ display: 'inline-flex', gap: 6 }}>
      {issue.status === 'Submitted' && (
        <button
          className="btn btn-ghost btn-sm"
          disabled={busy}
          onClick={stop(async () => {
            setBusy(true)
            if (!(await receiveIssue(issue))) setBusy(false)
          })}
        >
          <Icon name="check" /> {busy ? 'Saving…' : 'Mark received'}
        </button>
      )}
      <button
        className={'btn btn-sm ' + (issue.assignedTo ? 'btn-ghost' : 'btn-navy')}
        onClick={stop(() => setModal({ type: 'assign', issueId: issue.id }))}
      >
        {issue.assignedTo ? 'Reassign' : 'Assign'}
      </button>
    </span>
  )
}

// Opens All Issues with only the given quick view (or status) applied.
function useShowIssues() {
  const { setFilters, setTab } = useApp()
  return (view: string, status = 'all', assignee = 'all', residence = 'all', room = '') => {
    setFilters({ ...DEFAULT_FILTERS, view, status, assignee, residence, room })
    setTab('issues')
  }
}

function Overview() {
  const { issues } = useApp()
  const showIssues = useShowIssues()
  const unassigned = issues.filter((i) => matchesView(i, 'unassigned'))
  const overdue = issues.filter(isOverdue)
  // Unassigned, not resolved or overdue issues, overdue first, then the oldest.
  const needsAttention = issues
    .filter((i) => isOpen(i) && (!i.assignedTo || i.status === 'Not Resolved' || isOverdue(i)))
    .sort((a, b) => Number(isOverdue(b)) - Number(isOverdue(a)) || daysOpen(b) - daysOpen(a))

  return (
    <div>
      <StatRow
        items={[
          { icon: 'list', value: issues.length, label: 'Total issues', bg: 'var(--slate-bg)', fg: 'var(--blue-deep)', onClick: () => showIssues('all') },
          { icon: 'refresh', value: issues.filter(isOpen).length, label: 'Currently open', bg: 'var(--warn-bg)', fg: 'var(--warn)', onClick: () => showIssues('open') },
          { icon: 'user', value: unassigned.length, label: 'Awaiting assignment', bg: '#e6f7f6', fg: 'var(--teal-deep)', onClick: () => showIssues('unassigned') },
          {
            icon: 'flag',
            value: issues.filter((i) => matchesView(i, 'urgent')).length,
            label: 'Urgent & open',
            bg: 'var(--bad-bg)',
            fg: 'var(--bad)',
            onClick: () => showIssues('urgent'),
          },
          {
            icon: 'clock',
            value: overdue.length,
            label: 'Overdue',
            bg: 'var(--bad-bg)',
            fg: 'var(--bad)',
            onClick: () => showIssues('overdue'),
          },
        ]}
      />
      <div className="overview-grid">
        <div className="card">
          <div className="card-head">
            <h2>Needs attention</h2>
            <button className="btn btn-ghost btn-sm" onClick={() => showIssues('all')}>
              View all issues
            </button>
          </div>
          <p className="card-sub">Unassigned reports, jobs maintenance could not resolve and anything overdue, most urgent first.</p>
          {needsAttention.length ? (
            needsAttention.slice(0, 6).map((issue) => (
              <IssueRow
                key={issue.id}
                issue={issue}
                extra={<AdminIssueActions issue={issue} />}
              />
            ))
          ) : (
            <EmptyState icon="check-circle" title="All caught up" sub="Every open report is assigned and on time." />
          )}
        </div>
        <TeamWorkload />
        <ActivityFeed />
      </div>
    </div>
  )
}

// Ratings students gave when confirming a fix: overall, per staff member, and the latest comments.
function StudentFeedback({ issues }: { issues: Issue[] }) {
  const { setModal } = useApp()
  // Everything students left when confirming. Rating is optional, so some only have a comment.
  const given = issues
    .filter((i) => i.feedback)
    .map((i) => ({
      issue: i,
      rating: i.feedback?.rating ?? null,
      comment: i.feedback?.comment ?? '',
      // When the student confirmed it: the latest "Closed" step in the history.
      date: [...i.history].reverse().find((h) => h.status === 'Closed')?.date ?? i.dateReported,
    }))
    .sort((a, b) => b.date.localeCompare(a.date))
  const rated = given.flatMap((r) => (r.rating === null ? [] : [{ ...r, rating: r.rating }]))
  const average = rated.length ? rated.reduce((sum, r) => sum + r.rating, 0) / rated.length : 0
  const perStar = [5, 4, 3, 2, 1].map((star) => ({ star, count: rated.filter((r) => r.rating === star).length }))
  const mostStars = Math.max(1, ...perStar.map((s) => s.count))

  const byStaff = new Map<string, number[]>()
  for (const r of rated) {
    const name = r.issue.assignedToName ?? 'Not assigned'
    byStaff.set(name, [...(byStaff.get(name) ?? []), r.rating])
  }
  const staffRatings = [...byStaff.entries()]
    .map(([name, list]) => ({ name, count: list.length, average: list.reduce((a, b) => a + b, 0) / list.length }))
    .sort((a, b) => b.average - a.average || b.count - a.count)

  return (
    <div className="card">
      <h2>Student feedback</h2>
      <p className="card-sub">Ratings students give when they confirm a fix. Low ratings are highlighted.</p>
      {given.length ? (
        <div className="feedback-grid">
          <div>
            <div className="rating-big">
              <b>{rated.length ? average.toFixed(1) : '—'}</b>
              <span className="rating-stars" aria-label={`${average.toFixed(1)} out of 5`}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <span key={n} className={n <= Math.round(average) ? 'on' : ''}>
                    <Icon name="star" />
                  </span>
                ))}
              </span>
              <span className="hotspot-note">
                from {rated.length} rating{rated.length === 1 ? '' : 's'}
              </span>
            </div>
            <ul className="star-bars">
              {perStar.map((s) => (
                <li key={s.star}>
                  <span>{s.star}★</span>
                  <span className="team-bar" aria-hidden="true">
                    <span className={s.star <= 2 ? 'low' : ''} style={{ width: `${(s.count / mostStars) * 100}%` }} />
                  </span>
                  <span>{s.count}</span>
                </li>
              ))}
            </ul>
            <h3 className="hotspot-title" style={{ marginTop: 18 }}>
              Rating per staff member
            </h3>
            <ul className="hotspot-list">
              {staffRatings.map((s) => (
                <li key={s.name} className="staff-rating">
                  <span>{s.name}</span>
                  <span>
                    <b className={s.average < 3 ? 'low' : ''}>{s.average.toFixed(1)}★</b> · {s.count} rated
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="hotspot-title">Latest comments</h3>
            <ul className="hotspot-list">
              {given.slice(0, 6).map((r) => (
                <li key={r.issue.id}>
                  <button
                    className={'hotspot-row' + (r.rating !== null && r.rating <= 2 ? ' low-rating' : '')}
                    onClick={() => setModal({ type: 'detail', issueId: r.issue.id })}
                  >
                    <span className="hotspot-head">
                      <b>
                        {r.issue.ref} · {r.issue.title}
                      </b>
                      {r.rating !== null ? (
                        <span className={'rating-pill' + (r.rating <= 2 ? ' low' : '')}>{r.rating}★</span>
                      ) : (
                        <span className="hotspot-note">Not rated</span>
                      )}
                    </span>
                    <span className="reopen-reason">{r.comment ? `“${r.comment}”` : 'No comment'}</span>
                    <span className="hotspot-note">
                      {r.issue.studentName} · {formatDate(r.date)}
                      {r.issue.assignedToName ? ' · fixed by ' + r.issue.assignedToName : ''}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : (
        <EmptyState icon="star" title="No feedback yet" sub="Students can rate the fixer (optional) when they confirm a fix." />
      )}
    </div>
  )
}

// Fixes the students rejected, newest first, and how often each staff member's work came back.
function ReopenedFixes({ issues }: { issues: Issue[] }) {
  const { setModal } = useApp()
  const showIssues = useShowIssues()
  const reopened = issues
    .filter((i) => (i.reopened ?? 0) > 0)
    .map((i) => ({ issue: i, last: lastReopen(i) }))
    .sort((a, b) => (b.last?.date ?? '').localeCompare(a.last?.date ?? ''))

  const byStaff = new Map<string, number>()
  for (const { issue } of reopened) {
    const name = issue.assignedToName ?? 'Not assigned'
    byStaff.set(name, (byStaff.get(name) ?? 0) + (issue.reopened ?? 0))
  }
  const staffCounts = [...byStaff.entries()].sort((a, b) => b[1] - a[1])
  const total = reopened.reduce((sum, r) => sum + (r.issue.reopened ?? 0), 0)

  return (
    <div className="card">
      <div className="card-head">
        <h2>Re-opened fixes</h2>
        {reopened.length > 0 && (
          <button className="btn btn-ghost btn-sm" onClick={() => showIssues('reopened')}>
            View all
          </button>
        )}
      </div>
      <p className="card-sub">Fixes the student said did not work. A good check on the quality of maintenance work.</p>
      {reopened.length ? (
        <>
          <div className="reopen-summary">
            <span className="reopen-total">
              <b>{total}</b> time{total === 1 ? '' : 's'} re-opened across {reopened.length} issue{reopened.length === 1 ? '' : 's'}
            </span>
            {staffCounts.map(([name, count]) => (
              <span key={name} className="reopen-staff">
                {name} · <b>{count}</b>
              </span>
            ))}
          </div>
          <ul className="hotspot-list">
            {reopened.slice(0, 6).map(({ issue, last }) => (
              <li key={issue.id}>
                <button className="hotspot-row" onClick={() => setModal({ type: 'detail', issueId: issue.id })}>
                  <span className="hotspot-head">
                    <b>
                      {issue.ref} · {issue.title}
                    </b>
                    <span className="repeat-count">Re-opened {issue.reopened}×</span>
                  </span>
                  {last && <span className="reopen-reason">“{last.reason}”</span>}
                  <span className="hotspot-note">
                    {issue.assignedToName ? 'Fixed by ' + issue.assignedToName : 'Not assigned'}
                    {last ? ' · sent back ' + formatDate(last.date) : ''} · now {issue.status}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <EmptyState icon="check-circle" title="No re-opened fixes" sub="Every fix so far has been accepted by the student." />
      )}
    </div>
  )
}

// Where problems keep happening: busiest blocks, and rooms with more than one report.
function Hotspots({ issues }: { issues: Issue[] }) {
  const { catInfo } = useApp()
  const showIssues = useShowIssues()

  // Most common category name among some issues.
  const topCategory = (list: Issue[]) => {
    const counts = new Map<string, number>()
    for (const i of list) counts.set(i.category, (counts.get(i.category) ?? 0) + 1)
    const [key] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0] ?? []
    return key ? catInfo(key).name : ''
  }

  const blocks = BLOCKS.map((block) => {
    const list = issues.filter((i) => i.residence === block)
    return { block, total: list.length, open: list.filter(isOpen).length, top: topCategory(list) }
  }).sort((a, b) => b.total - a.total || b.open - a.open || a.block.localeCompare(b.block))
  const most = Math.max(1, ...blocks.map((b) => b.total))

  // Group reports by block + room (ignoring case and spaces) and keep rooms reported 2+ times.
  const groups = new Map<string, Issue[]>()
  for (const i of issues) {
    const key = i.residence + '|' + i.room.trim().toLowerCase()
    groups.set(key, [...(groups.get(key) ?? []), i])
  }
  const repeats = [...groups.values()]
    .filter((list) => list.length >= 2)
    .map((list) => ({
      block: list[0].residence,
      room: list[0].room.trim(),
      count: list.length,
      open: list.filter(isOpen).length,
      categories: [...new Set(list.map((i) => catInfo(i.category).name))],
      last: list.map((i) => i.dateReported).sort().at(-1) ?? '',
    }))
    .sort((a, b) => b.count - a.count || b.last.localeCompare(a.last))

  return (
    <div className="card">
      <h2>Problem hotspots</h2>
      <p className="card-sub">Where reports come from. Click a block or room to see its reports.</p>
      <div className="hotspot-grid">
        <div>
          <h3 className="hotspot-title">Reports by block</h3>
          <ul className="hotspot-list">
            {blocks.map((b) => (
              <li key={b.block}>
                <button className="hotspot-row" disabled={!b.total} onClick={() => showIssues('all', 'all', 'all', b.block)}>
                  <span className="hotspot-head">
                    <b>{b.block}</b>
                    <span>
                      {b.total} report{b.total === 1 ? '' : 's'}
                      {b.open ? ` · ${b.open} open` : ''}
                    </span>
                  </span>
                  <span className="team-bar" aria-hidden="true">
                    <span style={{ width: `${(b.total / most) * 100}%` }} />
                  </span>
                  {b.top && <span className="hotspot-note">Mostly {b.top}</span>}
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="hotspot-title">Repeated problems in the same room</h3>
          {repeats.length ? (
            <ul className="hotspot-list">
              {repeats.map((r) => (
                <li key={r.block + r.room}>
                  <button className="hotspot-row" onClick={() => showIssues('all', 'all', 'all', r.block, r.room)}>
                    <span className="hotspot-head">
                      <b>
                        {r.block} · {r.room}
                      </b>
                      <span className="repeat-count">{r.count}</span>
                    </span>
                    <span className="hotspot-note">
                      {r.categories.join(', ')} · last reported {formatDate(r.last)}
                      {r.open ? ` · ${r.open} still open` : ''}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon="check-circle" title="No repeat problems" sub="No room or location has been reported more than once." />
          )}
        </div>
      </div>
    </div>
  )
}

// Each maintenance staff member's open, overdue and finished jobs, busiest first.
function TeamWorkload() {
  const { issues, staff } = useApp()
  const showIssues = useShowIssues()
  const rows = staff
    .map((s) => {
      const jobs = issues.filter((i) => i.assignedTo === s.id)
      return {
        ...s,
        open: jobs.filter(isOpen).length,
        overdue: jobs.filter(isOverdue).length,
        done: jobs.filter((i) => !isOpen(i)).length,
      }
    })
    .sort((a, b) => b.open - a.open || b.overdue - a.overdue || a.name.localeCompare(b.name))
  const busiest = Math.max(1, ...rows.map((r) => r.open))

  return (
    <div className="card">
      <div className="card-head">
        <h2>Maintenance team</h2>
      </div>
      <p className="card-sub">Open jobs per person. Click someone to see their jobs.</p>
      {rows.length ? (
        <ul className="team-list">
          {rows.map((r) => (
            <li key={r.id}>
              <button className="team-row" onClick={() => showIssues('all', 'all', r.id)}>
                <span className="team-av">{initials(r.name)}</span>
                <span className="team-main">
                  <span className="team-name">{r.name}</span>
                  <span className="team-spec">
                    {r.specialization}
                    {r.overdue > 0 && <span className="overdue-tag">{r.overdue} overdue</span>}
                  </span>
                  <span className="team-bar" aria-hidden="true">
                    <span style={{ width: `${(r.open / busiest) * 100}%` }} />
                  </span>
                </span>
                <span className="team-count">
                  <b>{r.open}</b>
                  <span>open</span>
                  <small>{r.done} done</small>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon="users" title="No maintenance staff yet" sub="The system administrator can add staff accounts." />
      )}
    </div>
  )
}

function AllIssues() {
  const { issues, categories, filters, setFilters, staff, catInfo } = useApp()
  const search = filters.search.trim().toLowerCase()
  const matching = issues.filter(
    (i) =>
      matchesView(i, filters.view) &&
      (filters.status === 'all' || i.status === filters.status) &&
      (filters.category === 'all' || i.category === filters.category) &&
      (filters.residence === 'all' || i.residence === filters.residence) &&
      (filters.assignee === 'all' || i.assignedTo === filters.assignee) &&
      (!filters.room || sameRoom(i.room, filters.room)) &&
      (!search || (i.title + ' ' + i.ref + ' ' + i.studentName + ' ' + i.room).toLowerCase().includes(search)),
  )

  const filter = (key: keyof Filters) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setFilters({ ...filters, [key]: e.target.value })

  return (
    <div className="card">
      <div className="card-head">
        <h2>All Issues</h2>
        <button
          className="btn btn-ghost btn-sm"
          disabled={!matching.length}
          onClick={() => downloadIssuesCsv(matching, catInfo, 'resifix-issues')}
          title="Download the issues shown below as a spreadsheet"
        >
          <Icon name="file-text" /> Export CSV ({matching.length})
        </button>
      </div>
      <p className="card-sub">{matching.length} matching issue(s)</p>
      <div className="toolbar">
        <input type="text" placeholder="Search title, ref, student, room..." value={filters.search} onChange={filter('search')} />
        <select value={filters.view} onChange={filter('view')} aria-label="Show">
          {ISSUE_VIEWS.map((v) => (
            <option key={v.key} value={v.key}>
              {v.label}
            </option>
          ))}
        </select>
        <select value={filters.status} onChange={filter('status')}>
          <option value="all">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select value={filters.category} onChange={filter('category')}>
          <option value="all">All categories</option>
          {categories.map((c) => (
            <option key={c.key} value={c.key}>
              {c.name}
            </option>
          ))}
        </select>
        <select value={filters.assignee} onChange={filter('assignee')} aria-label="Staff member">
          <option value="all">All staff</option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select value={filters.residence} onChange={filter('residence')}>
          <option value="all">All blocks</option>
          {BLOCKS.map((block) => (
            <option key={block}>{block}</option>
          ))}
        </select>
      </div>
      {filters.room && (
        <div className="filter-chips">
          <span className="filter-chip">
            Room: {filters.residence !== 'all' ? filters.residence + ' · ' : ''}
            {filters.room}
            <button onClick={() => setFilters({ ...filters, room: '' })} aria-label="Clear room filter">
              <Icon name="x" />
            </button>
          </span>
        </div>
      )}
      {matching.length ? (
        matching.map((issue) => {
          return <IssueRow key={issue.id} issue={issue} extra={isOpen(issue) ? <AdminIssueActions issue={issue} /> : undefined} />
        })
      ) : (
        <EmptyState icon="search" title="No issues match" sub="Try adjusting your filters or search." />
      )}
    </div>
  )
}

// Every month from the first report until the current one (YYYY-MM), newest first.
function reportMonths(issues: Issue[], current: string): string[] {
  const first = issues.reduce((min, i) => (i.dateReported < min ? i.dateReported : min), current)
  const months: string[] = []
  for (let d = new Date(first.slice(0, 7) + '-01T00:00:00Z'); d.toISOString().slice(0, 7) <= current; d.setUTCMonth(d.getUTCMonth() + 1)) {
    months.unshift(d.toISOString().slice(0, 7))
  }
  return months
}

// Pick a month (or your own dates), then view the report, save it as a PDF or download the issues as a spreadsheet.
// "scope" describes any search on the Reports page, so the report says what it covers.
function PeriodReport({ issues, scope }: { issues: Issue[]; scope: string }) {
  const { catInfo, auth } = useApp()
  const [today] = useState(() => new Date().toISOString().slice(0, 10))
  const thisMonth = today.slice(0, 7)
  const months = reportMonths(issues, thisMonth)
  const [choice, setChoice] = useState(thisMonth)
  const [from, setFrom] = useState(thisMonth + '-01')
  const [to, setTo] = useState(today)
  const [blocked, setBlocked] = useState(false)

  const custom = choice === 'custom'
  const badRange = custom && (!from || !to || from > to)
  const period = custom ? customPeriod(from, to) : monthPeriod(choice)
  const count = badRange ? 0 : issuesInPeriod(issues, period).length

  const open = (print: boolean) => {
    const html = buildReportHtml(issues, period, catInfo, auth.name ?? 'Residence administrator', scope)
    setBlocked(!openReport(html, print))
  }

  return (
    <div className="card">
      <h2>Period report</h2>
      <p className="card-sub">A report for one month or dates you choose. View it, save it as a PDF, or download the issues as a spreadsheet.</p>
      <div className="toolbar" style={{ alignItems: 'center' }}>
        <select value={choice} onChange={(e) => setChoice(e.target.value)} aria-label="Report period">
          {months.map((m) => (
            <option key={m} value={m}>
              {monthPeriod(m).label}
              {m === thisMonth ? ' (this month)' : ''}
            </option>
          ))}
          <option value="custom">Choose dates…</option>
        </select>
        {custom && (
          <>
            <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} aria-label="From" />
            <span className="hotspot-note">to</span>
            <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} aria-label="To" />
          </>
        )}
      </div>
      {badRange ? (
        <div className="field-error">Pick a start date that is on or before the end date.</div>
      ) : (
        <p className="hotspot-note" style={{ marginTop: 0 }}>
          {count} issue{count === 1 ? '' : 's'} reported in {period.label}.
        </p>
      )}
      <div className="toolbar" style={{ marginTop: 12, marginBottom: 0 }}>
        <button className="btn btn-primary btn-sm" disabled={badRange} onClick={() => open(false)}>
          <Icon name="eye" /> View report
        </button>
        <button className="btn btn-ghost btn-sm" disabled={badRange} onClick={() => open(true)}>
          <Icon name="file-text" /> Download PDF
        </button>
        <button
          className="btn btn-ghost btn-sm"
          disabled={badRange || !count}
          onClick={() => downloadIssuesCsv(issuesInPeriod(issues, period), catInfo, `resifix-report-${period.slug}`)}
        >
          <Icon name="list" /> Download spreadsheet (CSV)
        </button>
      </div>
      {blocked && <div className="field-error">Your browser blocked the new tab. Allow pop-ups for this site and try again.</div>}
    </div>
  )
}

const NO_SEARCH = { text: '', category: 'all', block: 'all', staff: 'all' }
// How many matching issues to list under the search before "Show all".
const RESULTS_SHOWN = 5

function Reports() {
  const { issues: all, categories, staff, catInfo } = useApp()
  const showIssues = useShowIssues()
  // Searching narrows every section on this page, the period report and the downloads.
  const [search, setSearch] = useState(NO_SEARCH)
  const [showAllResults, setShowAllResults] = useState(false)
  const text = search.text.trim().toLowerCase()
  const issues = all.filter(
    (i) =>
      (search.category === 'all' || i.category === search.category) &&
      (search.block === 'all' || i.residence === search.block) &&
      (search.staff === 'all' || i.assignedTo === search.staff) &&
      (!text ||
        [i.title, i.ref, i.studentName, i.room, i.description, i.assignedToName ?? ''].join(' ').toLowerCase().includes(text)),
  )
  const searching = !!text || search.category !== 'all' || search.block !== 'all' || search.staff !== 'all'
  const scope = [
    text && `"${search.text.trim()}"`,
    search.category !== 'all' && catInfo(search.category).name,
    search.block !== 'all' && search.block,
    search.staff !== 'all' && staff.find((s) => s.id === search.staff)?.name,
  ]
    .filter(Boolean)
    .join(' · ')
  const set = (key: keyof typeof NO_SEARCH) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setSearch({ ...search, [key]: e.target.value })
  const rated = issues.filter((i) => i.feedback?.rating != null)
  const average = rated.length
    ? (rated.reduce((sum, i) => sum + (i.feedback?.rating ?? 0), 0) / rated.length).toFixed(1)
    : '—'

  return (
    <div>
      <div className="card">
        <h2>Search reports</h2>
        <p className="card-sub">Search or filter, and every section below — including the period report and downloads — shows only the matching issues.</p>
        <div className="toolbar" style={{ marginBottom: 0 }}>
          <input
            type="search"
            placeholder="Search title, ref, student, room, staff..."
            value={search.text}
            onChange={set('text')}
            aria-label="Search reports"
            style={{ flex: '1 1 240px' }}
          />
          <select value={search.category} onChange={set('category')} aria-label="Category">
            <option value="all">All categories</option>
            {categories.map((c) => (
              <option key={c.key} value={c.key}>
                {c.name}
              </option>
            ))}
          </select>
          <select value={search.block} onChange={set('block')} aria-label="Block">
            <option value="all">All blocks</option>
            {BLOCKS.map((b) => (
              <option key={b}>{b}</option>
            ))}
          </select>
          <select value={search.staff} onChange={set('staff')} aria-label="Staff member">
            <option value="all">All staff</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          {searching && (
            <button className="btn btn-ghost btn-sm" onClick={() => setSearch(NO_SEARCH)}>
              <Icon name="x" /> Clear
            </button>
          )}
        </div>
        {searching && (
          <p className="hotspot-note" style={{ margin: '12px 0 0' }}>
            Showing <b>{issues.length}</b> of {all.length} issues for {scope}.
          </p>
        )}
        {searching && issues.length > 0 && (
          <div className="search-results">
            {(showAllResults ? issues : issues.slice(0, RESULTS_SHOWN)).map((issue) => (
              <IssueRow key={issue.id} issue={issue} />
            ))}
            {issues.length > RESULTS_SHOWN && (
              <button className="btn btn-ghost btn-sm" onClick={() => setShowAllResults(!showAllResults)}>
                {showAllResults ? 'Show fewer' : `Show all ${issues.length} results`}
              </button>
            )}
          </div>
        )}
      </div>
      {searching && !issues.length ? (
        <div className="card">
          <EmptyState icon="search" title="No issues match your search" sub="Try other words or clear the filters." />
        </div>
      ) : (
        <>
          <PeriodReport issues={issues} scope={scope} />
          <div className="card">
            <div className="card-head">
              <h2>Summary</h2>
              <button
                className="btn btn-ghost btn-sm"
                disabled={!issues.length}
                onClick={() => downloadIssuesCsv(issues, catInfo, searching ? 'resifix-search-results' : 'resifix-all-issues')}
                title={searching ? 'Download the matching issues as a spreadsheet' : 'Download every issue as a spreadsheet'}
              >
                <Icon name="file-text" /> {searching ? `Export ${issues.length === 1 ? 'this issue' : `these ${issues.length} issues`} (CSV)` : 'Export all issues (CSV)'}
              </button>
            </div>
            <StatRow
              items={[
                { icon: 'list', value: issues.length, label: 'Total issues logged', bg: 'var(--slate-bg)', fg: 'var(--blue-deep)', onClick: () => showIssues('all') },
                {
                  icon: 'check-circle',
                  value: issues.filter((i) => i.status === 'Closed').length,
                  label: 'Closed & confirmed',
                  bg: 'var(--good-bg)',
                  fg: 'var(--good)',
                  onClick: () => showIssues('all', 'Closed'),
                },
                { icon: 'star', value: average, label: 'Average feedback rating', bg: 'var(--warn-bg)', fg: 'var(--warn)' },
                { icon: 'user', value: staff.length, label: 'Maintenance staff', bg: '#e6f7f6', fg: 'var(--teal-deep)' },
              ]}
            />
          </div>
          <TrendChart issues={issues} />
          <Hotspots issues={issues} />
          <ReopenedFixes issues={issues} />
          <StudentFeedback issues={issues} />
          <div className="card">
            <h2>Issues by category</h2>
            <table className="simple">
              <tbody>
                <tr>
                  <th>Category</th>
                  <th>Reports</th>
                </tr>
                {categories
                  .map((c) => ({ c, n: issues.filter((i) => i.category === c.key).length }))
                  .filter(({ n }) => n > 0)
                  .map(({ c, n }) => (
                    <tr key={c.key}>
                      <td>
                        <Icon name={c.icon} /> {c.name}
                      </td>
                      <td>{n}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <div className="card">
            <h2>Issues by status</h2>
            <table className="simple">
              <tbody>
                <tr>
                  <th>Status</th>
                  <th>Count</th>
                </tr>
                {STATUSES.map((s) => (
                  <tr key={s}>
                    <td>
                      <span className={'status-pill ' + STATUS_CLASS[s]}>{s}</span>
                    </td>
                    <td>{issues.filter((i) => i.status === s).length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
