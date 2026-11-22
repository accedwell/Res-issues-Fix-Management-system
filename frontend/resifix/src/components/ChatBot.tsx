import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Icon } from './Icon'
import { useApp } from '../context/appContext'
import { apiChat, type AssistantDraft } from '../api'

let messageSeq = 0

interface Bubble {
  id: string
  role: 'assistant' | 'user'
  text: string
}

const makeMessage = (role: Bubble['role'], text: string): Bubble => ({
  id: `chat-${Date.now()}-${messageSeq++}`,
  role,
  text,
})

const WELCOME =
  "Hi! I'm ResiFix AI, your maintenance assistant. Tell me what is broken and where — for example: 'The tap in my room is leaking badly.' I'll log the report and assign the best maintenance staff member automatically."

type Stage = 'chat' | 'confirm' | 'done'

export function ChatBot() {
  const { auth, refreshIssues } = useApp()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Bubble[]>([])
  const [draft, setDraft] = useState<AssistantDraft>({})
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const [stage, setStage] = useState<Stage>('chat')
  const bodyRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

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

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const text = input.trim()
    if (!text || thinking) return

    setInput('')

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

    setMessages((prev) => [...prev, makeMessage('user', text)])
    setThinking(true)
    try {
      const result = await apiChat(text, draft, stage === 'confirm')
      setDraft(result.draft)
      setMessages((prev) => [...prev, makeMessage('assistant', result.reply)])
      setStage(result.issue ? 'done' : result.ready ? 'confirm' : 'chat')
      // The report was created and assigned on the server, so reload the lists.
      if (result.issue) refreshIssues()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Something went wrong. Please try again.'
      setMessages((prev) => [...prev, makeMessage('assistant', `Sorry — ${message}`)])
    } finally {
      setThinking(false)
    }
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
