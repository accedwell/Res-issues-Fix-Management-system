import type { ChangeEvent } from 'react'
import { EmptyState, IssueRow, StatRow } from '../components/common'
import { Icon } from '../components/Icon'
import { useApp } from '../context/appContext'
import { BLOCKS, DEFAULT_FILTERS, ISSUE_VIEWS, STATUSES, STATUS_CLASS } from '../data/constants'
import { isOpen, matchesView, stop } from '../utils'
import type { Filters } from '../types'

export function AdminDashboard({ tab }: { tab: string }) {
  if (tab === 'issues') return <AllIssues />
  if (tab === 'reports') return <Reports />
  return <Overview />
}

// Opens All Issues with only the given quick view (or status) applied.
function useShowIssues() {
  const { setFilters, setTab } = useApp()
  return (view: string, status = 'all') => {
    setFilters({ ...DEFAULT_FILTERS, view, status })
    setTab('issues')
  }
}

function Overview() {
  const { issues, setModal } = useApp()
  const showIssues = useShowIssues()
  const unassigned = issues.filter((i) => matchesView(i, 'unassigned'))

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
        ]}
      />
      <div className="card">
        <div className="card-head">
          <h2>Needs attention</h2>
          <button className="btn btn-ghost btn-sm" onClick={() => showIssues('all')}>
            View all issues
          </button>
        </div>
        {unassigned.slice(0, 5).map((issue) => (
          <IssueRow
            key={issue.id}
            issue={issue}
            extra={
              <button className="btn btn-navy btn-sm" onClick={stop(() => setModal({ type: 'assign', issueId: issue.id }))}>
                Assign
              </button>
            }
          />
        ))}
      </div>
    </div>
  )
}

function AllIssues() {
  const { issues, categories, filters, setFilters, setModal } = useApp()
  const search = filters.search.trim().toLowerCase()
  const matching = issues.filter(
    (i) =>
      matchesView(i, filters.view) &&
      (filters.status === 'all' || i.status === filters.status) &&
      (filters.category === 'all' || i.category === filters.category) &&
      (filters.residence === 'all' || i.residence === filters.residence) &&
      (!search || (i.title + ' ' + i.ref + ' ' + i.studentName).toLowerCase().includes(search)),
  )

  const filter = (key: keyof Filters) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setFilters({ ...filters, [key]: e.target.value })

  return (
    <div className="card">
      <h2>All Issues</h2>
      <p className="card-sub">{matching.length} matching issue(s)</p>
      <div className="toolbar">
        <input type="text" placeholder="Search title, ref, student..." value={filters.search} onChange={filter('search')} />
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
        <select value={filters.residence} onChange={filter('residence')}>
          <option value="all">All blocks</option>
          {BLOCKS.map((block) => (
            <option key={block}>{block}</option>
          ))}
        </select>
      </div>
      {matching.length ? (
        matching.map((issue) => {
          const needsAssigning = !issue.assignedTo && isOpen(issue)
          return (
            <IssueRow
              key={issue.id}
              issue={issue}
              extra={
                <button
                  className={'btn btn-sm ' + (needsAssigning ? 'btn-navy' : 'btn-ghost')}
                  onClick={stop(() => setModal({ type: 'assign', issueId: issue.id }))}
                >
                  {needsAssigning ? 'Assign' : 'Reassign'}
                </button>
              }
            />
          )
        })
      ) : (
        <EmptyState icon="search" title="No issues match" sub="Try adjusting your filters or search." />
      )}
    </div>
  )
}

function Reports() {
  const { issues, categories, staff } = useApp()
  const showIssues = useShowIssues()
  const rated = issues.filter((i) => i.feedback)
  const average = rated.length
    ? (rated.reduce((sum, i) => sum + (i.feedback?.rating ?? 0), 0) / rated.length).toFixed(1)
    : '—'

  return (
    <div>
      <div className="card">
        <h2>Summary</h2>
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
    </div>
  )
}
