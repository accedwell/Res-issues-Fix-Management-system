import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from './Icon'
import { useApp } from '../context/appContext'
import { describeHours, leaveSpan, todayLocal } from '../dutyUtils'
import { formatTime, isOpen } from '../utils'
import type { Issue } from '../types'

// The technician's clock-in card at the top of "Assigned to Me". New jobs only come to technicians
// who are on duty and not on a break.
//  - Off duty: "Clock in" when they start work.
//  - On duty: take a break, or clock out (handing unfinished jobs back if they want).
//  - On a break: "I'm back" (the break also ends by itself when the time is up).
export function DutyCard() {
  const { duty, issues, clockIn, clockOut, startBreak, endBreak } = useApp()
  const [choosingBreak, setChoosingBreak] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [busy, setBusy] = useState(false)
  if (!duty) return null

  const run = async (action: () => Promise<boolean>) => {
    setBusy(true)
    if (await action()) {
      setChoosingBreak(false)
      setLeaving(false)
    }
    setBusy(false)
  }

  const openJobs = issues.filter(isOpen)
  const hours = (
    <span className="duty-hours">
      <Icon name="clock" /> Your hours: {describeHours(duty.schedule)}
      {duty.leave
        .filter((l) => l.startDate > todayLocal())
        .slice(0, 1)
        .map((l) => (
          <span key={l.id}> · Leave {leaveSpan(l.startDate, l.endDate)}</span>
        ))}
    </span>
  )

  // ===== On a break =====
  if (duty.onDuty && duty.onBreak && duty.breakUntil) {
    return (
      <div className="card duty-card break">
        <span className="duty-dot" aria-hidden />
        <div className="duty-text">
          <b>On a break until {formatTime(duty.breakUntil)}</b>
          <span>No new jobs come to you until then. You are back by yourself when the time is up.</span>
          {hours}
          <div className="duty-options">
            <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => void run(endBreak)}>
              <Icon name="check" /> {busy ? 'Saving…' : "I'm back"}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ===== On duty =====
  if (duty.onDuty && duty.since) {
    return (
      <div className="card duty-card on">
        <span className="duty-dot" aria-hidden />
        <div className="duty-text">
          <b>On duty since {formatTime(duty.since)}</b>
          <span>New jobs come to you. If you forget to clock out, it happens by itself after {duty.maxHours} hours.</span>
          {hours}
          <div className="duty-options">
            <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => setChoosingBreak((v) => !v)}>
              <Icon name="clock" /> Take a break
            </button>
            <button
              className="btn btn-ghost btn-sm"
              disabled={busy}
              onClick={() => {
                if (openJobs.length) setLeaving(true)
                else if (window.confirm('Clock out? No new jobs will come to you.')) void run(() => clockOut([]))
              }}
            >
              <Icon name="logout" /> {busy ? 'Saving…' : 'Clock out'}
            </button>
          </div>
          {choosingBreak && (
            <div className="break-choices">
              <span>How long?</span>
              {duty.breakOptions.map((m) => (
                <button key={m} className="btn btn-ghost btn-sm" disabled={busy} onClick={() => void run(() => startBreak(m))}>
                  {m} min
                </button>
              ))}
            </div>
          )}
        </div>
        {leaving && <HandOver jobs={openJobs} busy={busy} close={() => setLeaving(false)} confirm={(ids) => void run(() => clockOut(ids))} />}
      </div>
    )
  }

  // ===== On leave today =====
  if (duty.onLeaveToday) {
    const today = duty.leave.find((l) => l.startDate <= todayLocal() && l.endDate >= todayLocal())
    return (
      <div className="card duty-card leave">
        <span className="duty-dot" aria-hidden />
        <div className="duty-text">
          <b>You are on leave{today ? ` (${leaveSpan(today.startDate, today.endDate)})` : ''}</b>
          <span>
            {today?.reason ? `${today.reason}. ` : ''}No new jobs come to you. If you are working after all, ask the staff manager to remove
            the leave, then clock in.
          </span>
          {hours}
        </div>
      </div>
    )
  }

  // ===== Off duty =====
  return (
    <div className="card duty-card off">
      <span className="duty-dot" aria-hidden />
      <div className="duty-text">
        <b>You are off duty</b>
        <span>No new jobs come to you. Clock in when you start work.</span>
        {hours}
        <div className="duty-options">
          <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => void run(clockIn)}>
            <Icon name="check" /> {busy ? 'Saving…' : 'Clock in'}
          </button>
        </div>
      </div>
    </div>
  )
}

// Clocking out with jobs still open: pick any to hand back, so someone still at work can take them.
// Urgent ones are ticked to start with.
// who: the technician's name when the supervisor or system admin is clocking them out.
export function HandOver({
  jobs,
  busy,
  close,
  confirm,
  who,
}: {
  jobs: Issue[]
  busy: boolean
  close: () => void
  confirm: (ids: string[]) => void
  who?: string
}) {
  const [picked, setPicked] = useState(() => new Set(jobs.filter((j) => j.priority === 'Urgent').map((j) => j.id)))
  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return createPortal(
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && close()}>
      <div className="modal">
        <h3>{who ? `Clock out ${who}` : 'Clock out'}</h3>
        <p className="modal-sub">
          {who
            ? `${who} still has ${jobs.length} open job(s). Tick any to hand back so someone else can do them today. The rest stay with ${who}.`
            : `You still have ${jobs.length} open job(s). Tick any you want to hand back so someone else can do them today. The rest stay yours.`}
        </p>
        <ul className="handover-list">
          {jobs.map((j) => (
            <li key={j.id}>
              <label>
                <input type="checkbox" checked={picked.has(j.id)} onChange={() => toggle(j.id)} />
                <span>
                  <b>
                    {j.ref} · {j.title}
                  </b>
                  <small>
                    {j.residence}, {j.room} · {j.status}
                    {j.priority === 'Urgent' && <span className="urgent-word"> · Urgent</span>}
                  </small>
                </span>
              </label>
            </li>
          ))}
        </ul>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={close}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={busy} onClick={() => confirm([...picked])}>
            <Icon name="logout" /> {busy ? 'Saving…' : picked.size ? `Hand back ${picked.size} & clock out` : 'Keep them & clock out'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
