import jsQR from 'jsqr'
import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from './Icon'

// Reads the clock-in QR code inside ResiFix. With a live camera it scans by itself; where the
// browser blocks the live camera (a phone opening ResiFix over http on the Wi-Fi), the technician
// takes a photo of the QR code instead and it is read from the photo.

// The QR code holds a link ending in #clock-in=CODE. A plain code is accepted too.
function codeFromQr(text: string): string | null {
  const link = /clock-in=([A-Za-z0-9]{4,12})/.exec(text)
  if (link) return link[1].toUpperCase()
  const plain = text.trim()
  return /^[A-Za-z0-9]{4,12}$/.test(plain) ? plain.toUpperCase() : null
}

function readQr(source: CanvasImageSource, width: number, height: number): string | null {
  // Big photos are scaled down: quicker, and jsQR copes better.
  const scale = Math.min(1, 1000 / Math.max(width, height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(width * scale)
  canvas.height = Math.round(height * scale)
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height)
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height)
  return jsQR(image.data, image.width, image.height)?.data ?? null
}

const canUseLiveCamera = () => window.isSecureContext && !!navigator.mediaDevices?.getUserMedia

export function QrScanner({ onCode, close }: { onCode: (code: string) => void; close: () => void }) {
  const video = useRef<HTMLVideoElement>(null)
  const photoInput = useRef<HTMLInputElement>(null)
  const [live] = useState(canUseLiveCamera)
  const [error, setError] = useState('')
  const done = useRef(false)

  const found = (text: string | null) => {
    if (done.current || !text) return false
    const code = codeFromQr(text)
    if (!code) {
      setError('That is not the ResiFix clock-in QR code.')
      return false
    }
    done.current = true
    onCode(code)
    return true
  }

  // Live camera: look for a QR code a few times a second.
  useEffect(() => {
    if (!live) return
    let stream: MediaStream | null = null
    let timer: number | undefined
    let current = true
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then((s) => {
        if (!current) return s.getTracks().forEach((t) => t.stop())
        stream = s
        if (video.current) video.current.srcObject = s
        timer = window.setInterval(() => {
          const v = video.current
          if (!v || !v.videoWidth || done.current) return
          const text = readQr(v, v.videoWidth, v.videoHeight)
          if (text) found(text)
        }, 250)
      })
      .catch(() => current && setError('The camera could not be opened. Allow camera access, or take a photo instead.'))
    return () => {
      current = false
      clearInterval(timer)
      stream?.getTracks().forEach((t) => t.stop())
    }
    // found only reads refs and calls the parent; it does not need to restart the camera.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live])

  const fromPhoto = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError('')
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const text = readQr(img, img.naturalWidth, img.naturalHeight)
      URL.revokeObjectURL(url)
      if (!text) setError('No QR code found in that photo. Hold the phone closer and keep the whole code in the picture.')
      else found(text)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      setError('That photo could not be opened.')
    }
    img.src = url
  }

  // Drawn on the page body, so the card it is opened from can't clip or shift it.
  return createPortal(
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && close()}>
      <div className="modal camera-modal">
        <h3>Scan the clock-in QR code</h3>
        <p className="modal-sub">
          {live ? 'Point your camera at the QR code at the maintenance office.' : 'Take a photo of the QR code at the maintenance office.'}
        </p>
        {live && !error && <video ref={video} className="camera-view qr-view" autoPlay playsInline muted />}
        {error && <div className="field-error">{error}</div>}
        <input ref={photoInput} type="file" accept="image/*" capture="environment" hidden onChange={fromPhoto} />
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={close}>
            Cancel
          </button>
          <button
            type="button"
            className={'btn ' + (live && !error ? 'btn-ghost' : 'btn-primary')}
            onClick={() => photoInput.current?.click()}
          >
            <Icon name="camera" /> {live ? 'Use a photo instead' : 'Take photo of QR code'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
