import { useEffect, useState } from 'react'
import ReactCrop, { type PercentCrop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'
import { BR } from '../br/theme'
import { jpegFilename, renderCrop, renderPreview, type Rotation } from './cropImage'

const FULL_FRAME: PercentCrop = { unit: '%', x: 0, y: 0, width: 100, height: 100 }

interface CropOverlayProps {
  file: File
  onCancel: () => void
  onConfirm: (file: File) => void
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not read that image'))
    img.src = url
  })
}

export function CropOverlay({ file, onCancel, onConfirm }: CropOverlayProps) {
  const [source, setSource] = useState<HTMLImageElement | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [rotation, setRotation] = useState<Rotation>(0)
  const [crop, setCrop] = useState<PercentCrop>(FULL_FRAME)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const url = URL.createObjectURL(file)
    loadImage(url)
      .then((img) => {
        if (!cancelled) setSource(img)
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message)
      })
    return () => {
      cancelled = true
      URL.revokeObjectURL(url)
    }
  }, [file])

  useEffect(() => {
    if (!source) return
    let cancelled = false
    let created: string | null = null
    renderPreview(source, rotation)
      .then((url) => {
        if (cancelled) {
          URL.revokeObjectURL(url)
          return
        }
        created = url
        setPreviewUrl(url)
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message)
      })
    return () => {
      cancelled = true
      if (created) URL.revokeObjectURL(created)
    }
  }, [source, rotation])

  const handleRotate = () => {
    setRotation((r) => ((r + 1) % 4) as Rotation)
    setCrop(FULL_FRAME)
  }

  const uploadDisabled = !source || working

  const handleConfirm = async () => {
    if (!source || working) return
    setWorking(true)
    setError(null)
    try {
      const blob = await renderCrop(source, crop, rotation)
      onConfirm(new File([blob], jpegFilename(file.name), { type: 'image/jpeg' }))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not crop that image')
      setWorking(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: BR.ink }}
      role="dialog"
      aria-label="Crop the scan"
    >
      <div
        className="flex items-center justify-between px-5 py-3 uppercase shrink-0"
        style={{
          borderBottom: `1px solid ${BR.line}`,
          fontFamily: BR.mono,
          fontSize: 10,
          letterSpacing: 3,
          color: BR.amber,
          textShadow: `0 0 10px ${BR.amberGlow}`,
        }}
      >
        <span>CROP · FRAME THE PAGE</span>
        <span style={{ color: BR.dim, letterSpacing: 2 }}>
          {rotation === 0 ? 'ROT 0°' : `ROT ${rotation * 90}°`}
        </span>
      </div>

      <div className="flex-1 min-h-0 flex items-center justify-center p-4 br-crop">
        {previewUrl ? (
          <ReactCrop
            crop={crop}
            onChange={(_, percentCrop) => setCrop(percentCrop)}
            keepSelection
            minWidth={24}
            minHeight={24}
            style={{ maxHeight: '100%' }}
          >
            <img
              src={previewUrl}
              alt="Scan to crop"
              style={{ display: 'block', maxHeight: '70vh', maxWidth: '100%' }}
            />
          </ReactCrop>
        ) : (
          <div
            className="uppercase"
            style={{ fontFamily: BR.mono, fontSize: 10, letterSpacing: 2, color: BR.dim }}
          >
            — loading image —
          </div>
        )}
      </div>

      {error && (
        <div
          className="mx-5 mb-2 px-3 py-2 uppercase shrink-0"
          style={{
            border: `1px solid ${BR.blood}`,
            fontFamily: BR.mono,
            fontSize: 10,
            letterSpacing: 1.5,
            color: BR.blood,
          }}
        >
          [ERR] {error}
        </div>
      )}

      <div
        className="grid gap-2 px-5 py-4 shrink-0"
        style={{ gridTemplateColumns: '1fr 1fr 1.4fr', borderTop: `1px solid ${BR.line}` }}
      >
        <button
          onClick={onCancel}
          disabled={working}
          className="uppercase py-3"
          style={{
            fontFamily: BR.mono,
            fontSize: 10,
            letterSpacing: 2,
            color: BR.dim,
            border: `1px solid ${BR.line}`,
          }}
        >
          CANCEL
        </button>
        <button
          onClick={handleRotate}
          disabled={!previewUrl || working}
          className="uppercase py-3"
          style={{
            fontFamily: BR.mono,
            fontSize: 10,
            letterSpacing: 2,
            color: BR.cyan,
            border: `1px solid ${BR.cyan}`,
            textShadow: `0 0 6px ${BR.cyanGlow}`,
            opacity: !previewUrl || working ? 0.4 : 1,
          }}
        >
          ROTATE ⟳
        </button>
        <button
          onClick={handleConfirm}
          disabled={uploadDisabled}
          className="uppercase py-3"
          style={{
            fontFamily: BR.mono,
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: 2,
            // Filled, so it reads as the primary action next to the outlined ones.
            color: uploadDisabled ? BR.dim : BR.ink,
            background: uploadDisabled ? 'transparent' : BR.amber,
            border: `1px solid ${uploadDisabled ? BR.line : BR.amber}`,
            boxShadow: uploadDisabled ? 'none' : `0 0 18px ${BR.amberGlow}`,
          }}
        >
          {working ? 'PROCESSING…' : 'UPLOAD'}
        </button>
      </div>
    </div>
  )
}
