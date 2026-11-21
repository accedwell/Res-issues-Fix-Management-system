import { useState } from 'react'
import { Icon } from './Icon'
import { useApp } from '../context/appContext'
import { isOpen } from '../utils'
import type { PartInput, SparePart } from '../types'

// Pop-ups for the parts store (see dashboards/PartsStore.tsx).

const UNITS = ['each', 'pack', 'set', 'box', 'metre', 'litre']

interface PartModalProps {
  part: SparePart
  close: () => void
}

// A whole number between min and max, or null when the box holds anything else.
function wholeNumber(text: string, min: number, max: number): number | null {
  if (!/^\d+$/.test(text.trim())) return null
  const value = Number(text)
  return value >= min && value <= max ? value : null
}

// Maintenance takes a part out of the store, usually for one of their jobs.
export function TakePartModal({ part, close }: PartModalProps) {
  const { issues, takePart } = useApp()
  // Maintenance staff only receive their own jobs, so every open one here is theirs.
  const jobs = issues.filter(isOpen)
  const [quantity, setQuantity] = useState('1')
  const [issueId, setIssueId] = useState(jobs.length === 1 ? jobs[0].id : '')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const save = async () => {
    const amount = wholeNumber(quantity, 1, part.quantity)
    if (amount === null) return setError(`Enter a number from 1 to ${part.quantity}.`)
    setBusy(true)
    if (!(await takePart(part, amount, issueId, note.trim()))) setBusy(false)
  }

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="take-title">
      <h3 id="take-title">Take from the store</h3>
      <p className="modal-sub">
        {part.name} · <b>{part.quantity}</b> {part.unit} in stock{part.location && ` · ${part.location}`}
      </p>
      <div className="field">
        <label htmlFor="take-qty">How many?</label>
        <input
          id="take-qty"
          type="number"
          inputMode="numeric"
          min={1}
          max={part.quantity}
          value={quantity}
          onChange={(e) => {
            setQuantity(e.target.value)
            setError('')
          }}
        />
        {error && <div className="field-error">{error}</div>}
      </div>
      <div className="field">
        <label htmlFor="take-job">For which job?</label>
        <select id="take-job" value={issueId} onChange={(e) => setIssueId(e.target.value)}>
          <option value="">Not for a specific job</option>
          {jobs.map((job) => (
            <option key={job.id} value={job.id}>
              {job.ref} · {job.title} ({job.residence}, {job.room})
            </option>
          ))}
        </select>
        <div className="field-hint">Linking the job shows the staff manager where each part went.</div>
      </div>
      <div className="field">
        <label htmlFor="take-note">Note (optional)</label>
        <input id="take-note" value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} placeholder="e.g. old plate burnt out" />
      </div>
      <div className="modal-actions">
        <button className="btn btn-ghost" onClick={close}>
          Cancel
        </button>
        <button className="btn btn-primary" onClick={save} disabled={busy}>
          {busy ? 'Saving…' : 'Take part'}
        </button>
      </div>
    </div>
  )
}

// Maintenance asks the staff manager to order more of a part that is low or out.
export function RequestPartModal({ part, close }: PartModalProps) {
  const { requestPart } = useApp()
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="request-title">
      <h3 id="request-title">Ask for more</h3>
      <p className="modal-sub">
        The staff manager will be told that {part.name} needs restocking ({part.quantity} {part.unit} left).
      </p>
      <div className="field">
        <label htmlFor="request-note">Message (optional)</label>
        <input
          id="request-note"
          value={note}
          maxLength={200}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. I need two for jobs in Block C this week"
        />
      </div>
      <div className="modal-actions">
        <button className="btn btn-ghost" onClick={close}>
          Cancel
        </button>
        <button
          className="btn btn-primary"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            if (!(await requestPart(part, note.trim()))) setBusy(false)
          }}
        >
          {busy ? 'Sending…' : 'Send request'}
        </button>
      </div>
    </div>
  )
}

// The staff manager puts more stock in the store.
export function RestockPartModal({ part, close }: PartModalProps) {
  const { restockPart } = useApp()
  const [quantity, setQuantity] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const amount = wholeNumber(quantity, 1, 1000)

  const save = async () => {
    if (amount === null) return setError('Enter how many you are adding (1 to 1000).')
    setBusy(true)
    if (!(await restockPart(part, amount, note.trim()))) setBusy(false)
  }

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="restock-title">
      <h3 id="restock-title">Restock {part.name}</h3>
      <p className="modal-sub">
        {part.quantity} {part.unit} in stock now. Order more when it drops to {part.minQuantity}.
      </p>
      <div className="field">
        <label htmlFor="restock-qty">How many are you adding?</label>
        <input
          id="restock-qty"
          type="number"
          inputMode="numeric"
          min={1}
          value={quantity}
          autoFocus
          onChange={(e) => {
            setQuantity(e.target.value)
            setError('')
          }}
        />
        {amount !== null && (
          <div className="field-hint">
            The store will have {part.quantity + amount} {part.unit}.
          </div>
        )}
        {error && <div className="field-error">{error}</div>}
      </div>
      <div className="field">
        <label htmlFor="restock-note">Note (optional)</label>
        <input id="restock-note" value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} placeholder="e.g. supplier or order number" />
      </div>
      <div className="modal-actions">
        <button className="btn btn-ghost" onClick={close}>
          Cancel
        </button>
        <button className="btn btn-primary" onClick={save} disabled={busy}>
          {busy ? 'Saving…' : 'Add to stock'}
        </button>
      </div>
    </div>
  )
}

// Add a new part (with its starting stock) or edit one. Stock itself only changes by taking or
// restocking, so every change shows in the activity log.
export function PartFormModal({ part, close }: { part?: SparePart; close: () => void }) {
  const { categories, addPart, editPart, setModal } = useApp()
  const [name, setName] = useState(part?.name ?? '')
  const [category, setCategory] = useState(part?.category ?? '')
  const [unit, setUnit] = useState(part?.unit ?? 'each')
  const [quantity, setQuantity] = useState('0')
  const [minQuantity, setMinQuantity] = useState(String(part?.minQuantity ?? 2))
  const [location, setLocation] = useState(part?.location ?? '')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const save = async () => {
    const min = wholeNumber(minQuantity, 0, 1000)
    const start = wholeNumber(quantity, 0, 1000)
    if (!name.trim()) return setError('Give the part a name.')
    if (min === null) return setError('The order level must be a whole number from 0 to 1000.')
    if (!part && start === null) return setError('Starting stock must be a whole number from 0 to 1000.')
    const input: PartInput = { name: name.trim(), category, unit, minQuantity: min, location: location.trim() }
    setBusy(true)
    const ok = part ? await editPart(part.id, input) : await addPart({ ...input, quantity: start ?? 0 })
    if (!ok) setBusy(false)
  }

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="part-form-title">
      <h3 id="part-form-title">{part ? 'Edit part' : 'Add a part to the store'}</h3>
      <p className="modal-sub">{part ? 'Change its details. Use Restock to add stock.' : 'Maintenance staff will see it straight away.'}</p>
      <div className="field">
        <label htmlFor="part-name">Name</label>
        <input id="part-name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="e.g. Stove plate 180 mm" />
      </div>
      <div className="part-form-grid">
        <div className="field">
          <label htmlFor="part-category">Kind of job</label>
          <select id="part-category" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">General</option>
            {categories
              .filter((c) => c.key !== 'other')
              .map((c) => (
                <option key={c.key} value={c.key}>
                  {c.name}
                </option>
              ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="part-unit">Counted in</label>
          <select id="part-unit" value={unit} onChange={(e) => setUnit(e.target.value)}>
            {UNITS.map((u) => (
              <option key={u}>{u}</option>
            ))}
          </select>
        </div>
        {!part && (
          <div className="field">
            <label htmlFor="part-qty">Starting stock</label>
            <input id="part-qty" type="number" inputMode="numeric" min={0} value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          </div>
        )}
        <div className="field">
          <label htmlFor="part-min">Order more at</label>
          <input id="part-min" type="number" inputMode="numeric" min={0} value={minQuantity} onChange={(e) => setMinQuantity(e.target.value)} />
        </div>
      </div>
      <div className="field">
        <label htmlFor="part-location">Where it is kept (optional)</label>
        <input id="part-location" value={location} maxLength={80} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Store room, shelf A1" />
        <div className="field-hint">You are notified when stock drops to the “order more at” number.</div>
      </div>
      {error && <div className="field-error">{error}</div>}
      <div className="modal-actions">
        {part && (
          <button className="btn btn-danger-ghost" style={{ marginRight: 'auto' }} onClick={() => setModal({ type: 'removePart', partId: part.id })}>
            <Icon name="x" /> Remove
          </button>
        )}
        <button className="btn btn-ghost" onClick={close}>
          Cancel
        </button>
        <button className="btn btn-primary" onClick={save} disabled={busy}>
          {busy ? 'Saving…' : part ? 'Save changes' : 'Add part'}
        </button>
      </div>
    </div>
  )
}

export function RemovePartModal({ part, close }: PartModalProps) {
  const { removePart } = useApp()

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="remove-part-title">
      <h3 id="remove-part-title">Remove part</h3>
      <p className="modal-sub">
        Remove “{part.name}” from the store? Maintenance staff will no longer see it. Its past activity stays in the log.
      </p>
      <div className="modal-actions">
        <button className="btn btn-ghost" onClick={close}>
          Cancel
        </button>
        <button className="btn btn-danger" onClick={() => removePart(part)}>
          <Icon name="x" /> Remove part
        </button>
      </div>
    </div>
  )
}
