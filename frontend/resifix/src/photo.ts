import type { PhotoUpload } from './types'

// Report photos are shrunk in the browser before upload, so a 10 MB phone picture becomes a few
// hundred KB. The server accepts up to 5 MB.

const MAX_SIDE = 1600
const QUALITY = 0.82
const MAX_ORIGINAL_BYTES = 20 * 1024 * 1024

export interface PreparedPhoto {
  upload: PhotoUpload
  preview: string // data URL to show before submitting
}

// Phones open their own camera app from a file input with "capture". Laptops ignore that, so there
// the webcam is shown in a dialog instead. The webcam needs https or localhost.
export const canUseWebcam = () =>
  !window.matchMedia('(pointer: coarse)').matches && window.isSecureContext && !!navigator.mediaDevices?.getUserMedia

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('That photo could not be opened. Try a JPEG or PNG picture.'))
    }
    img.src = url
  })
}

export async function preparePhoto(file: File): Promise<PreparedPhoto> {
  if (!file.type.startsWith('image/')) throw new Error('Please choose a picture (JPEG or PNG).')
  if (file.size > MAX_ORIGINAL_BYTES) throw new Error('That photo is too big. Please choose one under 20 MB.')

  const img = await loadImage(file)
  const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(img.naturalWidth * scale)
  canvas.height = Math.round(img.naturalHeight * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Your browser could not prepare the photo.')
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

  const preview = canvas.toDataURL('image/jpeg', QUALITY)
  return { preview, upload: { mimeType: 'image/jpeg', data: preview.slice(preview.indexOf(',') + 1) } }
}
