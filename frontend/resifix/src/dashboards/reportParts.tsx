import { useEffect, useState, type ChangeEvent } from 'react'
import { Icon } from '../components/Icon'
import { useApp } from '../context/appContext'
import { fetchSimilarIssues } from '../api'
import { canUseWebcam } from '../photo'
import { formatDate } from '../utils'
import type { SimilarIssue } from '../types'

// Pieces of the student report screen shared by the form and the AI assistant.

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

// While a student fills in the form: open reports of the same kind in the same block, so they can
// see it is already known before reporting it again. They can still submit if it's a different problem.
export function AlreadyReported({ category, residence, room }: { category: string; residence: string; room: string }) {
  const { catInfo } = useApp()
  const [similar, setSimilar] = useState<SimilarIssue[]>([])

  useEffect(() => {
    if (!category) return
    let current = true
    // Wait until the student stops typing the room before asking.
    const timer = setTimeout(() => {
      fetchSimilarIssues(category, residence, room)
        .then((found) => current && setSimilar(found))
        .catch(() => current && setSimilar([]))
    }, 400)
    return () => {
      current = false
      clearTimeout(timer)
    }
  }, [category, residence, room])

  const shown = category ? similar : []
  if (!shown.length) return null
  const inRoom = shown.some((s) => s.sameRoom)

  return (
    <div className="already-reported" role="status">
      <b>
        <Icon name="flag" />
        {inRoom
          ? `This may already be reported in ${room.trim()}`
          : `${plural(shown.length, 'open report', 'open reports')} for ${catInfo(category).name} in ${residence}`}
      </b>
      <ul>
        {shown.map((s) => (
          <li key={s.ref} className={s.sameRoom ? 'same-room' : ''}>
            <span>
              <span className="ref">{s.ref}</span> {s.title}
              {s.mine && <span className="mine-tag">Your report</span>}
            </span>
            <small>
              {s.room} · reported {formatDate(s.dateReported)} · {s.status}
            </small>
          </li>
        ))}
      </ul>
      <p>If it's the same problem, there's no need to report it again — maintenance already knows. If it's a different problem, carry on.</p>
    </div>
  )
}

// "Take a photo" opens the phone camera (or the laptop webcam); "Upload a photo" picks a saved picture.
export function PhotoButtons({
  onFile,
  openCamera,
  disabled = false,
  small = false,
}: {
  onFile: (file: File | undefined) => void
  openCamera: () => void
  disabled?: boolean
  small?: boolean
}) {
  const size = small ? ' btn-sm' : ''
  const pick = (e: ChangeEvent<HTMLInputElement>) => {
    onFile(e.target.files?.[0])
    e.target.value = '' // so the same picture can be chosen again after Remove
  }
  return (
    <>
      {canUseWebcam() ? (
        <button type="button" className={'btn btn-primary' + size} onClick={openCamera} disabled={disabled}>
          <Icon name="camera" /> Take a photo
        </button>
      ) : (
        <label className={'btn btn-primary' + size}>
          <Icon name="camera" /> Take a photo
          <input type="file" accept="image/*" capture="environment" disabled={disabled} onChange={pick} />
        </label>
      )}
      <label className={'btn btn-ghost' + size}>
        <Icon name="image" /> Upload a photo
        <input type="file" accept="image/*" disabled={disabled} onChange={pick} />
      </label>
    </>
  )
}
