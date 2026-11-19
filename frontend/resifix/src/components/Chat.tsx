import { useEffect, useRef, useState, type FormEvent, type MouseEvent } from 'react'
import { Icon } from './Icon'
import { apiSendMessage, fetchChat } from '../api'
import { startCall } from '../callBus'
import { useApp } from '../context/appContext'
import type { ChatMessage, Issue } from '../types'

const time = (iso: string) => {
  const d = new Date(iso)
  const today = new Date().toDateString() === d.toDateString()
  return d.toLocaleString(undefined, today ? { hour: '2-digit', minute: '2-digit' } : { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

// The chat icon on a report, with the number of unread messages. Shown only when the viewer may see
// the chat (the student and the assigned staff member; admins read it from the report details).
export function ChatButton({ issue }: { issue: Issue }) {
  const { setModal } = useApp()
  if (!issue.chat) return null
  const unread = issue.chat.unread
  const open = (e: MouseEvent) => {
    // Inside a report row: open the chat, not the report.
    e.stopPropagation()
    setModal({ type: 'chat', issueId: issue.id })
  }
  return (
    <button
      className={'chat-btn' + (unread ? ' has-unread' : '')}
      onClick={open}
      aria-label={unread ? `Chat, ${unread} unread` : 'Chat'}
      title={issue.chat.canSend ? 'Chat about this report' : 'Read the chat'}
    >
      <Icon name="chat" />
      {unread > 0 && <span className="chat-badge">{unread > 9 ? '9+' : unread}</span>}
    </button>
  )
}

// WhatsApp-style conversation about one report. New messages arrive through the app's live updates:
// when the report's message count changes, the chat reloads.
export function ChatModal({ issue, close }: { issue: Issue; close: () => void }) {
  const { auth, refreshIssues } = useApp()
  const [messages, setMessages] = useState<ChatMessage[] | null>(null)
  const [canSend, setCanSend] = useState(false)
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  const end = useRef<HTMLDivElement>(null)
  const total = issue.chat?.total ?? 0
  const unread = issue.chat?.unread ?? 0

  useEffect(() => {
    let current = true
    fetchChat(issue.id)
      .then((chat) => {
        if (!current) return
        setMessages(chat.messages)
        setCanSend(chat.canSend)
      })
      .catch((err) => current && setError(err instanceof Error ? err.message : 'The chat could not be loaded.'))
    return () => {
      current = false
    }
  }, [issue.id, total])

  // Opening the chat marked messages as read on the server; reload so the unread badges clear.
  useEffect(() => {
    if (messages && unread > 0) refreshIssues()
  }, [messages, unread, refreshIssues])

  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' })
  }, [messages])

  const send = async (e: FormEvent) => {
    e.preventDefault()
    if (!text.trim() || sending) return
    setSending(true)
    setError('')
    try {
      const chat = await apiSendMessage(issue.id, text)
      setMessages(chat.messages)
      setText('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The message could not be sent.')
    }
    setSending(false)
  }

  // Who is on the other side. Maintenance only ever sees "Student".
  const other =
    auth.role === 'maintenance'
      ? `Student · ${issue.residence}, ${/^\d/.test(issue.room) ? 'Room ' + issue.room : issue.room}`
      : auth.role === 'student'
        ? (issue.assignedToName ?? 'Maintenance')
        : `${issue.studentName} and ${issue.assignedToName ?? 'maintenance'}`

  return (
    <div className="modal chat-modal">
      <div className="chat-top">
        <div>
          <div className="chat-ref">
            {issue.ref} · {issue.title}
          </div>
          <h3>{other}</h3>
        </div>
        <span className="chat-top-actions">
          {canSend && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => startCall({ issueId: issue.id, ref: issue.ref, name: auth.role === 'maintenance' ? 'Student' : (issue.assignedToName ?? 'Maintenance') })}
              aria-label="Voice call"
              title="Voice call — they need to have ResiFix open"
            >
              <Icon name="phone" />
            </button>
          )}
          <button className="btn btn-ghost btn-sm" onClick={close} aria-label="Close">
            <Icon name="x" />
          </button>
        </span>
      </div>

      <div className="chat-body">
        {messages === null && !error && <p className="chat-empty">Loading…</p>}
        {messages?.length === 0 && (
          <p className="chat-empty">
            {canSend ? 'No messages yet. Say hello — for example, let them know when you will be there.' : 'No messages on this report.'}
          </p>
        )}
        {messages?.map((m) => (
          <div key={m.id} className={'chat-msg' + (m.mine ? ' mine' : '')}>
            {!m.mine && <span className="chat-from">{m.from}</span>}
            <p>{m.body}</p>
            <time>{time(m.at)}</time>
          </div>
        ))}
        <div ref={end} />
      </div>

      {error && <div className="field-error">{error}</div>}
      {canSend ? (
        <form className="chat-send" onSubmit={send}>
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type a message"
            maxLength={1000}
            aria-label="Message"
            autoFocus
          />
          <button className="btn btn-primary" type="submit" disabled={sending || !text.trim()} aria-label="Send">
            <Icon name="send" />
          </button>
        </form>
      ) : (
        messages && (
          <p className="chat-readonly">
            {auth.role === 'admin' ? 'You can read this chat but not reply.' : 'This report is closed, so the chat is read-only.'}
          </p>
        )
      )}
    </div>
  )
}
