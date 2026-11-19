import { useEffect, useRef, useState } from 'react'
import { Icon } from './Icon'

// The laptop webcam in a dialog, for "Take a photo" where the browser has no camera app to open.
export function CameraCapture({ onCapture, close }: { onCapture: (file: File) => void; close: () => void }) {
  const video = useRef<HTMLVideoElement>(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let stream: MediaStream | null = null
    let current = true
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then((s) => {
        if (!current) return s.getTracks().forEach((t) => t.stop())
        stream = s
        if (video.current) video.current.srcObject = s
      })
      .catch(() => current && setError('The camera could not be opened. Allow camera access, or upload a photo instead.'))
    return () => {
      current = false
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  const capture = () => {
    const v = video.current
    if (!v || !v.videoWidth) return
    const canvas = document.createElement('canvas')
    canvas.width = v.videoWidth
    canvas.height = v.videoHeight
    canvas.getContext('2d')?.drawImage(v, 0, 0)
    canvas.toBlob(
      (blob) => {
        if (blob) onCapture(new File([blob], 'camera.jpg', { type: 'image/jpeg' }))
        close()
      },
      'image/jpeg',
      0.9,
    )
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && close()}>
      <div className="modal camera-modal">
        <h3>Take a photo</h3>
        <p className="modal-sub">Point your camera at the problem.</p>
        {error ? (
          <div className="field-error">{error}</div>
        ) : (
          <video ref={video} className="camera-view" autoPlay playsInline muted onLoadedData={() => setReady(true)} />
        )}
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={close}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={capture} disabled={!ready || !!error}>
            <Icon name="camera" /> Capture
          </button>
        </div>
      </div>
    </div>
  )
}
