import { useEffect, useRef, useState, type FormEvent } from 'react'
import { CameraCapture } from '../components/CameraCapture'
import { Icon } from '../components/Icon'
import { useApp } from '../context/appContext'
import { apiAskAssistant } from '../api'
import { preparePhoto, type PreparedPhoto } from '../photo'
import { PRIORITY_CLASS } from '../data/constants'
import type { AssistantMessage, AssistantReply, ReportDraft } from '../types'
import { AlreadyReported, PhotoButtons } from './reportParts'

export type AssistantDraft = ReportDraft

// Things a student might say, to show how to start. Tapping one puts it in the message box.
const EXAMPLES = ['My shower has no hot water', 'The Wi-Fi keeps dropping in my room', 'The hallway light is broken']

// A fresh id for each report, sent again on retries so the server never files it twice.
// crypto.randomUUID only exists on https or localhost, so phones on the local Wi-Fi get the fallback.
const newSubmissionId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`

// The student describes the problem in their own words; the assistant asks what it needs, writes
// the report, and on Submit it goes straight to the matching maintenance person.
export function ReportAssistant({ onUseForm }: { onUseForm: (draft: AssistantDraft) => void }) {
  const { auth, catInfo, addAssistantIssue } = useApp()
  const [messages, setMessages] = useState<AssistantMessage[]>([])
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const [error, setError] = useState('')
  const [latest, setLatest] = useState<AssistantReply | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submissionId, setSubmissionId] = useState(newSubmissionId)
  const [photo, setPhoto] = useState<PreparedPhoto | null>(null)
  const [photoError, setPhotoError] = useState('')
  const [preparing, setPreparing] = useState(false)
  const [camera, setCamera] = useState(false)
  const chatRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Keep the newest message in view.
  useEffect(() => {
    const el = chatRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, thinking])

  const firstName = auth.name?.split(' ')[0] ?? ''
  const draft = latest?.ready ? latest.draft : null

  const send = async (e?: FormEvent) => {
    e?.preventDefault()
    const text = input.trim()
    if (!text || thinking || submitting) return
    const before = messages
    const next: AssistantMessage[] = [...before, { role: 'user', content: text }]
    setMessages(next)
    setInput('')
    setError('')
    setThinking(true)
    try {
      const answer = await apiAskAssistant(next)
      setMessages([...next, { role: 'assistant', content: answer.reply }])
      setLatest(answer)
    } catch (err) {
      // Put the message back so the student can simply press Send again.
      setMessages(before)
      setInput(text)
      setError(err instanceof Error ? err.message : 'The assistant could not answer. Please try again.')
    }
    setThinking(false)
    inputRef.current?.focus()
  }

  const choosePhoto = async (file: File | undefined) => {
    if (!file) return
    setPhotoError('')
    setPreparing(true)
    try {
      setPhoto(await preparePhoto(file))
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : 'That photo could not be used.')
    }
    setPreparing(false)
  }

  const submit = async () => {
    if (!draft || submitting) return
    setSubmitting(true)
    // On success the app moves to My Reports; on failure everything stays so it can be retried.
    if (!(await addAssistantIssue({ submissionId, ...draft, photo: photo?.upload }))) setSubmitting(false)
  }

  const startOver = () => {
    setMessages([])
    setLatest(null)
    setInput('')
    setError('')
    setPhoto(null)
    setPhotoError('')
    setSubmissionId(newSubmissionId())
    inputRef.current?.focus()
  }

  const category = draft ? catInfo(draft.category) : null

  return (
    <div className="ai-assist">
      <div className="ai-chat" ref={chatRef} aria-live="polite">
        {messages.length === 0 && (
          <div className="ai-intro">
            <span className="badge">
              <Icon name="chat" />
            </span>
            <p>
              <b>Hi{firstName ? ` ${firstName}` : ''}! What's wrong?</b>
              Tell me in your own words, like you'd tell a friend. I'll write the report and send it straight to the
              right maintenance person.
            </p>
            <div className="ai-examples">
              {EXAMPLES.map((example) => (
                <button
                  key={example}
                  type="button"
                  className="ai-example"
                  onClick={() => {
                    setInput(example)
                    inputRef.current?.focus()
                  }}
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={'chat-msg' + (m.role === 'user' ? ' mine' : '')}>
            {m.role === 'assistant' && <span className="chat-from">ResiFix assistant</span>}
            <p>{m.content}</p>
          </div>
        ))}
        {thinking && (
          <div className="chat-msg ai-typing" aria-label="The assistant is typing">
            <span />
            <span />
            <span />
          </div>
        )}
      </div>

      {error && <div className="field-error">{error}</div>}

      {!draft && (
        <form className="chat-send ai-send" onSubmit={send}>
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={messages.length ? 'Type your answer…' : "e.g. My bathroom tap won't stop dripping"}
            maxLength={1500}
            disabled={thinking}
            aria-label="Message to the assistant"
          />
          <button className="btn btn-primary" type="submit" disabled={!input.trim() || thinking} aria-label="Send">
            <Icon name="send" />
          </button>
        </form>
      )}

      {draft && category && (
        <div className="ai-draft">
          <div className="ai-draft-head">
            <h3>
              <Icon name="file-text" /> Your report
            </h3>
            <span className={'priority-pill ' + PRIORITY_CLASS[draft.priority]}>{draft.priority} priority</span>
          </div>

          {draft.priority === 'Urgent' && (
            <div className="ai-safety" role="alert">
              <Icon name="flag" />
              <span>
                <b>If anyone could get hurt, keep away from it and call residence security now.</b> Don't wait for
                maintenance to arrive.
              </span>
            </div>
          )}

          <dl className="ai-draft-fields">
            <dt>Problem</dt>
            <dd>{draft.title}</dd>
            <dt>Category</dt>
            <dd>
              <Icon name={category.icon} /> {category.name}
            </dd>
            <dt>Where</dt>
            <dd>
              {draft.room}
              {auth.block ? `, ${auth.block}` : ''}
            </dd>
            <dt>Details</dt>
            <dd>{draft.description}</dd>
          </dl>

          <div className="field">
            <label>Photo (optional)</label>
            {photo ? (
              <div className="st-photo">
                <img src={photo.preview} alt="Your photo of the problem" />
                <div>
                  <b>Photo added</b>
                  <small>Maintenance will see this with your report.</small>
                  <span className="st-photo-actions">
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPhoto(null)}>
                      <Icon name="x" /> Remove
                    </button>
                  </span>
                </div>
              </div>
            ) : (
              <span className="st-photo-actions">
                <PhotoButtons onFile={choosePhoto} openCamera={() => setCamera(true)} disabled={preparing} small />
              </span>
            )}
            {photoError && <div className="field-error">{photoError}</div>}
            {camera && <CameraCapture onCapture={choosePhoto} close={() => setCamera(false)} />}
          </div>

          <AlreadyReported category={draft.category} residence={auth.block ?? ''} room={draft.room} />

          <p className="field-hint">
            <Icon name="tools" /> When you submit, it goes straight to the maintenance person for {category.name.toLowerCase()} —
            you'll be told who is coming.
          </p>

          <div className="ai-draft-actions">
            <button type="button" className="btn btn-ghost" onClick={startOver} disabled={submitting}>
              <Icon name="refresh" /> Start over
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => onUseForm(draft)} disabled={submitting}>
              Change details
            </button>
            <button type="button" className="btn btn-primary btn-lg" onClick={submit} disabled={submitting || preparing}>
              <Icon name="check" /> {submitting ? 'Sending…' : 'Submit report'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
