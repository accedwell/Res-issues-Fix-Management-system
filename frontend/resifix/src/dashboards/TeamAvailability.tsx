import { useState } from 'react'
import { EmptyState } from '../components/common'
import { HandOver } from '../components/DutyCard'
import { Icon } from '../components/Icon'
import { useApp } from '../context/appContext'
import { formatTime, initials, isOpen, telHref } from '../utils'
import type { Staff } from '../types'

// The supervisor and the system admin can update a technician's availability for them, for example
// someone without a phone who cannot clock in themselves: clock in, start or end a break, and
// clock out (handing back any jobs they cannot finish). Each change is recorded with who made it,
// the staff manager is told, and the technician gets a notification.

const BREAK_MINUTES = [15, 30, 45, 60]

function statusOf(s: Staff): { label: string; tone: 'ok' | 'info' | 'off' } {
  if (s.onBreak) return { label: `On break${s.breakUntil ? ` until ${formatTime(s.breakUntil)}` : ''}`, tone: 'info' }
  if (s.onDuty) return { label: `On duty${s.onDutySince ? ` since ${formatTime(s.onDutySince)}` : ''}`, tone: 'ok' }
  if (s.onLeaveToday) return { label: 'On leave today', tone: 'off' }
  return { label: 'Off duty', tone: 'off' }
}

function TechRow({ tech }: { tech: Staff }) {
  const { issues, updateAvailability } = useApp()
  const [busy, setBusy] = useState(false)
  const [minutes, setMinutes] = useState(BREAK_MINUTES[0])
  const [handingOver, setHandingOver] = useState(false)
  const status = statusOf(tech)
  const openJobs = issues.filter((i) => i.assignedTo === tech.id && isOpen(i))

  const run = async (action: Parameters<typeof updateAvailability>[1], extra?: { minutes?: number; handBack?: string[] }) => {
    setBusy(true)
    await updateAvailability(tech, action, extra)
    setBusy(false)
    setHandingOver(false)
  }

  return (
    <li className="avail-row">
      <span className="team-av">{initials(tech.name)}</span>
      <span className="avail-main">
        <b>{tech.name}</b>
        <span className="team-spec">
          {tech.specialization} · {openJobs.length} open job(s)
          {tech.phone ? (
            <>
              {' · '}
              <a className="phone-link" href={telHref(tech.phone)}>
                {tech.phone}
              </a>
            </>
          ) : (
            ' · no phone number saved'
          )}
        </span>
        <span className={'avail-status ' + status.tone}>
          <span className="dot" /> {status.label}
          {tech.onDuty && tech.clockedInBy && <small> · clocked in by {tech.clockedInBy}</small>}
        </span>
      </span>
      <span className="avail-actions">
        {!tech.onDuty ? (
          <button className="btn btn-primary btn-sm" disabled={busy || tech.onLeaveToday} onClick={() => run('clockIn')}>
            <Icon name="check" /> {busy ? 'Saving…' : 'Clock in'}
          </button>
        ) : (
          <>
            {tech.onBreak ? (
              <button className="btn btn-navy btn-sm" disabled={busy} onClick={() => run('endBreak')}>
                {busy ? 'Saving…' : 'End break'}
              </button>
            ) : (
              <span className="avail-break">
                <select value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} aria-label={`Break length for ${tech.name}`}>
                  {BREAK_MINUTES.map((m) => (
                    <option key={m} value={m}>
                      {m} min
                    </option>
                  ))}
                </select>
                <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => run('startBreak', { minutes })}>
                  <Icon name="clock" /> Start break
                </button>
              </span>
            )}
            <button
              className="btn btn-danger-ghost btn-sm"
              disabled={busy}
              onClick={() => (openJobs.length ? setHandingOver(true) : run('clockOut', { handBack: [] }))}
            >
              <Icon name="logout" /> Clock out
            </button>
          </>
        )}
      </span>
      {handingOver && (
        <HandOver
          who={tech.name}
          jobs={openJobs}
          busy={busy}
          close={() => setHandingOver(false)}
          confirm={(ids) => run('clockOut', { handBack: ids })}
        />
      )}
    </li>
  )
}

export function TeamAvailability() {
  const { staff } = useApp()
  const onDuty = staff.filter((s) => s.onDuty && !s.onBreak).length
  const rows = [...staff].sort((a, b) => Number(b.onDuty) - Number(a.onDuty) || a.name.localeCompare(b.name))

  return (
    <div className="card">
      <div className="card-head">
        <h2>Team availability</h2>
        <span className="hotspot-note">{onDuty} available for new jobs</span>
      </div>
      <p className="card-sub">
        Update a technician’s availability for them, for example someone without a phone who cannot clock in themselves. They get a
        notification, the staff manager is told, and the record shows you made the change. Only technicians on duty and not on a break get new
        jobs.
      </p>
      {rows.length ? (
        <ul className="avail-list">
          {rows.map((tech) => (
            <TechRow key={tech.id} tech={tech} />
          ))}
        </ul>
      ) : (
        <EmptyState icon="users" title="No maintenance staff yet" sub="The system administrator can add staff accounts." />
      )}
    </div>
  )
}
