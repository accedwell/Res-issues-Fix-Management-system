import { useState } from 'react'
import { EmptyState } from '../components/common'
import { Icon } from '../components/Icon'
import { useApp } from '../context/appContext'
import { CATEGORY_PLAIN, DEFAULT_FILTERS } from '../data/constants'
import { isOpen } from '../utils'

// The staff manager's "what do students report most" card: a donut of all reports by kind of
// problem, with the most reported kind called out above it and a list of counts beside it.

// Colours for the five biggest kinds, biggest first. Checked for colour-blind readers on the dark
// card with the data-viz palette validator. Everything smaller is folded into one grey slice.
const COLORS = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181']
const REST_COLOR = '#7d8aa6'
const REST_KEY = '__rest'

const SIZE = 200
const RADIUS = 78
const THICKNESS = 28
const GAP = 2 // a thin gap of card colour between slices
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

interface Slice {
  key: string
  // The category name (e.g. "Plumbing"), short enough for the middle of the ring.
  name: string
  // What the problem is in everyday words (e.g. "Leaking taps, pipes and toilets").
  label: string
  icon: string
  count: number
  open: number
  color: string
}

const percent = (count: number, total: number) => Math.round((count / total) * 100)

export function IssueMix() {
  const { issues, catInfo, setFilters, setTab } = useApp()
  const [active, setActive] = useState<string | null>(null)
  const total = issues.length

  // Count reports per kind, biggest first (ties in name order).
  const counts = new Map<string, { count: number; open: number }>()
  for (const issue of issues) {
    const row = counts.get(issue.category) ?? { count: 0, open: 0 }
    row.count++
    if (isOpen(issue)) row.open++
    counts.set(issue.category, row)
  }
  const ranked = [...counts.entries()]
    .map(([key, row]) => {
      const { name, icon } = catInfo(key)
      return { key, ...row, name, icon, label: CATEGORY_PLAIN[key] ?? name }
    })
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))

  const slices: Slice[] = ranked.slice(0, COLORS.length).map((row, i) => ({ ...row, color: COLORS[i] }))
  const rest = ranked.slice(COLORS.length)
  if (rest.length === 1) {
    // Just one more kind: show it by name (in grey) rather than as "1 other kind".
    slices.push({ ...rest[0], color: REST_COLOR })
  } else if (rest.length) {
    slices.push({
      key: REST_KEY,
      name: 'Everything else',
      label: 'Everything else',
      icon: 'dots',
      count: rest.reduce((sum, r) => sum + r.count, 0),
      open: rest.reduce((sum, r) => sum + r.open, 0),
      color: REST_COLOR,
    })
  }

  if (!total) {
    return (
      <div className="card">
        <h2>What students report most</h2>
        <EmptyState icon="list" title="No reports yet" sub="The chart fills in as students report issues." />
      </div>
    )
  }

  const top = ranked.filter((r) => r.count === ranked[0].count)
  const showKind = (key: string) => {
    setFilters({ ...DEFAULT_FILTERS, category: key })
    setTab('issues')
  }

  // Each slice is an arc of one circle's outline, laid end to end from 12 o'clock.
  const arcLength = (slice: Slice) => (slice.count / total) * CIRCUMFERENCE
  const arcs = slices.map((slice, i) => {
    const start = slices.slice(0, i).reduce((sum, s) => sum + arcLength(s), 0)
    const length = arcLength(slice)
    return { slice, offset: -start, length: slices.length > 1 ? Math.max(length - GAP, 0.5) : length }
  })
  const shown = slices.find((s) => s.key === active)

  return (
    <div className="card">
      <h2>What students report most</h2>
      <p className="card-sub">Every report so far, by kind of problem. Click a kind to see its reports.</p>

      <div className="mix-top">
        <span className="issue-cat-badge">
          <Icon name={top[0].icon} />
        </span>
        <span>
          <span className="mix-top-label">Most reported</span>
          {/* Kinds tied for the most reports each get their own line. */}
          {top.map((t) => (
            <b key={t.key}>{t.label}</b>
          ))}
          <span className="mix-top-figure">
            {top.length > 1
              ? `${top.map((t) => t.name).join(' and ')} · tied on ${top[0].count} reports each`
              : `${top[0].name} · ${top[0].count} of ${total} reports (${percent(top[0].count, total)}%)`}
            {top.length === 1 && top[0].open > 0 && ` · ${top[0].open} still open`}
          </span>
        </span>
      </div>

      <div className="mix-body">
        <svg
          className="mix-donut"
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          role="img"
          aria-label={`Reports by kind: ${slices.map((s) => `${s.label} ${s.count}`).join(', ')}.`}
        >
          <g transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}>
            {arcs.map(({ slice, offset, length }) => (
              <circle
                key={slice.key}
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={RADIUS}
                fill="none"
                stroke={slice.color}
                strokeWidth={active === slice.key ? THICKNESS + 6 : THICKNESS}
                strokeDasharray={`${length} ${CIRCUMFERENCE}`}
                strokeDashoffset={offset}
                opacity={active && active !== slice.key ? 0.35 : 1}
                className="mix-slice"
                onMouseEnter={() => setActive(slice.key)}
                onMouseLeave={() => setActive(null)}
                onClick={() => slice.key !== REST_KEY && showKind(slice.key)}
              >
                <title>{`${slice.label}: ${slice.count} report${slice.count === 1 ? '' : 's'} (${percent(slice.count, total)}%)`}</title>
              </circle>
            ))}
          </g>
          {/* The middle shows the total, or the slice being pointed at. */}
          <text x="50%" y="46%" className="mix-center-value">
            {shown ? `${percent(shown.count, total)}%` : total}
          </text>
          <text x="50%" y="59%" className="mix-center-label">
            {shown ? shown.name : 'reports'}
          </text>
        </svg>

        <ul className="mix-legend">
          {slices.map((slice) => {
            const content = (
              <>
                <span className="mix-swatch" style={{ background: slice.color }} />
                <span className="mix-name">
                  <span>{slice.label}</span>
                  <small>
                    {slice.key === REST_KEY ? rest.map((r) => r.name).join(', ') : slice.name}
                    {slice.open > 0 && ` · ${slice.open} open`}
                  </small>
                </span>
                <span className="mix-count">{slice.count}</span>
                <span className="mix-pct">{percent(slice.count, total)}%</span>
              </>
            )
            const hover = { onMouseEnter: () => setActive(slice.key), onMouseLeave: () => setActive(null) }
            return (
              <li key={slice.key}>
                {slice.key === REST_KEY ? (
                  <div className={'mix-row' + (active === slice.key ? ' on' : '')} {...hover} title={rest.map((r) => `${r.name} ${r.count}`).join(', ')}>
                    {content}
                  </div>
                ) : (
                  <button
                    className={'mix-row' + (active === slice.key ? ' on' : '')}
                    onClick={() => showKind(slice.key)}
                    onFocus={() => setActive(slice.key)}
                    onBlur={() => setActive(null)}
                    {...hover}
                  >
                    {content}
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
