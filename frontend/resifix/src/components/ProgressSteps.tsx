import { Icon } from './Icon'
import type { Issue, Status } from '../types'

const STEPS = ['Reported', 'Assigned', 'In progress', 'Fixed']

// Which step each status has reached.
const STEP_OF: Record<Status, number> = {
  Submitted: 0,
  Received: 0,
  Assigned: 1,
  'In Progress': 2,
  'Not Resolved': 2,
  Resolved: 3,
  Closed: 3,
}

// Reported → Assigned → In progress → Fixed, with the current step highlighted.
export function ProgressSteps({ issue }: { issue: Issue }) {
  const current = STEP_OF[issue.status]
  const finished = issue.status === 'Closed' || issue.status === 'Resolved'
  const stuck = issue.status === 'Not Resolved'

  return (
    <ol className="progress-steps" style={{ ['--done' as string]: current / (STEPS.length - 1) }} aria-label={`Progress: ${issue.status}`}>
      {STEPS.map((label, i) => {
        const state = i < current || finished ? 'done' : i === current ? (stuck ? 'stuck' : 'now') : ''
        return (
          <li key={label} className={state} aria-current={i === current ? 'step' : undefined}>
            <span className="progress-dot">
              {state === 'done' ? <Icon name="check" /> : state === 'stuck' ? <Icon name="x" /> : null}
            </span>
            {state === 'stuck' ? 'Not resolved' : label}
          </li>
        )
      })}
    </ol>
  )
}
