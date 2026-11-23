import { daysTaken, lastDate } from './exportCsv'
import { BLOCKS, STATUSES } from './data/constants'
import { formatDate, isOpen, isOverdue } from './utils'
import type { Category, Issue, Priority, Status } from './types'

// A printable report of the issues reported in a chosen period (a month or custom dates).
// It opens in a new tab, where the admin can read it or save it as a PDF. Everything (styles,
// icons, charts) is inside the page, so it looks the same offline and when printed.

export interface Period {
  from: string // YYYY-MM-DD, inclusive
  to: string // YYYY-MM-DD, inclusive
  label: string // e.g. "September 2026"
  slug: string // for file names, e.g. "2026-09"
  // What kind of report it is, for its title ("Weekly Maintenance Report").
  kind?: 'week' | 'month' | 'custom'
}

// A whole calendar month, given as YYYY-MM.
export function monthPeriod(month: string): Period {
  const [year, m] = month.split('-').map(Number)
  const lastDay = new Date(Date.UTC(year, m, 0)).getUTCDate()
  const label = new Date(Date.UTC(year, m - 1, 1)).toLocaleDateString(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' })
  return { from: `${month}-01`, to: `${month}-${String(lastDay).padStart(2, '0')}`, label, slug: month, kind: 'month' }
}

export function customPeriod(from: string, to: string): Period {
  return { from, to, label: `${formatDate(from)} – ${formatDate(to)}`, slug: `${from}_to_${to}`, kind: 'custom' }
}

// ===== Weeks (Monday to Sunday) =====

const DAY_MS = 24 * 60 * 60 * 1000
const utcDay = (day: string) => new Date(day + 'T00:00:00Z')
const dayString = (d: Date) => d.toISOString().slice(0, 10)

// The Monday of the week a day (YYYY-MM-DD) falls in.
export function mondayOf(day: string): string {
  const d = utcDay(day)
  return dayString(new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * DAY_MS))
}

// ISO week number and its year (week 1 is the week with the year's first Thursday).
function isoWeek(monday: string): { year: number; week: number } {
  const thursday = new Date(utcDay(monday).getTime() + 3 * DAY_MS)
  const year = thursday.getUTCFullYear()
  const week = Math.floor((thursday.getTime() - Date.UTC(year, 0, 1)) / (7 * DAY_MS)) + 1
  return { year, week }
}

// The week starting on a Monday (YYYY-MM-DD), e.g. "Week 47 · 16 – 22 Nov 2026".
export function weekPeriod(monday: string): Period {
  const sunday = dayString(new Date(utcDay(monday).getTime() + 6 * DAY_MS))
  const { year, week } = isoWeek(monday)
  const short = (day: string, withYear: boolean) =>
    utcDay(day).toLocaleDateString(undefined, { day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}), timeZone: 'UTC' })
  return {
    from: monday,
    to: sunday,
    label: `Week ${week} · ${short(monday, monday.slice(0, 4) !== sunday.slice(0, 4))} – ${short(sunday, true)}`,
    slug: `${year}-W${String(week).padStart(2, '0')}`,
    kind: 'week',
  }
}

// Every week from the one with the first report up to the current one, newest first.
export function reportWeeks(issues: Issue[], today: string): string[] {
  const first = mondayOf(issues.reduce((min, i) => (i.dateReported && i.dateReported < min ? i.dateReported : min), today))
  const weeks: string[] = []
  for (let monday = mondayOf(today); monday >= first && weeks.length < 260; monday = dayString(new Date(utcDay(monday).getTime() - 7 * DAY_MS))) {
    weeks.push(monday)
  }
  return weeks
}

const inPeriod = (date: string, p: Period) => !!date && date >= p.from && date <= p.to

// The issues reported during the period.
export const issuesInPeriod = (issues: Issue[], p: Period) => issues.filter((i) => inPeriod(i.dateReported, p))

// When an issue was fixed: the last time it was marked resolved, or closed if that came first.
const fixedOn = (i: Issue) => lastDate(i, 'Resolved') || lastDate(i, 'Closed')

const escape = (text: string | number) =>
  String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string)

const average = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null)
const oneDecimal = (n: number | null, unit = '') => (n === null ? '—' : n.toFixed(1) + unit)
const percent = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0)
const plural = (n: number, one: string, many = one + 's') => `${n} ${n === 1 ? one : many}`
const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('')

// ===== Look =====

// Colours for each status and priority, used for the labels and the status chart.
const STATUS_COLOR: Record<Status, string> = {
  Submitted: '#64748b',
  Received: '#2563eb',
  Assigned: '#6366f1',
  'In Progress': '#d97706',
  'Not Resolved': '#dc2626',
  Resolved: '#059669',
  Closed: '#0f766e',
}
const PRIORITY_COLOR: Record<Priority, string> = { Low: '#64748b', Normal: '#2563eb', High: '#ea580c', Urgent: '#dc2626' }
// Bar colours for categories and blocks, in turn.
const PALETTE = ['#0ea5a4', '#2563eb', '#7c3aed', '#ea580c', '#db2777', '#059669', '#ca8a04', '#0891b2']

// Small line icons (24×24, drawn with the current text colour).
const ICONS: Record<string, string> = {
  inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
  check: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  refresh: '<path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M8 16H3v5"/>',
  timer: '<path d="M10 2h4"/><path d="M12 14l3-3"/><circle cx="12" cy="14" r="8"/>',
  star: '<path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"/>',
  bulb: '<path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.74V16h8v-1.26A7 7 0 0 0 12 2z"/>',
}
const icon = (name: string) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`

const pill = (text: string, color: string) => `<span class="pill" style="--c:${color}">${escape(text)}</span>`

// ★★★★☆ for a 1–5 average.
function stars(rating: number | null): string {
  if (rating === null) return '<span class="muted">—</span>'
  const full = Math.round(rating)
  return `<span class="stars" title="${rating.toFixed(1)} out of 5">${'★'.repeat(full)}<span class="off">${'★'.repeat(5 - full)}</span></span> <b>${rating.toFixed(1)}</b>`
}

// A ring showing a percentage.
function ring(value: number, color: string): string {
  const r = 42
  const c = 2 * Math.PI * r
  return `<svg class="ring" viewBox="0 0 100 100" aria-hidden="true">
    <circle cx="50" cy="50" r="${r}" fill="none" stroke="#e6ecf5" stroke-width="10"/>
    <circle cx="50" cy="50" r="${r}" fill="none" stroke="${color}" stroke-width="10" stroke-linecap="round"
      stroke-dasharray="${((value / 100) * c).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 50 50)"/>
    <text x="50" y="50" text-anchor="middle" dominant-baseline="central" class="ring-text">${value}%</text>
  </svg>`
}

// Rows of [label, count] as horizontal bars with the share of the total, skipping empty rows.
function barChart(title: string, rows: [string, number][], colorOf: (label: string, index: number) => string): string {
  const shown = rows.filter(([, n]) => n > 0)
  if (!shown.length) return ''
  const total = shown.reduce((sum, [, n]) => sum + n, 0)
  const max = Math.max(...shown.map(([, n]) => n))
  return `<section class="panel"><h2>${escape(title)}</h2><ul class="bars">${shown
    .map(
      ([label, n], i) => `<li>
        <span class="bar-label">${escape(label)}</span>
        <span class="bar-track"><span class="bar-fill" style="width:${Math.max(4, (n / max) * 100)}%;--c:${colorOf(label, i)}"></span></span>
        <span class="bar-value"><b>${n}</b> <small>${percent(n, total)}%</small></span>
      </li>`,
    )
    .join('')}</ul></section>`
}

// ===== Report =====

// "scope" describes a search the issues were narrowed by (e.g. "Block A · Plumbing"), or is empty.
export function buildReportHtml(all: Issue[], p: Period, catInfo: (key: string) => Category, preparedBy: string, scope = ''): string {
  const issues = issuesInPeriod(all, p).sort((a, b) => a.dateReported.localeCompare(b.dateReported))
  // Fixed during the period, whenever they were reported.
  const fixed = all.filter((i) => inPeriod(fixedOn(i), p))
  const ratings = issues.flatMap((i) => (i.feedback?.rating != null ? [i.feedback.rating] : []))
  const open = issues.filter(isOpen)
  const overdue = issues.filter(isOverdue)
  const reopened = issues.filter((i) => (i.reopened ?? 0) > 0)
  const finished = issues.filter((i) => !isOpen(i))
  const avgDays = average(fixed.map(daysTaken))
  const avgRating = average(ratings)
  const fixRate = percent(finished.length, issues.length)

  const summary: { label: string; value: string | number; note: string; icon: string; color: string }[] = [
    { label: 'Reported', value: issues.length, note: 'new reports in the period', icon: 'inbox', color: '#2563eb' },
    { label: 'Fixed in this period', value: fixed.length, note: 'marked resolved or closed', icon: 'check', color: '#059669' },
    { label: 'Still open', value: open.length, note: `${percent(open.length, issues.length)}% of reports`, icon: 'clock', color: '#d97706' },
    { label: 'Overdue now', value: overdue.length, note: 'past the 24-hour follow-up', icon: 'alert', color: '#dc2626' },
    { label: 'Re-opened', value: reopened.length, note: 'student said not fixed', icon: 'refresh', color: '#7c3aed' },
    { label: 'Average time to fix', value: oneDecimal(avgDays, ' days'), note: 'from report to fixed', icon: 'timer', color: '#0e7490' },
    {
      label: 'Average rating',
      value: avgRating === null ? 'No ratings' : `${avgRating.toFixed(1)} / 5`,
      note: ratings.length ? `from ${plural(ratings.length, 'rating')}` : 'students had not rated yet',
      icon: 'star',
      color: '#ca8a04',
    },
  ]

  const categoryRows = new Map<string, number>()
  for (const i of issues) {
    const name = catInfo(i.category).name
    categoryRows.set(name, (categoryRows.get(name) ?? 0) + 1)
  }
  const byCategory = [...categoryRows.entries()].sort((a, b) => b[1] - a[1])
  const byBlock: [string, number][] = BLOCKS.map((b): [string, number] => [b, issues.filter((i) => i.residence === b).length]).sort(
    (a, b) => b[1] - a[1],
  )
  const byStatus: [string, number][] = STATUSES.map((s): [string, number] => [s, issues.filter((i) => i.status === s).length])

  // Key findings, written from the numbers.
  const findings: string[] = []
  if (issues.length) {
    findings.push(`<b>${plural(issues.length, 'issue')}</b> ${issues.length === 1 ? 'was' : 'were'} reported, and <b>${fixRate}%</b> of them are fixed.`)
    if (byCategory[0]) findings.push(`The most common problem was <b>${escape(byCategory[0][0])}</b> (${plural(byCategory[0][1], 'report')}).`)
    const busiest = byBlock.find(([, n]) => n > 0)
    if (busiest) findings.push(`<b>${escape(busiest[0])}</b> had the most reports (${busiest[1]}).`)
    if (avgDays !== null) findings.push(`Fixes took <b>${oneDecimal(avgDays, ' days')}</b> on average.`)
    if (overdue.length) findings.push(`<b class="bad">${plural(overdue.length, 'report is', 'reports are')} overdue</b> and need attention.`)
    else findings.push('<b class="good">No reports are overdue.</b>')
    if (reopened.length) findings.push(`${plural(reopened.length, 'report was', 'reports were')} re-opened by students after a fix.`)
  }

  // Per maintenance person: jobs from this period, how many they finished, and their rating.
  const staff = new Map<string, Issue[]>()
  for (const i of issues) {
    const name = i.assignedToName ?? 'Not assigned yet'
    staff.set(name, [...(staff.get(name) ?? []), i])
  }
  const staffRows = [...staff.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .map(([name, jobs]) => {
      const done = jobs.filter((i) => !isOpen(i))
      const rated = jobs.flatMap((i) => (i.feedback?.rating != null ? [i.feedback.rating] : []))
      const share = percent(done.length, jobs.length)
      const nobody = name === 'Not assigned yet'
      return `<tr>
        <td><span class="person"><span class="avatar${nobody ? ' none' : ''}">${nobody ? '?' : escape(initials(name))}</span>${escape(name)}</span></td>
        <td class="num">${jobs.length}</td>
        <td><span class="progress"><span style="width:${share}%"></span></span><small class="muted">${done.length} of ${jobs.length}</small></td>
        <td class="num">${oneDecimal(average(done.map(daysTaken)), ' d')}</td>
        <td class="num">${stars(average(rated))}</td>
      </tr>`
    })
    .join('')

  const issueRows = issues
    .map(
      (i) => `<tr${isOverdue(i) ? ' class="late"' : ''}>
        <td class="ref">${escape(i.ref)}</td>
        <td><b>${escape(i.title)}</b><small class="muted">${escape(catInfo(i.category).name)}</small></td>
        <td>${escape(i.residence)}<small class="muted">${escape(i.room)}</small></td>
        <td>${pill(i.priority, PRIORITY_COLOR[i.priority])}</td>
        <td>${pill(i.status, STATUS_COLOR[i.status])}${isOverdue(i) ? `<small class="overdue">Overdue</small>` : ''}</td>
        <td class="nowrap">${escape(formatDate(i.dateReported))}</td>
        <td>${escape(i.assignedToName ?? '—')}</td>
        <td class="num">${daysTaken(i)}</td>
      </tr>`,
    )
    .join('')

  const generated = new Date().toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
  const heading = p.kind === 'week' ? 'Weekly Maintenance Report' : p.kind === 'month' ? 'Monthly Maintenance Report' : 'Maintenance Report'
  const title = `ResiFix ${heading.toLowerCase()} – ${p.label}`
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(title)}</title>
<style>
  :root {
    color-scheme: light;
    --navy: #0b1a3a; --navy-2: #12305f; --teal: #14b8a6; --teal-dark: #0f766e;
    --ink: #0f1b33; --soft: #5b6782; --line: #e3e9f2; --paper: #ffffff; --wash: #f5f8fc;
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: #e9eef6; color: var(--ink); font: 13.5px/1.55 "Segoe UI", system-ui, -apple-system, Roboto, Arial, sans-serif; }
  .bar { position: sticky; top: 0; z-index: 5; display: flex; gap: 8px; justify-content: flex-end; padding: 12px 16px; background: var(--navy); box-shadow: 0 2px 10px rgba(0,0,0,.25); }
  .bar button { font: inherit; font-weight: 700; padding: 8px 16px; border-radius: 9px; border: 0; cursor: pointer; background: var(--teal); color: #04122b; }
  .bar button.ghost { background: transparent; color: #e6f0ff; border: 1px solid rgba(255,255,255,.3); }
  .page { max-width: 1020px; margin: 26px auto; background: var(--paper); border-radius: 18px; overflow: hidden; box-shadow: 0 24px 60px -30px rgba(11,26,58,.55); }

  /* Cover band */
  .cover { position: relative; padding: 34px 40px 30px; color: #fff; background: linear-gradient(125deg, var(--navy) 0%, var(--navy-2) 55%, #0e5e70 100%); overflow: hidden; }
  .cover::after { content: ""; position: absolute; right: -80px; top: -90px; width: 320px; height: 320px; border-radius: 50%; background: radial-gradient(circle, rgba(20,184,166,.45), transparent 70%); }
  .cover::before { content: ""; position: absolute; left: 0; right: 0; bottom: 0; height: 5px; background: linear-gradient(90deg, var(--teal), #3b82f6, #a855f7); }
  .cover-top { position: relative; z-index: 1; display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; }
  .logo { display: flex; align-items: center; gap: 10px; font-weight: 800; font-size: 15px; letter-spacing: .02em; }
  .logo-mark { width: 34px; height: 34px; border-radius: 10px; display: grid; place-items: center; background: linear-gradient(135deg, var(--teal), #3b82f6); }
  .logo-mark svg { width: 20px; height: 20px; }
  .logo small { display: block; font-weight: 600; font-size: 11px; letter-spacing: .12em; text-transform: uppercase; color: #9fe7dc; }
  .doc-type { font-size: 11px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; color: #9fb4d8; text-align: right; }
  .cover h1 { position: relative; z-index: 1; margin: 26px 0 2px; font-size: 34px; line-height: 1.1; letter-spacing: -.02em; }
  .cover .period { position: relative; z-index: 1; font-size: 18px; color: #bfe9e2; font-weight: 600; }
  .meta { position: relative; z-index: 1; display: flex; flex-wrap: wrap; gap: 10px; margin-top: 20px; }
  .meta span { padding: 6px 12px; border-radius: 999px; background: rgba(255,255,255,.1); border: 1px solid rgba(255,255,255,.18); font-size: 12px; }
  .meta b { color: #fff; }
  .scope { background: rgba(20,184,166,.25) !important; border-color: rgba(20,184,166,.6) !important; }

  .content { padding: 30px 40px 34px; }
  h2 { font-size: 15px; margin: 0 0 14px; letter-spacing: -.01em; display: flex; align-items: center; gap: 8px; }
  h2::before { content: ""; width: 4px; height: 16px; border-radius: 2px; background: var(--teal); }
  section { margin-top: 28px; }
  section:first-child { margin-top: 0; }

  /* Summary cards */
  .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
  .stat { position: relative; padding: 14px 14px 13px; border-radius: 14px; background: var(--wash); border: 1px solid var(--line); overflow: hidden; }
  .stat::before { content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 4px; background: var(--c); }
  .stat-icon { width: 30px; height: 30px; border-radius: 9px; display: grid; place-items: center; color: var(--c); background: color-mix(in srgb, var(--c) 14%, white); margin-bottom: 10px; }
  .stat-icon svg { width: 17px; height: 17px; }
  .stat b { display: block; font-size: 24px; line-height: 1.15; letter-spacing: -.02em; color: var(--ink); }
  .stat .label { display: block; font-weight: 700; font-size: 12.5px; color: var(--ink); margin-top: 2px; }
  .stat small { color: var(--soft); font-size: 11.5px; }

  /* Key findings + fix rate */
  .overview { display: grid; grid-template-columns: 1fr 230px; gap: 16px; }
  .findings { border-radius: 14px; padding: 18px 20px; background: linear-gradient(135deg, #f0fdfa, #eff6ff); border: 1px solid #cdeee8; }
  .findings h3 { margin: 0 0 10px; font-size: 13px; display: flex; align-items: center; gap: 8px; color: var(--teal-dark); text-transform: uppercase; letter-spacing: .08em; }
  .findings h3 svg { width: 17px; height: 17px; }
  .findings ul { margin: 0; padding-left: 18px; }
  .findings li { margin: 5px 0; }
  .bad { color: #dc2626; } .good { color: #059669; }
  .rate { border-radius: 14px; padding: 16px; border: 1px solid var(--line); text-align: center; background: #fff; }
  .rate .ring { width: 132px; height: 132px; }
  .ring-text { font-size: 20px; font-weight: 800; fill: var(--ink); }
  .rate b { display: block; margin-top: 6px; }
  .rate small { color: var(--soft); }

  /* Bar charts */
  .charts { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
  .panel { margin-top: 0; padding: 16px 16px 12px; border-radius: 14px; border: 1px solid var(--line); background: #fff; }
  .panel h2 { font-size: 13.5px; }
  .bars { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
  .bars li { display: grid; grid-template-columns: 1fr auto; grid-template-areas: "label value" "track track"; gap: 4px 8px; align-items: center; }
  .bar-label { grid-area: label; font-weight: 600; font-size: 12.5px; }
  .bar-value { grid-area: value; font-size: 12.5px; }
  .bar-value small { color: var(--soft); margin-left: 2px; }
  .bar-track { grid-area: track; height: 8px; border-radius: 99px; background: #edf1f7; overflow: hidden; }
  .bar-fill { display: block; height: 100%; border-radius: 99px; background: var(--c); }

  /* Tables */
  .table-wrap { border: 1px solid var(--line); border-radius: 14px; overflow: hidden; }
  table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
  thead { display: table-header-group; }
  th { text-align: left; padding: 10px 12px; background: var(--navy); color: #dbe7fb; font-size: 10.5px; text-transform: uppercase; letter-spacing: .07em; font-weight: 700; }
  td { text-align: left; padding: 10px 12px; border-top: 1px solid var(--line); vertical-align: middle; }
  tbody tr:nth-child(even) td { background: #fafcff; }
  td small { display: block; font-size: 11px; }
  .num { text-align: right; white-space: nowrap; }
  th.num { text-align: right; }
  .nowrap { white-space: nowrap; }
  .ref { font-weight: 700; color: var(--navy-2); white-space: nowrap; font-size: 11.5px; }
  .muted { color: var(--soft); }
  tr.late td { background: #fff5f5 !important; }
  tr.late td:first-child { box-shadow: inset 4px 0 0 #dc2626; }
  .overdue { color: #dc2626; font-weight: 700; margin-top: 3px; }
  .pill { display: inline-block; padding: 3px 9px; border-radius: 999px; font-size: 11px; font-weight: 700; white-space: nowrap; color: var(--c); background: color-mix(in srgb, var(--c) 12%, white); border: 1px solid color-mix(in srgb, var(--c) 30%, white); }
  .person { display: inline-flex; align-items: center; gap: 9px; font-weight: 600; }
  .avatar { width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center; font-size: 11px; font-weight: 800; color: #fff; background: linear-gradient(135deg, var(--teal), #3b82f6); }
  .avatar.none { background: #cbd5e1; color: #475569; }
  .progress { display: block; width: 120px; height: 7px; border-radius: 99px; background: #edf1f7; overflow: hidden; margin-bottom: 4px; }
  .progress span { display: block; height: 100%; border-radius: 99px; background: linear-gradient(90deg, #10b981, var(--teal)); }
  .stars { color: #f59e0b; letter-spacing: 1px; } .stars .off { color: #dfe5ee; }

  .empty { margin-top: 26px; padding: 40px; text-align: center; color: var(--soft); border: 1px dashed #cdd6e5; border-radius: 14px; background: var(--wash); }
  footer { display: flex; justify-content: space-between; gap: 16px; flex-wrap: wrap; padding: 16px 40px; background: var(--wash); border-top: 1px solid var(--line); color: #75829a; font-size: 11.5px; }
  footer b { color: var(--ink); }

  @media (max-width: 860px) { .stats { grid-template-columns: repeat(2, 1fr); } .charts, .overview { grid-template-columns: 1fr; } }
  @media (max-width: 600px) {
    .page { margin: 0; border-radius: 0; } .cover, .content { padding-left: 18px; padding-right: 18px; } footer { padding: 14px 18px; }
    .cover-top { flex-direction: column; } .doc-type { text-align: left; } .cover h1 { font-size: 27px; }
    .table-wrap { overflow-x: auto; } table { min-width: 640px; }
  }
  @page { size: A4; margin: 12mm; }
  @media print {
    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { background: #fff; font-size: 12px; }
    .bar { display: none; }
    .page { margin: 0; max-width: none; box-shadow: none; border-radius: 0; }
    .cover { border-radius: 12px; }
    .content { padding: 22px 4px 10px; }
    footer { padding: 12px 4px; background: none; }
    .stats { grid-template-columns: repeat(4, 1fr); }
    .charts { grid-template-columns: repeat(3, 1fr); }
    .overview { grid-template-columns: 1fr 200px; }
    section, .panel, .stat, tr { break-inside: avoid; }
    table { font-size: 11px; }
    th, td { padding: 7px 8px; }
    th { font-size: 9.5px; }
    .ref { font-size: 10px; }
    .pill { padding: 2px 7px; font-size: 10px; }
    .issues-section { break-before: page; }
  }
</style></head>
<body>
<div class="bar"><button class="ghost" onclick="window.close()">Close</button><button onclick="window.print()">Print / Save as PDF</button></div>
<div class="page">
  <header class="cover">
    <div class="cover-top">
      <div class="logo">
        <span class="logo-mark"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"/><path d="M5 21V8l7-5 7 5v13"/><path d="M9 21v-6h6v6"/></svg></span>
        <span>ResiFix<small>Student Residence Issues</small></span>
      </div>
      <div class="doc-type">${escape(heading)}<br>${escape(p.slug)}</div>
    </div>
    <h1>${escape(heading)}</h1>
    <div class="period">${escape(p.label)}</div>
    <div class="meta">
      <span>Period <b>${escape(formatDate(p.from))} – ${escape(formatDate(p.to))}</b></span>
      <span>Prepared by <b>${escape(preparedBy)}</b></span>
      <span>Generated <b>${escape(generated)}</b></span>
      ${scope ? `<span class="scope">Only issues matching <b>${escape(scope)}</b></span>` : ''}
    </div>
  </header>

  <div class="content">
    <section>
      <h2>Summary</h2>
      <div class="stats">${summary
        .map(
          (s) => `<div class="stat" style="--c:${s.color}"><span class="stat-icon">${icon(s.icon)}</span><b>${escape(s.value)}</b><span class="label">${escape(s.label)}</span><small>${escape(s.note)}</small></div>`,
        )
        .join('')}</div>
    </section>
    ${
      issues.length
        ? `<section class="overview">
      <div class="findings"><h3>${icon('bulb')} Key findings</h3><ul>${findings.map((f) => `<li>${f}</li>`).join('')}</ul></div>
      <div class="rate">${ring(fixRate, fixRate >= 75 ? '#059669' : fixRate >= 40 ? '#d97706' : '#dc2626')}<b>Fix rate</b><small>${finished.length} of ${issues.length} reports fixed</small></div>
    </section>

    <section class="charts">
      ${barChart('By category', byCategory, (_, i) => PALETTE[i % PALETTE.length])}
      ${barChart('By block', byBlock, (_, i) => PALETTE[(i + 1) % PALETTE.length])}
      ${barChart('By status (now)', byStatus, (label) => STATUS_COLOR[label as Status])}
    </section>

    <section>
      <h2>Maintenance staff</h2>
      <div class="table-wrap"><table>
        <thead><tr><th>Staff member</th><th class="num">Jobs</th><th>Finished</th><th class="num">Avg time to fix</th><th class="num">Avg rating</th></tr></thead>
        <tbody>${staffRows}</tbody>
      </table></div>
    </section>

    <section class="issues-section">
      <h2>All issues reported (${issues.length})</h2>
      <div class="table-wrap"><table>
        <thead><tr><th>Ref</th><th>Issue</th><th>Location</th><th>Priority</th><th>Status</th><th>Reported</th><th>Assigned to</th><th class="num">Days</th></tr></thead>
        <tbody>${issueRows}</tbody>
      </table></div>
    </section>`
        : `<p class="empty">No issues were reported in this period.</p>`
    }
  </div>

  <footer>
    <span><b>ResiFix</b> · ${escape(heading)} · ${escape(p.label)}</span>
    <span>“Days” is days open so far, or days it took to fix for finished issues. Overdue rows are marked in red.</span>
  </footer>
</div>
</body></html>`
}

// Opens the report in a new tab. With print, the print dialog opens straight away ("Save as PDF" downloads it).
export function openReport(html: string, print = false): boolean {
  const page = print ? html.replace('</body>', '<script>addEventListener("load", () => setTimeout(print, 300))</script></body>') : html
  const url = URL.createObjectURL(new Blob([page], { type: 'text/html' }))
  const tab = window.open(url, '_blank')
  // The tab keeps its copy; free the link once it has loaded.
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
  return !!tab
}
