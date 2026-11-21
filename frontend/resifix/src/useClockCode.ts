import QRCode from 'qrcode'
import { useCallback, useEffect, useState } from 'react'
import { fetchClockInCode } from './api'
import type { ClockCode } from './types'

// The clock-in code to show, kept current: the printed daily code is checked every few minutes
// (so a page left open overnight gets the new day's code); the wall-screen code is fetched again
// the moment it changes. reload() fetches straight away (after a new code or a mode change).
export function useClockCode() {
  const [code, setCode] = useState<ClockCode | null>(null)
  const [error, setError] = useState('')
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let timer: number | undefined
    let current = true
    fetchClockInCode()
      .then((c) => {
        if (!current) return
        setCode(c)
        setError('')
        const wait = c.changesAt ? Math.max(500, Date.parse(c.changesAt) - Date.now() + 300) : 5 * 60 * 1000
        timer = window.setTimeout(() => setTick((t) => t + 1), wait)
      })
      .catch((err) => {
        if (!current) return
        setError(err instanceof Error ? err.message : 'Could not load the clock-in code')
        timer = window.setTimeout(() => setTick((t) => t + 1), 10_000)
      })
    return () => {
      current = false
      clearTimeout(timer)
    }
  }, [tick])

  const reload = useCallback(() => setTick((t) => t + 1), [])
  return { code, error, reload }
}

// Phones can't open "localhost" (that would be the phone itself), so the QR code needs the
// computer's network address, e.g. http://192.168.0.238:5173.
export const isLocalOnly = () => ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname)
const clockInLink = (code: string) => `${window.location.origin}${window.location.pathname}#clock-in=${code}`

// The QR code picture (as an image address) for a clock-in code.
export function useQrImage(code: string | undefined, width = 560) {
  const [image, setImage] = useState('')
  useEffect(() => {
    if (!code) return
    let current = true
    QRCode.toDataURL(clockInLink(code), { width, margin: 1, color: { dark: '#0b1f47', light: '#ffffff' } })
      .then((url) => current && setImage(url))
      .catch(() => current && setImage(''))
    return () => {
      current = false
    }
  }, [code, width])
  return image
}
