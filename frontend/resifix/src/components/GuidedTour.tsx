import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { Icon } from './Icon'
import { useApp } from '../context/appContext'
import { markTourSeen } from '../tourSeen'
import type { Role } from '../types'

// A short guided tour for people new to ResiFix. It starts by itself the first time someone logs in,
// and the "?" button in the top bar replays it. Each step can open a page and highlight one thing
// on it (marked in the page with data-tour="..."); steps without a target show as a centred card.

interface TourStep {
  title: string
  text: string
  // data-tour names to highlight; the first one on screen is used.
  target?: string[]
  // The page to open before showing this step.
  tab?: string
}

interface Finish {
  label: string
  tab: string
}

const TOURS: Record<Role, { steps: TourStep[]; finish: Finish }> = {
  student: {
    steps: [
      {
        title: 'Welcome to ResiFix',
        text: 'Something broken in your room or residence? This one-minute tour shows you how to report it and follow it until it is fixed.',
      },
      {
        title: 'Your home page',
        text: 'See how your reports are doing at a glance, and anything waiting for you, such as confirming a fix.',
        target: ['nav-overview'],
        tab: 'overview',
      },
      {
        title: 'Report a problem',
        text: 'Whenever something is broken, leaking or not working, start here, or use Report an Issue in the menu.',
        target: ['report-cta', 'nav-report'],
        tab: 'overview',
      },
      {
        title: 'Two easy ways to report',
        text: 'Ask the assistant: describe the problem in your own words and it writes the report for you. Or fill in the short form yourself. Either way, it goes to the right technician.',
        target: ['report-mode', 'report-card'],
        tab: 'report',
      },
      {
        title: 'Follow your reports',
        text: 'Every report gets a reference number. Tap one to see its progress. Once a technician is assigned, you can chat or call them from the report.',
        target: ['recent-reports'],
        tab: 'overview',
      },
      {
        title: 'Stay in the loop',
        text: 'The bell tells you when your report is assigned, being worked on and fixed. When it is fixed, confirm it so the report can close.',
        target: ['bell'],
      },
      {
        title: 'Need this again?',
        text: 'Tap this button any time to replay the tour.',
        target: ['help'],
      },
    ],
    finish: { label: 'Report my first issue', tab: 'report' },
  },
  maintenance: {
    steps: [
      {
        title: 'Welcome to ResiFix',
        text: 'This quick tour shows how jobs reach you and how to keep students updated.',
      },
      {
        title: 'Your jobs',
        text: 'New jobs arrive here automatically. The system picks the right technician for each problem. Open a job to see the details, the photo and any notes from the assistant, then mark it In progress or Resolved.',
        target: ['nav-assigned'],
        tab: 'assigned',
      },
      {
        title: 'Talk to the student',
        text: 'Each job has a chat and a call button, so you can ask about access or details before you go.',
        target: ['nav-assigned'],
      },
      {
        title: 'Completed jobs',
        text: 'Jobs you have resolved. The student confirms the fix and can rate it.',
        target: ['nav-completed'],
      },
      {
        title: 'Parts store',
        text: 'Need a new stove plate, tap or bulb? See what is in the store room and where it is kept, then tap Take and pick the job it is for. If something is running low, ask the staff manager for more.',
        target: ['parts-list', 'nav-parts'],
        tab: 'parts',
      },
      {
        title: 'Your work summary',
        text: 'See how many jobs you have handled over a period.',
        target: ['nav-reports'],
      },
      {
        title: 'Notifications',
        text: 'New jobs, messages and missed calls show up here.',
        target: ['bell'],
      },
      {
        title: 'Need this again?',
        text: 'Tap this button any time to replay the tour.',
        target: ['help'],
      },
    ],
    finish: { label: 'Go to my jobs', tab: 'assigned' },
  },
  admin: {
    steps: [
      {
        title: 'Welcome, staff manager',
        text: 'You oversee every report in the residence. Reports are assigned to technicians automatically or by the supervisor.',
      },
      {
        title: 'Home',
        text: 'A live overview of new, urgent and overdue reports, so you can see what needs attention first.',
        target: ['nav-overview'],
        tab: 'overview',
      },
      {
        title: 'All issues',
        text: 'Every report and who is working on it. Open one to mark it received or read its history.',
        target: ['nav-issues'],
      },
      {
        title: 'Parts store',
        text: 'Every spare part in the store room, who took what and for which job. You are notified when something runs low; tap Restock when new stock arrives, or Add part for something new.',
        target: ['parts-list', 'nav-parts'],
        tab: 'parts',
      },
      {
        title: 'Reports',
        text: 'Summaries for any period, which you can download as a spreadsheet.',
        target: ['nav-reports'],
      },
      {
        title: 'Notifications',
        text: 'New and urgent reports, fixes and re-opened jobs show up here.',
        target: ['bell'],
      },
      {
        title: 'Need this again?',
        text: 'Tap this button any time to replay the tour.',
        target: ['help'],
      },
    ],
    finish: { label: 'See all issues', tab: 'issues' },
  },
  sysadmin: {
    steps: [
      {
        title: 'Welcome, administrator',
        text: 'You look after accounts and how the system works.',
      },
      {
        title: 'Users',
        text: 'Create staff manager, supervisor and maintenance accounts and set each technician’s job. Students sign up themselves.',
        target: ['nav-users'],
        tab: 'users',
      },
      {
        title: 'Categories',
        text: 'The kinds of problems students can choose from when they report.',
        target: ['nav-categories'],
      },
      {
        title: 'Settings',
        text: 'Turn system rules on or off, such as notifying students on every status change.',
        target: ['nav-settings'],
      },
      {
        title: 'Need this again?',
        text: 'Tap this button any time to replay the tour.',
        target: ['help'],
      },
    ],
    finish: { label: 'Manage users', tab: 'users' },
  },
  supervisor: {
    steps: [
      {
        title: 'Welcome, supervisor',
        text: 'You give jobs to technicians and make sure someone takes them. Most reports are assigned automatically; you step in when they are not.',
      },
      {
        title: 'Home',
        text: 'Reports that need you first: jobs nobody accepted, unassigned reports and anything overdue. Assign or reassign them from here.',
        target: ['nav-overview'],
        tab: 'overview',
      },
      {
        title: 'All issues',
        text: 'Every report. Open one to assign or reassign a technician, or change its priority.',
        target: ['nav-issues'],
      },
      {
        title: 'Assignments',
        text: 'Who is doing each job, whether the system or you assigned it, and whether they accepted it. If someone has not accepted after 2 minutes, phone them and tap “Accepted by phone”.',
        target: ['nav-assignments'],
      },
      {
        title: 'Team availability',
        text: 'Clock a technician in or out, or start and end their break, for them — for example someone without a phone. They are notified and it is recorded that you did it.',
        target: ['nav-availability'],
      },
      {
        title: 'Need this again?',
        text: 'Tap this button any time to replay the tour.',
        target: ['help'],
      },
    ],
    finish: { label: 'See what needs attention', tab: 'overview' },
  },
}

// The first target that is actually on screen (the menu is hidden off-screen on phones).
function findTarget(names: string[] | undefined): HTMLElement | null {
  for (const name of names ?? []) {
    const el = document.querySelector<HTMLElement>(`[data-tour="${name}"]`)
    if (!el) continue
    const r = el.getBoundingClientRect()
    if (r.width > 0 && r.height > 0 && r.right > 0 && r.left < window.innerWidth) return el
  }
  return null
}

const PAD = 6
const CARD_WIDTH = 340
// Roughly how tall the card is; enough to decide whether it fits above or below the highlight.
const CARD_HEIGHT = 250
const GAP = 14

// Where the card goes: beside a target in the side menu, otherwise below it or above it. When the
// highlighted part is too tall for either, the card sits at the bottom of the screen over it.
function cardPosition(rect: DOMRect | null): CSSProperties {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const width = Math.min(CARD_WIDTH, vw - 32)
  if (!rect) return { width, left: (vw - width) / 2, top: Math.max(16, vh / 2 - CARD_HEIGHT / 2) }
  const left = Math.max(16, Math.min(rect.left + rect.width / 2 - width / 2, vw - width - 16))
  if (rect.right < 300 && vw - rect.right > width + 40) {
    return { width, left: rect.right + PAD + GAP, top: Math.max(16, Math.min(rect.top - 8, vh - CARD_HEIGHT - 16)) }
  }
  const needed = CARD_HEIGHT + PAD + GAP
  if (vh - rect.bottom >= needed) return { width, left, top: rect.bottom + PAD + GAP }
  if (rect.top >= needed) return { width, left, bottom: vh - rect.top + PAD + GAP }
  return { width, left, bottom: 16 }
}

export function GuidedTour({ onClose }: { onClose: () => void }) {
  const { auth, tabs, setTab, modal } = useApp()
  const role = auth.role as Role
  const { steps, finish } = TOURS[role]
  const [index, setIndex] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const startTab = useRef(tabs[role])
  const nextRef = useRef<HTMLButtonElement>(null)
  const step = steps[index]
  const last = index === steps.length - 1
  const firstName = auth.name?.split(' ')[0]

  // Open the step's page, then wait for its target to appear and scroll it into view.
  useEffect(() => {
    if (step.tab) setTab(step.tab)
    let tries = 0
    let timer = 0
    const look = () => {
      const el = findTarget(step.target)
      if (el) {
        // Tall parts scroll to the top of the screen so their start is in view under the card.
        const tall = el.getBoundingClientRect().height > window.innerHeight * 0.45
        el.scrollIntoView({ block: tall ? 'start' : 'center', behavior: 'smooth' })
        timer = window.setTimeout(() => setRect(el.getBoundingClientRect()), 250)
      } else if (step.target && tries++ < 15) {
        timer = window.setTimeout(look, 80)
      } else {
        setRect(null)
      }
    }
    look()
    return () => window.clearTimeout(timer)
    // setTab changes on every render of the app; only a new step should re-run this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index])

  // Keep the highlight on its target when the window is resized or the page scrolls.
  useLayoutEffect(() => {
    const update = () => {
      const el = findTarget(step.target)
      setRect(el ? el.getBoundingClientRect() : null)
    }
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [step])

  useEffect(() => {
    nextRef.current?.focus()
  }, [index])

  const close = useCallback(
    (goTo?: string) => {
      markTourSeen(auth.userId)
      setTab(goTo ?? startTab.current)
      onClose()
    },
    [auth.userId, onClose, setTab],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
      else if (e.key === 'ArrowRight' && !last) setIndex((i) => i + 1)
      else if (e.key === 'ArrowLeft' && index > 0) setIndex((i) => i - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [close, index, last])

  // Let a pop-up (an incoming reminder, say) be dealt with first; the tour carries on after.
  if (modal) return null

  const title = index === 0 && firstName ? `${step.title}, ${firstName}!` : step.title
  const spot: CSSProperties | undefined = rect
    ? { top: rect.top - PAD, left: rect.left - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2 }
    : undefined

  return (
    <div className="tour" role="dialog" aria-modal="true" aria-labelledby="tour-title" aria-describedby="tour-text">
      {spot ? <div className="tour-spot" style={spot} /> : <div className="tour-dim" />}
      <div className={'tour-card' + (rect ? '' : ' centred')} style={cardPosition(rect)} key={index}>
        <div className="tour-top">
          <span className="tour-count">
            {index + 1} of {steps.length}
          </span>
          <button className="tour-skip" onClick={() => close()}>
            Skip tour
          </button>
        </div>
        <h3 id="tour-title">{title}</h3>
        <p id="tour-text">{step.text}</p>
        <div className="tour-dots" aria-hidden="true">
          {steps.map((s, i) => (
            <span key={s.title + i} className={i === index ? 'on' : i < index ? 'done' : ''} />
          ))}
        </div>
        <div className="tour-actions">
          {index > 0 && (
            <button className="btn btn-ghost btn-sm" onClick={() => setIndex(index - 1)}>
              Back
            </button>
          )}
          {last ? (
            <>
              <button className="btn btn-ghost btn-sm" onClick={() => close()}>
                Finish
              </button>
              <button ref={nextRef} className="btn btn-primary btn-sm" onClick={() => close(finish.tab)}>
                {finish.label} <Icon name="arrow-right" />
              </button>
            </>
          ) : (
            <button ref={nextRef} className="btn btn-primary btn-sm" onClick={() => setIndex(index + 1)}>
              {index === 0 ? 'Show me around' : 'Next'} <Icon name="arrow-right" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
