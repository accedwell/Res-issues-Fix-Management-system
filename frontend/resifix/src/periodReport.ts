import { daysTaken, lastDate } from './exportCsv'
import { BLOCKS, STATUSES } from './data/constants'
import { formatDate, isOpen, isOverdue } from './utils'
import type { Category, Issue } from './types'

// A printable report of the issues reported in a chosen period (a month or custom dates).
// It opens in a new tab, where the admin can read it or save it as a PDF.

export interface Period {
  from: string // YYYY-MM-DD, inclusive
  to: string // YYYY-MM-DD, inclusive
  label: string // e.g. "September 2026"
  slug: string // for file names, e.g. "2026-09"
}

// A whole calendar month, given as YYYY-MM.
export function monthPeriod(month: string): Period {
  const [year, m] = month.split('-').map(Number)
  const lastDay = new Date(Date.UTC(year, m, 0)).getUTCDate()
  const label = new Date(Date.UTC(year, m - 1, 1)).toLocaleDateString(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' })
  return { from: `${month}-01`, to: `${month}-${String(lastDay).padStart(2, '0')}`, label, slug: month }
}

export function customPeriod(from: string, to: string): Period {
  return { from, to, label: `${formatDate(from)} – ${formatDate(to)}`, slug: `${from}_to_${to}` }
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

// Rows of [label, count] as an HTML table, skipping empty rows.
function countTable(title: string, heading: string, rows: [string, number][]): string {
  const shown = rows.filter(([, n]) => n > 0)
  if (!shown.length) return ''
  return `<section><h2>${escape(title)}</h2><table><thead><tr><th>${escape(heading)}</th><th class="num">Reports</th></tr></thead><tbody>${shown
    .map(([label, n]) => `<tr><td>${escape(label)}</td><td class="num">${n}</td></tr>`)
    .join('')}</tbody></table></section>`
}

// "scope" describes a search the issues were narrowed by (e.g. "Block A · Plumbing"), or is empty.
export function buildReportHtml(all: Issue[], p: Period, catInfo: (key: string) => Category, preparedBy: string, scope = ''): string {
  const issues = issuesInPeriod(all, p).sort((a, b) => a.dateReported.localeCompare(b.dateReported))
  // Fixed during the period, whenever they were reported.
  const fixed = all.filter((i) => inPeriod(fixedOn(i), p))
  const ratings = issues.flatMap((i) => (i.feedback?.rating != null ? [i.feedback.rating] : []))

  const summary: [string, string | number][] = [
    ['Reported', issues.length],
    ['Fixed in this period', fixed.length],
    ['Still open', issues.filter(isOpen).length],
    ['Overdue now', issues.filter(isOverdue).length],
    ['Re-opened', issues.filter((i) => (i.reopened ?? 0) > 0).length],
    ['Average days to fix', oneDecimal(average(fixed.map(daysTaken)), ' days')],
    ['Average rating', ratings.length ? `${oneDecimal(average(ratings))} / 5` : 'No ratings'],
  ]

  const categoryRows = new Map<string, number>()
  for (const i of issues) {
    const name = catInfo(i.category).name
    categoryRows.set(name, (categoryRows.get(name) ?? 0) + 1)
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
      return `<tr><td>${escape(name)}</td><td class="num">${jobs.length}</td><td class="num">${done.length}</td><td class="num">${oneDecimal(average(done.map(daysTaken)))}</td><td class="num">${rated.length ? oneDecimal(average(rated)) + ' ★' : '—'}</td></tr>`
    })
    .join('')

  const issueRows = issues
    .map(
      (i) => `<tr${isOverdue(i) ? ' class="late"' : ''}>
        <td>${escape(i.ref)}</td><td>${escape(i.title)}</td><td>${escape(catInfo(i.category).name)}</td>
        <td>${escape(i.residence)}, ${escape(i.room)}</td><td>${escape(i.priority)}</td>
        <td>${escape(i.status)}${isOverdue(i) ? ' <b>(overdue)</b>' : ''}</td>
        <td>${escape(formatDate(i.dateReported))}</td><td>${escape(i.assignedToName ?? '—')}</td>
        <td class="num">${daysTaken(i)}</td></tr>`,
    )
    .join('')

  const title = `ResiFix report – ${p.label}`
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(title)}</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #eef2f8; color: #14213d; font: 14px/1.5 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
  .bar { position: sticky; top: 0; display: flex; gap: 8px; justify-content: flex-end; padding: 12px 16px; background: #0b1a3a; }
  .bar button { font: inherit; font-weight: 700; padding: 8px 16px; border-radius: 9px; border: 0; cursor: pointer; background: #22c7a9; color: #04122b; }
  .bar button.ghost { background: transparent; color: #e6f0ff; border: 1px solid rgba(255,255,255,.3); }
  .page { max-width: 1000px; margin: 24px auto; padding: 36px 40px; background: #fff; border-radius: 14px; box-shadow: 0 10px 30px -18px rgba(10,30,70,.5); }
  header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; border-bottom: 3px solid #22c7a9; padding-bottom: 16px; margin-bottom: 22px; }
  .brand { font-weight: 800; font-size: 13px; letter-spacing: .08em; text-transform: uppercase; color: #148f79; }
  h1 { margin: 4px 0 2px; font-size: 26px; }
  .scope { display: inline-block; margin-top: 8px; padding: 3px 10px; border-radius: 999px; background: #e7f8f4; color: #0f6f5e; font-size: 12px; font-weight: 700; }
  .meta { color: #55627d; font-size: 12.5px; text-align: right; }
  h2 { font-size: 16px; margin: 26px 0 10px; }
  .stats { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; }
  .stat { border: 1px solid #dfe5f0; border-radius: 10px; padding: 12px 14px; }
  .stat b { display: block; font-size: 22px; }
  .stat span { color: #55627d; font-size: 12px; }
  .two { display: grid; grid-template-columns: 1fr 1fr; gap: 0 28px; }
  table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
  th, td { text-align: left; padding: 7px 8px; border-bottom: 1px solid #e6ebf3; vertical-align: top; }
  th { background: #f4f7fb; font-size: 11.5px; text-transform: uppercase; letter-spacing: .04em; color: #44516b; }
  .num { text-align: right; white-space: nowrap; }
  tr.late td { background: #fff4f4; }
  tr.late b { color: #c0392b; }
  .empty { padding: 30px; text-align: center; color: #55627d; border: 1px dashed #cdd6e5; border-radius: 10px; }
  footer { margin-top: 28px; color: #7a869c; font-size: 11.5px; }
  @media (max-width: 700px) { .page { margin: 0; border-radius: 0; padding: 20px 16px; } .two { grid-template-columns: 1fr; } header { flex-direction: column; } .meta { text-align: left; } .wide { overflow-x: auto; } }
  @media print {
    body { background: #fff; }
    .bar { display: none; }
    .page { margin: 0; max-width: none; box-shadow: none; padding: 0; }
    tr { break-inside: avoid; }
    th, tr.late td { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style></head>
<body>
<div class="bar"><button class="ghost" onclick="window.close()">Close</button><button onclick="window.print()">Print / Save as PDF</button></div>
<div class="page">
  <header>
    <div><div class="brand">ResiFix · Student Residence Issues</div><h1>Maintenance report</h1><div>${escape(p.label)}</div>${scope ? `<div class="scope">Only issues matching: ${escape(scope)}</div>` : ''}</div>
    <div class="meta">Period: ${escape(formatDate(p.from))} – ${escape(formatDate(p.to))}<br>Prepared by ${escape(preparedBy)}<br>Generated ${escape(new Date().toLocaleString())}</div>
  </header>
  <section><h2>Summary</h2><div class="stats">${summary.map(([label, value]) => `<div class="stat"><b>${escape(value)}</b><span>${escape(label)}</span></div>`).join('')}</div></section>
  ${
    issues.length
      ? `<div class="two">
    ${countTable('By category', 'Category', [...categoryRows.entries()].sort((a, b) => b[1] - a[1]))}
    ${countTable('By block', 'Block', BLOCKS.map((b) => [b, issues.filter((i) => i.residence === b).length]))}
    ${countTable('By status (now)', 'Status', STATUSES.map((s) => [s, issues.filter((i) => i.status === s).length]))}
  </div>
  <section class="wide"><h2>Maintenance staff</h2><table><thead><tr><th>Staff member</th><th class="num">Jobs</th><th class="num">Finished</th><th class="num">Avg days to fix</th><th class="num">Avg rating</th></tr></thead><tbody>${staffRows}</tbody></table></section>
  <section class="wide"><h2>All issues reported (${issues.length})</h2><table><thead><tr><th>Ref</th><th>Title</th><th>Category</th><th>Location</th><th>Priority</th><th>Status</th><th>Reported</th><th>Assigned to</th><th class="num">Days</th></tr></thead><tbody>${issueRows}</tbody></table></section>`
      : `<p class="empty">No issues were reported in this period.</p>`
  }
  <footer>"Days" is days open so far, or days it took to fix for finished issues. Overdue rows are highlighted.</footer>
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
