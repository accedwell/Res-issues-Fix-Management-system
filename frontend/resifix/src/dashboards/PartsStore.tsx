import { useState } from 'react'
import { EmptyState } from '../components/common'
import { Icon } from '../components/Icon'
import { useApp } from '../context/appContext'
import type { SparePart, StockMovement } from '../types'

// The maintenance store room. Technicians see what is in stock and take parts for a job (a new
// stove plate, a tap, a bulb); the staff manager sees every part, who took what, and restocks.

type StockView = 'all' | 'low' | 'out'

const stockLabel =(part: SparePart) => (part.quantity === 0 ? 'Out of stock' : part.low ? 'Low stock' : 'In stock')
const stockClass = (part: SparePart) => (part.quantity === 0 ? 'out' : part.low ? 'low' : 'ok')

export function PartsStore() {
  const { auth, parts, stockMovements, categories, catInfo, setModal } = useApp()
  const manager = auth.role === 'admin'
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [view, setView] = useState<StockView>('all')

  const lowCount = parts.filter((p) => p.low && p.quantity > 0).length
  const outCount = parts.filter((p) => p.quantity === 0).length
  const words = search.trim().toLowerCase()
  const shown = parts.filter(
    (p) =>
      (view === 'all' || (view === 'out' ? p.quantity === 0 : p.low && p.quantity > 0)) &&
      (category === 'all' || p.category === category) &&
      (!words || `${p.name} ${p.location}`.toLowerCase().includes(words)),
  )
  // Only categories that have parts, so the filter stays short.
  const usedCategories = categories.filter((c) => parts.some((p) => p.category === c.key))

  return (
    <>
      <div className="parts-summary" role="group" aria-label="Show parts">
        <SummaryButton label="Parts in the store" value={parts.length} on={view === 'all'} onClick={() => setView('all')} />
        <SummaryButton label="Running low" value={lowCount} tone="low" on={view === 'low'} onClick={() => setView('low')} />
        <SummaryButton label="Out of stock" value={outCount} tone="out" on={view === 'out'} onClick={() => setView('out')} />
      </div>

      <div className="card" data-tour="parts-list">
        <div className="card-head">
          <p className="card-sub">
            {manager
              ? 'Every spare part in the store room. Restock when something runs low; you are told automatically.'
              : 'Need a part for a job? Take it here so the store stays up to date. Ask for more when something runs low.'}
          </p>
          {manager && (
            <button className="btn btn-primary btn-sm" onClick={() => setModal({ type: 'addPart' })}>
              <Icon name="plus-circle" /> Add part
            </button>
          )}
        </div>
        <div className="toolbar">
          <input
            type="search"
            className="parts-search"
            placeholder="Search parts, e.g. stove plate"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search parts"
          />
          <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category">
            <option value="all">All kinds of job</option>
            {usedCategories.map((c) => (
              <option key={c.key} value={c.key}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {shown.length ? (
          <ul className="parts-list">
            {shown.map((part) => {
              const cat = part.category ? catInfo(part.category) : null
              return (
                <li key={part.id} className="part-row">
                  <span className="issue-cat-badge">
                    <Icon name={cat?.icon ?? 'box'} />
                  </span>
                  <span className="part-main">
                    <b>{part.name}</b>
                    <span className="part-meta">
                      {cat?.name ?? 'General'}
                      {part.location && ` · ${part.location}`}
                    </span>
                  </span>
                  <span className={'part-stock ' + stockClass(part)}>
                    <b>{part.quantity}</b> {part.unit}
                    <small>{stockLabel(part)}</small>
                  </span>
                  <span className="part-actions">
                    {manager ? (
                      <>
                        <button className="btn btn-navy btn-sm" onClick={() => setModal({ type: 'restockPart', partId: part.id })}>
                          <Icon name="plus-circle" /> Restock
                        </button>
                        <button className="btn btn-ghost btn-sm" onClick={() => setModal({ type: 'editPart', partId: part.id })}>
                          Edit
                        </button>
                      </>
                    ) : (
                      <>
                        {part.quantity > 0 && (
                          <button className="btn btn-navy btn-sm" onClick={() => setModal({ type: 'takePart', partId: part.id })}>
                            Take
                          </button>
                        )}
                        {part.low && (
                          <button className="btn btn-ghost btn-sm" onClick={() => setModal({ type: 'requestPart', partId: part.id })}>
                            Ask for more
                          </button>
                        )}
                      </>
                    )}
                  </span>
                </li>
              )
            })}
          </ul>
        ) : (
          <EmptyState
            icon="box"
            title={parts.length ? 'No parts match' : 'The store is empty'}
            sub={parts.length ? 'Try another search or category.' : manager ? 'Add the first part with “Add part”.' : 'The staff manager adds parts here.'}
          />
        )}
      </div>

      <div className="card">
        <h2>{manager ? 'Store activity' : 'Parts you have taken'}</h2>
        <p className="card-sub">
          {manager ? 'Who took what, for which job, and every restock. Newest first.' : 'Newest first, with the job each part was for.'}
        </p>
        {stockMovements.length ? (
          <ul className="stock-log">
            {stockMovements.map((m) => (
              <MovementRow key={m.id} movement={m} />
            ))}
          </ul>
        ) : (
          <EmptyState icon="clock" title="Nothing yet" sub="Parts taken from or added to the store show up here." />
        )}
      </div>
    </>
  )
}

function SummaryButton(props: { label: string; value: number; tone?: 'low' | 'out'; on: boolean; onClick: () => void }) {
  return (
    <button className={'parts-tile' + (props.tone ? ' ' + props.tone : '') + (props.on ? ' on' : '')} onClick={props.onClick} aria-pressed={props.on}>
      <b>{props.value}</b>
      <span>{props.label}</span>
    </button>
  )
}

const VERB = { added: 'added', taken: 'took', restocked: 'restocked' } as const

function MovementRow({ movement: m }: { movement: StockMovement }) {
  const { setModal, issues } = useApp()
  const when = new Date(m.at).toLocaleString('en-ZA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  // The job link only works for jobs this person can open.
  const job = m.issueId ? issues.find((i) => i.id === m.issueId) : undefined

  return (
    <li>
      <span className={'stock-change ' + (m.change < 0 ? 'out' : 'in')}>{m.change > 0 ? `+${m.change}` : m.change}</span>
      <span className="stock-text">
        <span>
          <b>{m.by ?? 'Someone'}</b> {VERB[m.type]} {Math.abs(m.change)} × {m.partName}
          {m.issueRef &&
            (job ? (
              <>
                {' for '}
                <button className="link-btn" onClick={() => setModal({ type: 'detail', issueId: job.id })}>
                  {m.issueRef}
                </button>
              </>
            ) : (
              ` for ${m.issueRef}`
            ))}
        </span>
        {m.note && <span className="stock-note">“{m.note}”</span>}
        <span className="stock-when">
          {when} · {m.balance} {m.unit} left
        </span>
      </span>
    </li>
  )
}
