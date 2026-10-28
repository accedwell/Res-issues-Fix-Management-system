import { useEffect, useRef, useState } from 'react'
import { Icon } from './Icon'
import { apiCallSignal, type CallSignal, type CallSignalType } from '../api'
import { onCallEvents, type CallTarget } from '../callBus'

// Voice calls between a student and the staff member on their report, started from the chat.
// The voice goes straight between the two browsers (WebRTC); the server only passes the set-up
// messages. Both people must have ResiFix open, and the microphone needs https or localhost.

type Phase = 'idle' | 'calling' | 'ringing' | 'active'

const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }]
const RING_SECONDS = 30

// A soft repeating beep for an incoming call. Returns a function that stops it.
function playRingtone(): () => void {
  try {
    const ctx = new AudioContext()
    const beep = () => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.frequency.value = 880
      gain.gain.value = 0.08
      osc.connect(gain).connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + 0.35)
    }
    beep()
    const timer = setInterval(beep, 1500)
    return () => {
      clearInterval(timer)
      void ctx.close()
    }
  } catch {
    return () => {}
  }
}

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

export function CallManager() {
  const [phase, setPhaseState] = useState<Phase>('idle')
  const [call, setCallState] = useState<CallTarget | null>(null)
  const [muted, setMuted] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [notice, setNotice] = useState('')

  // The event handlers are registered once, so they read the current call from refs.
  const phaseRef = useRef<Phase>('idle')
  const callRef = useRef<CallTarget | null>(null)
  const pc = useRef<RTCPeerConnection | null>(null)
  const mic = useRef<MediaStream | null>(null)
  const offer = useRef<RTCSessionDescriptionInit | null>(null)
  const pendingIce = useRef<RTCIceCandidateInit[]>([])
  const remoteAudio = useRef<HTMLAudioElement>(null)
  const stopRing = useRef<() => void>(() => {})
  const timers = useRef<number[]>([])

  const currentPhase = () => phaseRef.current
  const setPhase = (p: Phase) => {
    phaseRef.current = p
    setPhaseState(p)
  }
  const setCall = (c: CallTarget | null) => {
    callRef.current = c
    setCallState(c)
  }
  const send = (type: CallSignalType, data?: unknown) =>
    callRef.current ? apiCallSignal(callRef.current.issueId, type, data).catch(() => ({ delivered: false })) : Promise.resolve({ delivered: false })

  // Hangs everything up and shows a short message ("Call ended", "No answer"...).
  const finish = (message = '') => {
    stopRing.current()
    timers.current.forEach((t) => clearTimeout(t))
    timers.current = []
    pc.current?.close()
    pc.current = null
    mic.current?.getTracks().forEach((t) => t.stop())
    mic.current = null
    offer.current = null
    pendingIce.current = []
    setPhase('idle')
    setCall(null)
    setMuted(false)
    setNotice(message)
    if (message) timers.current.push(window.setTimeout(() => setNotice(''), 4000))
  }

  const openMic = async () => {
    try {
      mic.current = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      return true
    } catch {
      finish('The microphone could not be opened. Allow microphone access and try again.')
      return false
    }
  }

  const connect = (issueId: string) => {
    const peer = new RTCPeerConnection({ iceServers: ICE_SERVERS })
    peer.onicecandidate = (e) => {
      if (e.candidate) void apiCallSignal(issueId, 'ice', e.candidate.toJSON()).catch(() => undefined)
    }
    peer.ontrack = (e) => {
      if (remoteAudio.current) remoteAudio.current.srcObject = e.streams[0]
    }
    peer.onconnectionstatechange = () => {
      if (peer.connectionState === 'failed') {
        void send('end')
        finish('The call dropped. The connection may be too weak — try again or use the chat.')
      }
    }
    mic.current?.getTracks().forEach((t) => peer.addTrack(t, mic.current as MediaStream))
    pc.current = peer
    return peer
  }

  const addPendingIce = async () => {
    for (const c of pendingIce.current) await pc.current?.addIceCandidate(c).catch(() => undefined)
    pendingIce.current = []
  }

  const goLive = () => {
    stopRing.current()
    timers.current.forEach((t) => clearTimeout(t))
    timers.current = []
    setSeconds(0)
    setPhase('active')
  }

  // Calling out, from the chat's phone button.
  const start = async (target: CallTarget) => {
    if (phaseRef.current !== 'idle') return
    if (!navigator.mediaDevices?.getUserMedia || typeof RTCPeerConnection === 'undefined') {
      setNotice('Calls are not supported in this browser.')
      return
    }
    setCall(target)
    setNotice('')
    setPhase('calling')
    if (!(await openMic())) return
    const peer = connect(target.issueId)
    const description = await peer.createOffer()
    await peer.setLocalDescription(description)
    const { delivered } = await send('ring', description)
    // Read the phase again: the call may have been cancelled while the ring was being sent.
    if (currentPhase() !== 'calling') return
    if (!delivered) {
      finish(`${target.name} is not on ResiFix right now. They will see a missed call.`)
      return
    }
    timers.current.push(
      window.setTimeout(() => {
        if (phaseRef.current !== 'calling') return
        void send('missed')
        finish('No answer. They will see a missed call.')
      }, RING_SECONDS * 1000),
    )
  }

  const onSignal = async (s: CallSignal) => {
    if (s.type === 'ring') {
      // Already on a call (or ringing): tell the caller.
      if (phaseRef.current !== 'idle') {
        void apiCallSignal(s.issueId, 'busy').catch(() => undefined)
        return
      }
      setCall({ issueId: s.issueId, ref: s.ref, name: s.from })
      offer.current = s.data as RTCSessionDescriptionInit
      setNotice('')
      setPhase('ringing')
      stopRing.current = playRingtone()
      timers.current.push(window.setTimeout(() => phaseRef.current === 'ringing' && finish('Missed call.'), (RING_SECONDS + 5) * 1000))
      return
    }
    // Everything else belongs to the current call.
    if (!callRef.current || s.issueId !== callRef.current.issueId) return
    if (s.type === 'answer' && phaseRef.current === 'calling') {
      await pc.current?.setRemoteDescription(s.data as RTCSessionDescriptionInit)
      await addPendingIce()
      goLive()
    } else if (s.type === 'ice') {
      if (pc.current?.remoteDescription) await pc.current.addIceCandidate(s.data as RTCIceCandidateInit).catch(() => undefined)
      else pendingIce.current.push(s.data as RTCIceCandidateInit)
    } else if (s.type === 'decline') finish('Call declined.')
    else if (s.type === 'busy') finish(`${callRef.current.name} is on another call.`)
    else if (s.type === 'end' || s.type === 'missed') finish(phaseRef.current === 'ringing' ? 'Missed call.' : 'Call ended.')
  }

  const accept = async () => {
    const target = callRef.current
    if (!target || !offer.current) return
    stopRing.current()
    if (!(await openMic())) {
      void apiCallSignal(target.issueId, 'decline').catch(() => undefined)
      return
    }
    const peer = connect(target.issueId)
    await peer.setRemoteDescription(offer.current)
    await addPendingIce()
    const answer = await peer.createAnswer()
    await peer.setLocalDescription(answer)
    await send('answer', answer)
    goLive()
  }

  const decline = () => {
    void send('decline')
    finish()
  }

  const hangUp = () => {
    void send('end')
    finish('Call ended.')
  }

  const toggleMute = () => {
    const next = !muted
    mic.current?.getAudioTracks().forEach((t) => (t.enabled = !next))
    setMuted(next)
  }

  // Listen for call messages and chat "call" buttons for as long as the app is open.
  const handlers = useRef({ signal: onSignal, start })
  useEffect(() => {
    handlers.current = { signal: onSignal, start }
  })
  useEffect(
    () =>
      onCallEvents({
        signal: (s) => void handlers.current.signal(s),
        start: (t) => void handlers.current.start(t),
      }),
    [],
  )

  // Call timer.
  useEffect(() => {
    if (phase !== 'active') return
    const t = window.setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => clearInterval(t)
  }, [phase])

  // Hang up if the person logs out or closes the app mid-call.
  useEffect(
    () => () => {
      if (phaseRef.current !== 'idle') void send('end')
      finish()
    },
    [],
  )

  return (
    <>
      <audio ref={remoteAudio} autoPlay />
      {phase !== 'idle' && call && (
        <div className={'call-panel ' + phase} role="dialog" aria-label="Voice call">
          <div className="call-avatar">
            <Icon name="phone" />
          </div>
          <div className="call-info">
            <b>{call.name}</b>
            <span>
              {phase === 'calling' && 'Calling…'}
              {phase === 'ringing' && 'Incoming call'}
              {phase === 'active' && clock(seconds)} · {call.ref}
            </span>
          </div>
          <div className="call-actions">
            {phase === 'ringing' ? (
              <>
                <button className="call-btn decline" onClick={decline} aria-label="Decline">
                  <Icon name="phone-off" />
                </button>
                <button className="call-btn accept" onClick={() => void accept()} aria-label="Accept">
                  <Icon name="phone" />
                </button>
              </>
            ) : (
              <>
                {phase === 'active' && (
                  <button className={'call-btn' + (muted ? ' on' : '')} onClick={toggleMute} aria-label={muted ? 'Unmute' : 'Mute'}>
                    <Icon name={muted ? 'mic-off' : 'mic'} />
                  </button>
                )}
                <button className="call-btn decline" onClick={hangUp} aria-label="Hang up">
                  <Icon name="phone-off" />
                </button>
              </>
            )}
          </div>
        </div>
      )}
      {phase === 'idle' && notice && (
        <div className="call-panel notice" role="status">
          <Icon name="phone" /> <span>{notice}</span>
        </div>
      )}
    </>
  )
}
