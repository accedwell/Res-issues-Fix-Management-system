import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { apiAddLeave, apiRemoveLeave, apiSetSchedule, fetchAttendance } from '../api'
import { EmptyState } from '../components/common'
import { Icon } from '../components/Icon'
import { useApp } from '../context/appContext'
import { describeHours, leaveSpan, todayLocal, WEEK } from '../dutyUtils'
import { downloadTableCsv } from '../exportCsv'
import { useClockCode, useQrImage } from '../useClockCode'
import { formatTime } from '../utils'
import type { AttendanceRow, Leave, Schedule, Staff, WorkHours } from '../types'

const errorText = (err: unknown) => (err instanceof Error ? err.message : 'Something went wrong. Please try again.')

// ===== Wall screen =====
// Full screen for a tablet or old phone on the maintenance office wall. In wall-screen mode the code
// changes every 30 seconds, so a photo of it is useless almost at once; nobody has to print anything.
export function WallScreen({ close }: { close: () => void }) {
  const { staff } = useApp()
  const { code } = useClockCode()
  const qr = useQrImage(code?.code, 800)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    document.documentElement.requestFullscreen?.().catch(() => undefined)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    window.addEventListener('keydown', onKey)
    return () => {
      clearInterval(timer)
      window.removeEventListener('keydown', onKey)
      if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined)
    }
  }, [close])

  const left = code?.changesAt ? Math.max(0, Math.ceil((Date.parse(code.changesAt) - now) / 1000)) : null
  const onDuty = staff.filter((s) => s.onDuty)

  return createPortal(
    <div className="wall-screen">
      <button className="btn btn-ghost btn-sm wall-close" onClick={close}>
        <Icon name="x" /> Close
      </button>
      <div className="wall-time">{new Date(now).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</div>
      <h1>Maintenance clock-in</h1>
      <p>Log in to ResiFix, tap Scan QR code, and point your phone at this code.</p>
      <div className="wall-qr">{qr ? <img src={qr} alt="Clock-in QR code" /> : <span>Loading…</span>}</div>
      <div className="wall-code">{code?.code ?? '······'}</div>
      {left !== null && code && (
        <div className="wall-timer">
          <div className="wall-bar">
            <span style={{ width: `${(left / code.rotateSeconds) * 100}%` }} />
          </div>
          New code in {left} s
        </div>
      )}
      <div className="wall-team">
        {onDuty.length ? (
          onDuty.map((s) => (
            <span key={s.id} className={'wall-person' + (s.onBreak ? ' break' : '')}>
              {s.name} · {s.onBreak && s.breakUntil ? `break until ${formatTime(s.breakUntil)}` : `in since ${formatTime(s.onDutySince ?? '')}`}
            </span>
          ))
        ) : (
          <span className="wall-person off">Nobody has clocked in yet</span>
        )}
      </div>
    </div>,
    document.body,
  )
}

// ===== Work days and hours =====
export function HoursEditor({ value, onChange }: { value: WorkHours; onChange: (hours: WorkHours) => void }) {
  const toggle = (day: number) =>
    onChange({ ...value, days: value.days.includes(day) ? value.days.filter((d) => d !== day) : [...value.days, day] })
  return (
    <div className="hours-editor">
      <div className="day-chips" role="group" aria-label="Work days">
        {WEEK.map((w) => (
          <button key={w.day} type="button" className={'day-chip' + (value.days.includes(w.day) ? ' on' : '')} onClick={() => toggle(w.day)}>
            {w.short}
          </button>
        ))}
      </div>
      <div className="work-hours">
        <label>
          Starts
          <input type="time" value={value.start} onChange={(e) => onChange({ ...value, start: e.target.value })} />
        </label>
        <label>
          Ends
          <input type="time" value={value.end} onChange={(e) => onChange({ ...value, end: e.target.value })} />
        </label>
      </div>
    </div>
  )
}

// ===== One technician's schedule and leave =====
export function ScheduleModal({
  tech,
  schedule,
  team,
  leave,
  close,
  changed,
}: {
  tech: Staff
  schedule: Schedule
  team: WorkHours
  leave: Leave[]
  close: () => void
  changed: () => void
}) {
  const [own, setOwn] = useState(schedule.custom)
  const [hours, setHours] = useState<WorkHours>(schedule.custom ? schedule : team)
  const [away, setAway] = useState({ startDate: todayLocal(), endDate: todayLocal(), reason: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const mine = leave.filter((l) => l.userId === tech.id)

  const act = async (action: () => Promise<unknown>, after?: () => void) => {
    setBusy(true)
    setError('')
    try {
      await action()
      changed()
      after?.()
    } catch (err) {
      setError(errorText(err))
    }
    setBusy(false)
  }

  return createPortal(
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && close()}>
      <div className="modal schedule-modal">
        <h3>{tech.name}</h3>
        <p className="modal-sub">{tech.specialization} · work hours and leave</p>

        <h4 className="modal-section">Work hours</h4>
        <label className="choice">
          <input type="radio" checked={!own} onChange={() => setOwn(false)} /> Team hours ({describeHours(team)})
        </label>
        <label className="choice">
          <input type="radio" checked={own} onChange={() => setOwn(true)} /> Own hours
        </label>
        {own && <HoursEditor value={hours} onChange={setHours} />}
        <div className="modal-actions" style={{ marginTop: 10 }}>
          <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => void act(() => apiSetSchedule(tech.id, own ? hours : null))}>
            Save hours
          </button>
        </div>

        <h4 className="modal-section">Leave</h4>
        {mine.length ? (
          <ul className="list-plain leave-list">
            {mine.map((l) => (
              <li key={l.id}>
                <span>
                  <b>{leaveSpan(l.startDate, l.endDate)}</b>
                  {l.reason && <small> · {l.reason}</small>}
                </span>
                <button className="btn btn-danger-ghost btn-sm" disabled={busy} onClick={() => void act(() => apiRemoveLeave(l.id))}>
                  <Icon name="x" /> Remove
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="field-hint">No leave booked.</p>
        )}
        <div className="leave-form">
          <label>
            From
            <input type="date" value={away.startDate} onChange={(e) => setAway({ ...away, startDate: e.target.value })} />
          </label>
          <label>
            To
            <input type="date" value={away.endDate} min={away.startDate} onChange={(e) => setAway({ ...away, endDate: e.target.value })} />
          </label>
          <label className="grow">
            Reason (optional)
            <input value={away.reason} maxLength={80} placeholder="Annual leave, sick, training…" onChange={(e) => setAway({ ...away, reason: e.target.value })} />
          </label>
          <button
            className="btn btn-ghost btn-sm"
            disabled={busy || !away.startDate}
            onClick={() => void act(() => apiAddLeave({ userId: tech.id, ...away }), () => setAway({ ...away, reason: '' }))}
          >
            <Icon name="plus-circle" /> Add leave
          </button>
        </div>
        {error && <p className="field-error">{error}</p>}
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={close}>
            Done
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

// ===== Upcoming leave for the whole team =====
export function LeaveCard({ leave, names, changed }: { leave: Leave[]; names: Map<string, string>; changed: () => void }) {
  const [busy, setBusy] = useState('')
  const upcoming = leave.filter((l) => names.has(l.userId))
  return (
    <div className="card">
      <h2>Leave</h2>
      <p className="card-sub">Technicians on leave get no jobs and are not counted as absent. Add leave with the Schedule button above.</p>
      {upcoming.length ? (
        <ul className="list-plain leave-list">
          {upcoming.map((l) => (
            <li key={l.id}>
              <span>
                <b>{names.get(l.userId)}</b> · {leaveSpan(l.startDate, l.endDate)}
                {l.reason && <small> · {l.reason}</small>}
              </span>
              <button
                className="btn btn-danger-ghost btn-sm"
                disabled={busy === l.id}
                onClick={async () => {
                  setBusy(l.id)
                  await apiRemoveLeave(l.id).catch(() => undefined)
                  changed()
                  setBusy('')
                }}
              >
                <Icon name="x" /> Remove
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="card-sub" style={{ margin: 0 }}>
          No leave coming up.
        </p>
      )}
    </div>
  )
}

// ===== Monthly attendance report =====
const recentMonths = () => {
  const months: { value: string; label: string }[] = []
  const d = new Date()
  d.setDate(1)
  for (let i = 0; i < 12; i++) {
    months.push({
      value: d.toLocaleDateString('en-CA').slice(0, 7),
      label: d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }),
    })
    d.setMonth(d.getMonth() - 1)
  }
  return months
}

const COLUMNS: [string, (r: AttendanceRow) => string | number][] = [
  ['Technician', (r) => r.name],
  ['Job', (r) => r.specialization],
  ['Work days', (r) => r.scheduledDays],
  ['Days worked', (r) => r.daysWorked],
  ['Missed', (r) => r.missedDays],
  ['Leave', (r) => r.leaveDays],
  ['Days late', (r) => r.lateDays],
  ['Minutes late', (r) => r.lateMinutes],
  ['Left early', (r) => r.earlyLeaves],
  ['Forgot clock-out', (r) => r.forgotClockOut],
  ['Hours worked', (r) => r.hoursWorked],
  ['Break minutes', (r) => r.breakMinutes],
]

export function AttendanceReport() {
  const months = recentMonths()
  const [month, setMonth] = useState(months[0].value)
  const [rows, setRows] = useState<AttendanceRow[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let current = true
    fetchAttendance(month)
      .then((r) => current && (setRows(r.rows), setError('')))
      .catch((err) => current && setError(errorText(err)))
    return () => {
      current = false
    }
  }, [month])

  const label = months.find((m) => m.value === month)?.label ?? month

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <h2>Attendance</h2>
          <p className="card-sub" style={{ margin: 0 }}>
            From clock-ins, against each technician's work hours. Days still to come are not counted.
          </p>
        </div>
        <div className="toolbar" style={{ margin: 0 }}>
          <select value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Month">
            {months.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
          <button
            className="btn btn-ghost btn-sm"
            disabled={!rows?.length}
            onClick={() => rows && downloadTableCsv([COLUMNS.map(([name]) => name), ...rows.map((r) => COLUMNS.map(([, get]) => get(r)))], `attendance-${month}`)}
          >
            <Icon name="file-text" /> Download CSV
          </button>
        </div>
      </div>
      {error && <p className="field-error">{error}</p>}
      {rows && rows.length > 0 && (
        <div className="table-scroll">
          <table className="simple attendance-table">
            <tbody>
              <tr>
                <th>Technician</th>
                <th>Worked</th>
                <th>Missed</th>
                <th>Leave</th>
                <th>Late</th>
                <th>Left early</th>
                <th>Forgot clock-out</th>
                <th>Hours</th>
              </tr>
              {rows.map((r) => (
                <tr key={r.userId}>
                  <td>
                    <b>{r.name}</b>
                    <small>{r.specialization}</small>
                  </td>
                  <td>
                    {r.daysWorked} / {r.scheduledDays}
                  </td>
                  <td className={r.missedDays ? 'bad' : ''}>{r.missedDays}</td>
                  <td>{r.leaveDays}</td>
                  <td className={r.lateDays ? 'warn' : ''}>
                    {r.lateDays}
                    {r.lateDays > 0 && <small>{r.lateMinutes} min in total</small>}
                  </td>
                  <td className={r.earlyLeaves ? 'warn' : ''}>{r.earlyLeaves}</td>
                  <td className={r.forgotClockOut ? 'warn' : ''}>{r.forgotClockOut}</td>
                  <td>{r.hoursWorked}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {rows && !rows.length && <EmptyState icon="users" title="No technicians" sub={`Nothing to show for ${label}.`} />}
    </div>
  )
}
