import { describe, expect, it } from 'vitest'
import {
  displayedSize,
  fitWithin,
  jpegFilename,
  percentToDisplayedRect,
  sourceRect,
  type Rotation,
} from './cropImage'

const landscape = { width: 100, height: 50 }

describe('displayedSize', () => {
  it('keeps dimensions for half turns', () => {
    expect(displayedSize(landscape, 0)).toEqual({ width: 100, height: 50 })
    expect(displayedSize(landscape, 2)).toEqual({ width: 100, height: 50 })
  })

  it('swaps dimensions for quarter turns', () => {
    expect(displayedSize(landscape, 1)).toEqual({ width: 50, height: 100 })
    expect(displayedSize(landscape, 3)).toEqual({ width: 50, height: 100 })
  })
})

describe('sourceRect', () => {
  it('passes the rectangle through when unrotated', () => {
    const rect = { x: 10, y: 5, width: 40, height: 20 }
    expect(sourceRect(landscape, rect, 0)).toEqual(rect)
  })

  it.each([0, 1, 2, 3] as Rotation[])(
    'maps the full displayed image back to the whole source (rotation %i)',
    (rotation) => {
      const display = displayedSize(landscape, rotation)
      expect(sourceRect(landscape, { x: 0, y: 0, ...display }, rotation)).toEqual({
        x: 0,
        y: 0,
        width: 100,
        height: 50,
      })
    },
  )

  it('maps the displayed top-left corner to the source bottom-left after a quarter turn', () => {
    // Rotating clockwise moves the source's bottom-left corner to the top-left.
    expect(sourceRect(landscape, { x: 0, y: 0, width: 25, height: 50 }, 1)).toEqual({
      x: 0,
      y: 25,
      width: 50,
      height: 25,
    })
  })

  it('maps the displayed top-left corner to the source top-right after three quarter turns', () => {
    expect(sourceRect(landscape, { x: 0, y: 0, width: 25, height: 50 }, 3)).toEqual({
      x: 50,
      y: 0,
      width: 50,
      height: 25,
    })
  })

  it('mirrors both axes for a half turn', () => {
    expect(sourceRect(landscape, { x: 10, y: 5, width: 40, height: 20 }, 2)).toEqual({
      x: 50,
      y: 25,
      width: 40,
      height: 20,
    })
  })
})

describe('percentToDisplayedRect', () => {
  it('resolves percentages against the rotated image', () => {
    expect(percentToDisplayedRect(landscape, 1, { x: 0, y: 50, width: 100, height: 50 })).toEqual({
      x: 0,
      y: 50,
      width: 50,
      height: 50,
    })
  })

  it('clamps a rectangle that runs past the edge', () => {
    expect(percentToDisplayedRect(landscape, 0, { x: 80, y: 0, width: 40, height: 100 })).toEqual({
      x: 80,
      y: 0,
      width: 20,
      height: 50,
    })
  })

  it('never returns a zero-sized rectangle', () => {
    const rect = percentToDisplayedRect(landscape, 0, { x: 0, y: 0, width: 0, height: 0 })
    expect(rect.width).toBeGreaterThan(0)
    expect(rect.height).toBeGreaterThan(0)
  })
})

describe('fitWithin', () => {
  it('shrinks the longest edge to the cap', () => {
    expect(fitWithin({ width: 4000, height: 3000 }, 2400)).toEqual({ width: 2400, height: 1800 })
  })

  it('leaves smaller images alone', () => {
    expect(fitWithin({ width: 800, height: 600 }, 2400)).toEqual({ width: 800, height: 600 })
  })
})

describe('jpegFilename', () => {
  it('replaces the extension', () => {
    expect(jpegFilename('IMG_0042.HEIC')).toBe('IMG_0042.jpg')
  })

  it('appends one when there is none', () => {
    expect(jpegFilename('scan')).toBe('scan.jpg')
  })

  it('falls back for a name that is only an extension', () => {
    expect(jpegFilename('.jpeg')).toBe('scan.jpg')
  })
})
