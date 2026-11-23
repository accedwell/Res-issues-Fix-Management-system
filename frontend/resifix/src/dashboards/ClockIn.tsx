import { useCallback, useEffect, useState } from 'react'
import { apiRenewClockInCode, apiSetCodeMode, apiSetTeamHours, fetchSchedules, fetchShiftsToday } from '../api'
import { EmptyState } from '../components/common'
import { Icon } from '../components/Icon'
import { useApp } from '../context/appContext'
import { describeHours, span } from '../dutyUtils'
import { openReport } from '../periodReport'
import { isLocalOnly, useClockCode, useQrImage } from '../useClockCode'
import { formatDate, formatTime } from '../utils'
import { HoursEditor, LeaveCard, ScheduleModal, WallScreen } from './dutyParts'
import type { DutyShift, DutySchedules, Staff, WorkHours } from '../types'

// The staff manager's clock-in page. Technicians clock in with the QR code at the maintenance office,
// which proves they are at work. The code is either printed (a new one every day) or shown on a
// wall screen (a new one every 30 seconds). The page also shows who is in, sets work hours and leave,
// and lists today's clock-ins with who was late or left early.

export function ClockIn() {
  const { staff } = useApp()
  const [shifts, setShifts] = useState<DutyShift[]>([])
  const [plan, setPlan] = useState<DutySchedules | null>(null)
  const [editing, setEditing] = useState<Staff | null>(null)
  // Bumped after a change here, to load the hours and leave again.
  const [version, setVersion] = useState(0)
  const changed = useCallback(() => setVersion((v) => v + 1), [])

  // Reloads when anyone clocks in or out (the staff list changes) or after a change here.
  useEffect(() => {
    fetchShiftsToday()
      .then(setShifts)
      .catch(() => undefined)
    fetchSchedules()
      .then(setPlan)
      .catch(() => undefined)
  }, [staff, version])

  const names = new Map(staff.map((s) => [s.id, s.name]))
  const editingPlan = editing && plan?.people.find((p) => p.userId === editing.id)

  return (
    <div className="clockin-grid">
      <CodeCard />

      <div>
        <TeamCard plan={plan} edit={setEditing} />
        {plan && <TeamHoursCard key={describeHours(plan.team)} team={plan.team} changed={changed} />}
        {plan && <LeaveCard leave={plan.leave} names={names} changed={changed} />}
        <TodayCard shifts={shifts} />
      </div>

      {editing && plan && editingPlan && (
        <ScheduleModal
          tech={editing}
          schedule={editingPlan.schedule}
          team={plan.team}
          leave={plan.leave}
          close={() => setEditing(null)}
          changed={changed}
        />
      )}
    </div>
  )
}

// ===== The code: printed daily, or a wall screen =====
function CodeCard() {
  const { code, error, reload } = useClockCode()
  const qr = useQrImage(code?.code)
  const [busy, setBusy] = useState(false)
  const [wall, setWall] = useState(false)
  const closeWall = useCallback(() => setWall(false), [])
  const rotating = code?.mode === 'rotating'

  const act = async (action: () => Promise<unknown>) => {
    setBusy(true)
    await action().catch(() => undefined)
    reload()
    setBusy(false)
  }

  const renew = () => {
    const warning = rotating
      ? 'Make new codes? Any code someone photographed in the last two minutes stops working.'
      : 'Make a new code? The printed QR code stops working, so print the new one and put it up.'
    if (window.confirm(warning)) void act(apiRenewClockInCode)
  }

  const print = () => {
    if (!code || !qr) return
    const day = formatDate(code.day)
    openReport(
      `<!doctype html><html><head><meta charset="utf-8"><title>ResiFix clock-in ${day}</title>
      <style>body{font-family:Segoe UI,Arial,sans-serif;text-align:center;color:#0b1f47;margin:48px}
      h1{font-size:34px;margin:0 0 8px}p{font-size:18px;margin:6px 0}img{width:380px;height:380px;margin:24px 0 12px}
      .code{font-size:40px;font-weight:800;letter-spacing:.3em;margin:8px 0 18px}.small{font-size:14px;color:#55607a}</style>
      </head><body>
      <h1>Maintenance clock-in</h1>
      <p>Scan with your phone when you arrive. Log in if asked.</p>
      <img src="${qr}" alt="Clock-in QR code">
      <p class="small">Can't scan? Type this code in ResiFix:</p>
      <div class="code">${code.code}</div>
      <p class="small">Valid on ${day} only. A new code is made every day.</p>
      </body></html>`,
      true,
    )
  }

  return (
    <div className="card clockin-qr">
      <h2>Clock-in QR code</h2>
      <div className="mode-switch" role="group" aria-label="How the code is shown">
        <button className={!rotating ? 'on' : ''} disabled={busy || !code} onClick={() => rotating && void act(() => apiSetCodeMode('daily'))}>
          Printed (daily)
        </button>
        <button className={rotating ? 'on' : ''} disabled={busy || !code} onClick={() => !rotating && void act(() => apiSetCodeMode('rotating'))}>
          Wall screen (30 s)
        </button>
      </div>
      <p className="card-sub">
        {rotating
          ? 'Show it on a tablet or old phone at the maintenance office. The code changes every 30 seconds, so a photo of it is useless. Nothing to print.'
          : 'Print it and put it up at the maintenance office. A new code is made every morning, so print the new one each day.'}
      </p>
      {error && <p className="field-error">{error}</p>}
      {isLocalOnly() && (
        <p className="clockin-warning">
          <Icon name="flag" /> This page is open on <b>localhost</b>, so phones can't open this QR code. Open ResiFix at your computer's
          network address (like http://192.168.0.238:5173) and the QR code will use that address.
        </p>
      )}
      <div className="qr-box">{qr ? <img src={qr} alt="Clock-in QR code" /> : <span>Loading…</span>}</div>
      {code && (
        <>
          <div className="qr-code-text" aria-label="Clock-in code">
            {code.code}
          </div>
          <p className="field-hint">{rotating ? 'Changes every 30 seconds.' : `Valid today (${formatDate(code.day)}).`}</p>
        </>
      )}
      <div className="clockin-actions">
        {rotating ? (
          <button className="btn btn-primary btn-sm" onClick={() => setWall(true)} disabled={!code}>
            <Icon name="eye" /> Open wall screen
          </button>
        ) : (
          <button className="btn btn-primary btn-sm" onClick={print} disabled={!qr}>
            <Icon name="file-text" /> Print
          </button>
        )}
        <button className="btn btn-ghost btn-sm" onClick={renew} disabled={busy || !code}>
          <Icon name="refresh" /> New code now
        </button>
      </div>
      {wall && <WallScreen close={closeWall} />}
    </div>
  )
}

// ===== Who is in right now =====
function statusOf(s: Staff): { label: string; kind: string } {
  if (s.onBreak && s.breakUntil) return { label: `On break until ${formatTime(s.breakUntil)}`, kind: 'break' }
  if (s.onDuty && s.onDutySince) return { label: `On duty since ${formatTime(s.onDutySince)}`, kind: 'on' }
  if (s.onLeaveToday) return { label: 'On leave', kind: 'leave' }
  return { label: 'Off duty', kind: 'off' }
}

const ORDER: Record<string, number> = { on: 0, break: 1, off: 2, leave: 3 }

function TeamCard({ plan, edit }: { plan: DutySchedules | null; edit: (s: Staff) => void }) {
  const { staff } = useApp()
  const team = [...staff].sort((a, b) => ORDER[statusOf(a).kind] - ORDER[statusOf(b).kind] || a.name.localeCompare(b.name))
  const available = staff.filter((s) => s.available).length

  return (
    <div className="card">
      <h2>Team right now</h2>
      <p className="card-sub">
        {available} of {staff.length} technician(s) available for new jobs.
        {!available && staff.length > 0 && ' New reports wait until someone clocks in. Urgent ones alert you.'}
      </p>
      {team.length ? (
        <ul className="list-plain duty-list">
          {team.map((s) => {
            const status = statusOf(s)
            const schedule = plan?.people.find((p) => p.userId === s.id)?.schedule
            return (
              <li key={s.id}>
                <span className="duty-who">
                  <b>{s.name}</b>
                  <span>
                    {s.specialization} · {s.openJobs} open job(s)
                    {schedule && ` · ${describeHours(schedule)}${schedule.custom ? '' : ' (team)'}`}
                  </span>
                </span>
                <span className="duty-row-end">
                  <span className={'duty-pill ' + status.kind}>{status.label}</span>
                  <button className="btn btn-ghost btn-sm" onClick={() => edit(s)} disabled={!plan}>
                    <Icon name="clock" /> Schedule
                  </button>
                </span>
              </li>
            )
          })}
        </ul>
      ) : (
        <EmptyState icon="users" title="No maintenance staff yet" sub="The system administrator adds technicians." />
      )}
    </div>
  )
}

// ===== The team's usual hours =====
function TeamHoursCard({ team, changed }: { team: WorkHours; changed: () => void }) {
  const [form, setForm] = useState(team)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const dirty = describeHours(form) !== describeHours(team)

  const save = async () => {
    setBusy(true)
    setError('')
    try {
      await apiSetTeamHours(form)
      changed()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save')
      setBusy(false)
    }
  }

  return (
    <div className="card">
      <h2>Team work hours</h2>
      <p className="card-sub">
        Everyone follows these unless they have their own hours (Schedule button). They decide who is late, leaves early, or hasn't clocked in:
        you get a pop-up 15 minutes after the start for anyone missing.
      </p>
      <HoursEditor value={form} onChange={setForm} />
      <div className="modal-actions" style={{ marginTop: 10, justifyContent: 'flex-start' }}>
        <button className="btn btn-primary btn-sm" onClick={save} disabled={busy || !dirty}>
          {busy ? 'Saving…' : 'Save'}
        </button>
      </div>
      {error && <p className="field-error">{error}</p>}
    </div>
  )
}

// ===== Today's clock-ins =====
function TodayCard({ shifts }: { shifts: DutyShift[] }) {
  return (
    <div className="card">
      <h2>Clock-ins today</h2>
      {shifts.length ? (
        <ul className="list-plain duty-list">
          {shifts.map((s) => (
            <li key={s.id}>
              <b>{s.name}</b>
              <span className="timing-tags">
                {s.lateMinutes === null ? (
                  <span className="timing-tag info">Not a work day</span>
                ) : s.lateMinutes > 0 ? (
                  <span className="timing-tag late">Late {span(s.lateMinutes)}</span>
                ) : (
                  <span className="timing-tag ok">On time</span>
                )}
                {!!s.earlyMinutes && <span className="timing-tag late">Left early {span(s.earlyMinutes)}</span>}
                {s.autoClosed && <span className="timing-tag late">Forgot to clock out</span>}
                {s.onBreak && <span className="timing-tag info">On break</span>}
              </span>
              <span className="duty-times">
                In {formatTime(s.clockInAt)}
                {s.clockedInBy ? ` (by ${s.clockedInBy})` : ''} ·{' '}
                {s.clockOutAt
                  ? `Out ${formatTime(s.clockOutAt)}${s.autoClosed ? ' (by the system)' : s.clockedOutBy ? ` (by ${s.clockedOutBy})` : ''}`
                  : 'still on duty'}
                {s.breakMinutes > 0 && ` · breaks ${span(s.breakMinutes)}`}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="card-sub">Nobody has clocked in today yet.</p>
      )}
    </div>
  )
}
