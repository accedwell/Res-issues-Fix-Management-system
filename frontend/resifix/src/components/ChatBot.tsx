import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Icon } from './Icon'
import { useApp } from '../context/appContext'
import {
  draftSummary,
  isAffirmative,
  isNegative,
  mergeDraft,
  nextQuestion,
  toNewIssue,
  type ChatDraft,
  type ChatMessage,
} from '../chatbot'
import { recommendStaff } from '../utils'

let messageSeq = 0

const makeMessage = (role: ChatMessage['role'], text: string): ChatMessage => ({
  id: `chat-${Date.now()}-${messageSeq++}`,
  role,
  text,
  date: new Date().toISOString(),
})

const WELCOME =
  "Hi! I'm ResiFix AI, your maintenance assistant. Tell me what is broken and where — for example: 'The tap in Block B room 204 is leaking badly.' I'll log the report and assign the best maintenance staff member automatically."

type Stage = 'chat' | 'confirm' | 'done'

export function ChatBot() {
  const { auth, issues, chatReportIssue } = useApp()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState<ChatDraft>({})
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const [stage, setStage] = useState<Stage>('chat')
  const bodyRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const timerRef = useRef<number | undefined>(undefined)

  useEffect(
    () => () => {
      if (timerRef.current !== undefined) window.clearTimeout(timerRef.current)
    },
    [],
  )

  useEffect(() => {
    if (open) bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, thinking, open])

  const openChat = () => {
    setOpen(true)
    if (!messages.length) {
      const firstName = auth.name?.split(' ')[0] ?? 'there'
      setMessages([makeMessage('assistant', WELCOME.replace('Hi!', `Hi ${firstName}!`))])
    }
    window.setTimeout(() => inputRef.current?.focus(), 80)
  }

  const reset = () => {
    setDraft({})
    setStage('chat')
    setMessages([makeMessage('assistant', "Let's log a new maintenance issue. What is broken, and where is it?")])
    window.setTimeout(() => inputRef.current?.focus(), 50)
  }

  const respond = (text: string) => {
    if (stage === 'done') {
      if (/new|another|report|issue/i.test(text)) {
        reset()
      } else {
        setMessages((prev) => [
          ...prev,
          makeMessage('assistant', 'That report is already logged. Say "new report" if you want to report something else.'),
        ])
      }
      return
    }

    if (stage === 'confirm') {
      if (isNegative(text)) {
        setDraft({})
        setStage('chat')
        setMessages((prev) => [
          ...prev,
          makeMessage('assistant', 'No problem — nothing was submitted. Tell me what needs fixing.'),
        ])
        return
      }

      if (isAffirmative(text)) {
        const newIssue = toNewIssue(draft)
        if (!newIssue) {
          setStage('chat')
          setMessages((prev) => [...prev, makeMessage('assistant', nextQuestion(draft))])
          return
        }

        const { issue, staff } = chatReportIssue(newIssue)
        setStage('done')
        setMessages((prev) => [
          ...prev,
          makeMessage(
            'assistant',
            `Done! ✅\n\nYour report ${issue.ref} has been logged and assigned to ${staff.name} (${staff.specialization}). ${staff.name} has been notified and will take it from here.\n\nYou can follow the progress under My Reports.`,
          ),
        ])
        return
      }

      // The student added more detail instead of saying yes/no. Merge it and ask again.
      const merged = mergeDraft(draft, text)
      setDraft(merged)
      const newIssue = toNewIssue(merged)
      if (!newIssue) {
        setStage('chat')
        setMessages((prev) => [...prev, makeMessage('assistant', nextQuestion(merged))])
        return
      }
      const staff = recommendStaff({ category: merged.category ?? 'other' }, issues)
      setMessages((prev) => [
        ...prev,
        makeMessage(
          'assistant',
          `${draftSummary(merged, staff.name, staff.specialization)}\n\nShall I submit this report and assign ${staff.name}? Reply yes to confirm.`,
        ),
      ])
      return
    }

    const merged = mergeDraft(draft, text)
    setDraft(merged)
    const newIssue = toNewIssue(merged)

    if (newIssue) {
      const staff = recommendStaff({ category: merged.category ?? 'other' }, issues)
      setStage('confirm')
      setMessages((prev) => [
        ...prev,
        makeMessage(
          'assistant',
          `${draftSummary(merged, staff.name, staff.specialization)}\n\nShall I submit this report and assign ${staff.name}? Reply yes to confirm.`,
        ),
      ])
    } else {
      setMessages((prev) => [...prev, makeMessage('assistant', nextQuestion(merged))])
    }
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const text = input.trim()
    if (!text || thinking) return

    setInput('')
    setMessages((prev) => [...prev, makeMessage('user', text)])
    setThinking(true)
    timerRef.current = window.setTimeout(() => {
      try {
        respond(text)
      } finally {
        setThinking(false)
      }
    }, 550)
  }

  return (
    <>
      {!open && (
        <button
          className="chat-launcher"
          onClick={openChat}
          aria-label="Open ResiFix AI maintenance assistant"
          title="Report an issue with ResiFix AI"
        >
          <Icon name="message-circle" />
          <span className="chat-launcher-dot" />
        </button>
      )}

      {open && (
        <section className="chat-panel" aria-label="ResiFix AI maintenance assistant">
          <header className="chat-head">
            <div className="chat-avatar">
              <Icon name="bot" />
            </div>
            <div className="chat-head-text">
              <b>ResiFix AI</b>
              <span>Maintenance assistant · online</span>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => setOpen(false)} aria-label="Close chat">
              <Icon name="x" />
            </button>
          </header>

          <div className="chat-body" ref={bodyRef}>
            {messages.map((message) => (
              <div key={message.id} className={`chat-bubble ${message.role}`}>
                {message.text}
              </div>
            ))}

            {thinking && (
              <div className="chat-bubble assistant chat-typing" aria-label="Assistant is typing">
                <span />
                <span />
                <span />
              </div>
            )}

            {stage === 'done' && !thinking && (
              <button className="chat-chip" onClick={reset}>
                <Icon name="plus-circle" /> Report another issue
              </button>
            )}
          </div>

          <form className="chat-input" onSubmit={submit}>
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={stage === 'confirm' ? 'Type yes to confirm, or add more details…' : 'Describe the maintenance issue…'}
              aria-label="Message"
            />
            <button className="chat-send" type="submit" disabled={!input.trim() || thinking} aria-label="Send message">
              <Icon name="send" />
            </button>
          </form>

          <div className="chat-foot">AI assistant · assigns the best maintenance staff automatically</div>
        </section>
      )}
    </>
  )
}
