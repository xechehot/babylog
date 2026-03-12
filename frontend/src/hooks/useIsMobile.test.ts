import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useIsMobile } from './useIsMobile'

let listeners: ((e: { matches: boolean }) => void)[] = []
let currentMatches = false

beforeEach(() => {
  listeners = []
  currentMatches = false

  vi.stubGlobal('window', {
    ...window,
    matchMedia: vi.fn().mockImplementation(() => ({
      matches: currentMatches,
      addEventListener: (_: string, handler: (e: { matches: boolean }) => void) => {
        listeners.push(handler)
      },
      removeEventListener: (_: string, handler: (e: { matches: boolean }) => void) => {
        listeners = listeners.filter((l) => l !== handler)
      },
    })),
  })
})

describe('useIsMobile', () => {
  it('returns false for desktop viewport', () => {
    currentMatches = false
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(false)
  })

  it('returns true for mobile viewport', () => {
    currentMatches = true
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(true)
  })

  it('updates when viewport changes', () => {
    currentMatches = false
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(false)

    act(() => {
      listeners.forEach((l) => l({ matches: true }))
    })
    expect(result.current).toBe(true)
  })

  it('cleans up listener on unmount', () => {
    const { unmount } = renderHook(() => useIsMobile())
    expect(listeners.length).toBe(1)
    unmount()
    expect(listeners.length).toBe(0)
  })
})
