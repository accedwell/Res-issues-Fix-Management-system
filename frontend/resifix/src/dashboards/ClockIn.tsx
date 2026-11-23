import { useCallback, useEffect, useState } from 'react'
import { apiSetTeamHours, fetchSchedules, fetchShiftsToday } from '../api'
import { EmptyState } from '../components/common'
import { Icon } from '../components/Icon'
import { useApp } from '../context/appContext'
import { describeHours, span } from '../dutyUtils'
import { formatTime } from '../utils'
import { HoursEditor, LeaveCard, ScheduleModal } from './dutyParts'
import type { DutyShift, DutySchedules, Staff, WorkHours } from '../types'

// The staff manager's clock-in page. Technicians clock in from their own "Assigned to Me" page. This
// page shows who is in, sets work hours and leave, and lists today's clock-ins with who was late or
// left early.

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
      <div>
        <TeamCard plan={plan} edit={setEditing} />
        <TodayCard shifts={shifts} />
      </div>

      <div>
        {plan && <TeamHoursCard key={describeHours(plan.team)} team={plan.team} changed={changed} />}
        {plan && <LeaveCard leave={plan.leave} names={names} changed={changed} />}
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
