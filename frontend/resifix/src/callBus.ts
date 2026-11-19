import type { CallSignal } from './api'

// Connects the parts of the app that deal with voice calls: the live-update connection delivers
// call messages, the chat starts calls, and CallManager (always on screen) handles both.

export interface CallTarget {
  issueId: string
  ref: string
  name: string // who is being called
}

const bus = new EventTarget()

export const emitCallSignal = (signal: CallSignal) => bus.dispatchEvent(new CustomEvent('signal', { detail: signal }))
export const startCall = (target: CallTarget) => bus.dispatchEvent(new CustomEvent('start', { detail: target }))

export function onCallEvents(handlers: { signal: (s: CallSignal) => void; start: (t: CallTarget) => void }) {
  const signal = (e: Event) => handlers.signal((e as CustomEvent<CallSignal>).detail)
  const start = (e: Event) => handlers.start((e as CustomEvent<CallTarget>).detail)
  bus.addEventListener('signal', signal)
  bus.addEventListener('start', start)
  return () => {
    bus.removeEventListener('signal', signal)
    bus.removeEventListener('start', start)
  }
}
