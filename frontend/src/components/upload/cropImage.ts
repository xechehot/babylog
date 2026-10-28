/** Quarter turns clockwise applied to the source image before cropping. */
export type Rotation = 0 | 1 | 2 | 3

export interface Size {
  width: number
  height: number
}

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/** Crop rectangle as percentages of the displayed (rotated) image, as react-image-crop reports it. */
export interface PercentRect {
  x: number
  y: number
  width: number
  height: number
}

const PREVIEW_MAX_EDGE = 1400
const OUTPUT_MAX_EDGE = 2400
const JPEG_QUALITY = 0.9

/** Size of the image as the user sees it after `rotation` quarter turns. */
export function displayedSize(natural: Size, rotation: Rotation): Size {
  return rotation % 2 === 0
    ? { width: natural.width, height: natural.height }
    : { width: natural.height, height: natural.width }
}

/**
 * Map a crop rectangle expressed in displayed (rotated) pixels back to the
 * source image's own coordinates, so we can crop the original at full quality.
 */
export function sourceRect(natural: Size, displayed: Rect, rotation: Rotation): Rect {
  const { width: nw, height: nh } = natural
  const { x, y, width: w, height: h } = displayed
  switch (rotation) {
    case 1:
      return { x: y, y: nh - x - w, width: h, height: w }
    case 2:
      return { x: nw - x - w, y: nh - y - h, width: w, height: h }
    case 3:
      return { x: nw - y - h, y: x, width: h, height: w }
    default:
      return { x, y, width: w, height: h }
  }
}

/** Resolve a percentage crop against the displayed image, clamped to its bounds. */
export function percentToDisplayedRect(
  natural: Size,
  rotation: Rotation,
  percent: PercentRect,
): Rect {
  const display = displayedSize(natural, rotation)
  const x = Math.max(0, Math.min(display.width, (percent.x / 100) * display.width))
  const y = Math.max(0, Math.min(display.height, (percent.y / 100) * display.height))
  const width = Math.max(1, Math.min(display.width - x, (percent.width / 100) * display.width))
  const height = Math.max(1, Math.min(display.height - y, (percent.height / 100) * display.height))
  return {
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(width),
    height: Math.round(height),
  }
}

/** Shrink to fit within `maxEdge` on the longest side; never upscales. */
export function fitWithin(size: Size, maxEdge: number): Size {
  const scale = Math.min(1, maxEdge / Math.max(size.width, size.height))
  return {
    width: Math.max(1, Math.round(size.width * scale)),
    height: Math.max(1, Math.round(size.height * scale)),
  }
}

/**
 * Draw `rect` of `img` into a canvas of `out` size, rotated clockwise by
 * `rotation` quarter turns. `rect` is in the image's own coordinates.
 */
function drawRotated(img: CanvasImageSource, rect: Rect, rotation: Rotation, out: Size) {
  const canvas = document.createElement('canvas')
  canvas.width = out.width
  canvas.height = out.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context unavailable')

  ctx.imageSmoothingQuality = 'high'
  const offsets: Record<Rotation, [number, number]> = {
    0: [0, 0],
    1: [out.width, 0],
    2: [out.width, out.height],
    3: [0, out.height],
  }
  const [tx, ty] = offsets[rotation]
  ctx.translate(tx, ty)
  ctx.rotate((rotation * Math.PI) / 2)

  const destWidth = rotation % 2 === 0 ? out.width : out.height
  const destHeight = rotation % 2 === 0 ? out.height : out.width
  ctx.drawImage(img, rect.x, rect.y, rect.width, rect.height, 0, 0, destWidth, destHeight)
  return canvas
}

function toBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not encode the cropped image'))),
      'image/jpeg',
      JPEG_QUALITY,
    )
  })
}

/** A downscaled, rotated copy of the whole image for the crop UI to display. */
export async function renderPreview(img: HTMLImageElement, rotation: Rotation): Promise<string> {
  const natural = { width: img.naturalWidth, height: img.naturalHeight }
  const out = fitWithin(displayedSize(natural, rotation), PREVIEW_MAX_EDGE)
  const canvas = drawRotated(img, { x: 0, y: 0, ...natural }, rotation, out)
  return URL.createObjectURL(await toBlob(canvas))
}

/** Crop the original image at full resolution and encode it as JPEG. */
export async function renderCrop(
  img: HTMLImageElement,
  percent: PercentRect,
  rotation: Rotation,
): Promise<Blob> {
  const natural = { width: img.naturalWidth, height: img.naturalHeight }
  const displayed = percentToDisplayedRect(natural, rotation, percent)
  const out = fitWithin(displayed, OUTPUT_MAX_EDGE)
  const canvas = drawRotated(img, sourceRect(natural, displayed, rotation), rotation, out)
  return toBlob(canvas)
}

/** Keep the user's filename but mark it JPEG — the backend guesses MIME from it. */
export function jpegFilename(original: string): string {
  const base = original.replace(/\.[^./\\]+$/, '') || 'scan'
  return `${base}.jpg`
}
