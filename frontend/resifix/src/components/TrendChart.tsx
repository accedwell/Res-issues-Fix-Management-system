import { useState } from 'react'
import type { Issue } from '../types'

const WEEKS = 8
const DAY_MS = 24 * 60 * 60 * 1000

// Monday (UTC) of the week a YYYY-MM-DD day falls in, as a timestamp.
function weekStart(day: string): number {
  const t = Date.parse(day)
  const weekday = (new Date(t).getUTCDay() + 6) % 7 // Monday = 0
  return t - weekday * DAY_MS
}

// The day an issue was fixed: the latest "Resolved" step, or "Closed" if it skipped straight there.
function fixedOn(issue: Issue): string | undefined {
  const steps = [...issue.history].reverse()
  return (steps.find((h) => h.status === 'Resolved') ?? steps.find((h) => h.status === 'Closed'))?.date
}

const weekLabel = (t: number) => new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short', timeZone: 'UTC' })

// Round the top of the axis up to a clean number, with 3–4 ticks.
function niceTicks(max: number): number[] {
  const top = Math.max(2, max)
  const step = top <= 4 ? 1 : top <= 10 ? 2 : top <= 20 ? 5 : Math.ceil(top / 4 / 5) * 5
  const ticks = []
  for (let v = 0; v <= top + step - 1 && ticks.length < 6; v += step) ticks.push(v)
  return ticks
}

interface Week {
  start: number
  reported: number
  fixed: number
}

// Reports received vs. issues fixed per week. Columns, one shared axis, hover for exact numbers.
export function TrendChart({ issues }: { issues: Issue[] }) {
  const [hover, setHover] = useState<number | null>(null)
  const [asTable, setAsTable] = useState(false)

  // Read today once, so the weeks don't shift while the page is open and re-rendering.
  const [today] = useState(() => new Date().toISOString().slice(0, 10))
  const thisWeek = weekStart(today)
  const weeks: Week[] = Array.from({ length: WEEKS }, (_, i) => ({
    start: thisWeek - (WEEKS - 1 - i) * 7 * DAY_MS,
    reported: 0,
    fixed: 0,
  }))
  const byStart = new Map(weeks.map((w) => [w.start, w]))
  for (const issue of issues) {
    const reported = byStart.get(weekStart(issue.dateReported))
    if (reported) reported.reported++
    const day = fixedOn(issue)
    const fixed = day ? byStart.get(weekStart(day)) : undefined
    if (fixed) fixed.fixed++
  }

  const totalReported = weeks.reduce((s, w) => s + w.reported, 0)
  const totalFixed = weeks.reduce((s, w) => s + w.fixed, 0)
  const backlogChange = totalReported - totalFixed
  const ticks = niceTicks(Math.max(...weeks.map((w) => Math.max(w.reported, w.fixed))))
  const top = ticks[ticks.length - 1]
  const pct = (v: number) => `${(v / top) * 100}%`

  return (
    <div className="card trend-card">
      <div className="card-head">
        <h2>Reported vs. fixed</h2>
        <button className="btn btn-ghost btn-sm" onClick={() => setAsTable((t) => !t)} aria-pressed={asTable}>
          {asTable ? 'Show as chart' : 'Show as table'}
        </button>
      </div>
      <p className="card-sub">
        Last {WEEKS} weeks: <b className="trend-num">{totalReported}</b> reported,{' '}
        <b className="trend-num">{totalFixed}</b> fixed —{' '}
        {backlogChange > 0
          ? `the backlog grew by ${backlogChange}.`
          : backlogChange < 0
            ? `the backlog shrank by ${-backlogChange}.`
            : 'the backlog stayed level.'}
      </p>

      <div className="trend-legend" aria-hidden={asTable}>
        <span>
          <i className="swatch reported" /> Reported
        </span>
        <span>
          <i className="swatch fixed" /> Fixed
        </span>
      </div>

      {asTable ? (
        <table className="simple">
          <thead>
            <tr>
              <th>Week of</th>
              <th>Reported</th>
              <th>Fixed</th>
            </tr>
          </thead>
          <tbody>
            {weeks.map((w) => (
              <tr key={w.start}>
                <td>{weekLabel(w.start)}</td>
                <td className="trend-num">{w.reported}</td>
                <td className="trend-num">{w.fixed}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="trend-chart" role="img" aria-label={`Reports and fixes per week for the last ${WEEKS} weeks`}>
          <div className="trend-plot">
            {ticks.map((t) => (
              <div key={t} className="trend-grid" style={{ bottom: pct(t) }}>
                <span>{t}</span>
              </div>
            ))}
            <div className="trend-groups">
              {weeks.map((w, i) => {
                const current = i === WEEKS - 1
                return (
                  <div
                    key={w.start}
                    className={'trend-group' + (hover === i ? ' hover' : '')}
                    onMouseEnter={() => setHover(i)}
                    onMouseLeave={() => setHover(null)}
                    onFocus={() => setHover(i)}
                    onBlur={() => setHover(null)}
                    tabIndex={0}
                    aria-label={`Week of ${weekLabel(w.start)}: ${w.reported} reported, ${w.fixed} fixed`}
                  >
                    <div className="trend-bars">
                      <span className="trend-bar reported" style={{ height: pct(w.reported) }}>
                        {current && w.reported > 0 && <em>{w.reported}</em>}
                      </span>
                      <span className="trend-bar fixed" style={{ height: pct(w.fixed) }}>
                        {current && w.fixed > 0 && <em>{w.fixed}</em>}
                      </span>
                    </div>
                    {hover === i && (
                      <div className="trend-tip" role="status">
                        <b>Week of {weekLabel(w.start)}</b>
                        <span>
                          <i className="swatch reported" /> {w.reported} reported
                        </span>
                        <span>
                          <i className="swatch fixed" /> {w.fixed} fixed
                        </span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
          <div className="trend-axis">
            {weeks.map((w, i) => (
              <span key={w.start}>{i === WEEKS - 1 ? 'This week' : weekLabel(w.start)}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
