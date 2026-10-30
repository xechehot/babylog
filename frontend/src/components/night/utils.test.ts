import { describe, it, expect } from 'vitest'
import { resolveClockTime, toLocalISO, roundToFiveMinutes, formatClock } from './utils'

describe('resolveClockTime', () => {
  it('resolves a time earlier today to today', () => {
    const now = new Date('2026-08-05T03:00:00')
    expect(toLocalISO(resolveClockTime('01:15', now))).toBe('2026-08-05T01:15:00')
  })

  it('resolves an evening time entered after midnight to yesterday', () => {
    // typing 23:30 at 00:30 must mean an hour ago, not 23 hours from now
    const now = new Date('2026-08-05T00:30:00')
    expect(toLocalISO(resolveClockTime('23:30', now))).toBe('2026-08-04T23:30:00')
  })

  it('resolves the current time to now', () => {
    const now = new Date('2026-08-05T01:15:00')
    expect(toLocalISO(resolveClockTime('01:15', now))).toBe('2026-08-05T01:15:00')
  })

  it('never resolves to a future time', () => {
    const now = new Date('2026-08-05T01:15:00')
    const resolved = resolveClockTime('01:20', now)
    expect(resolved).not.toBeNull()
    expect(resolved!.getTime()).toBeLessThan(now.getTime())
    expect(toLocalISO(resolved)).toBe('2026-08-04T01:20:00')
  })

  it('handles midnight', () => {
    const now = new Date('2026-08-05T01:15:00')
    expect(toLocalISO(resolveClockTime('00:00', now))).toBe('2026-08-05T00:00:00')
  })

  it('returns null for an unparseable value', () => {
    expect(resolveClockTime('', new Date())).toBeNull()
    expect(resolveClockTime('99:99', new Date())).toBeNull()
  })
})

describe('roundToFiveMinutes', () => {
  it('rounds down below the halfway point', () => {
    expect(formatClock(roundToFiveMinutes(new Date('2026-08-05T01:16:00')))).toBe('01:15')
  })

  it('rounds up at or above the halfway point', () => {
    expect(formatClock(roundToFiveMinutes(new Date('2026-08-05T01:18:00')))).toBe('01:20')
  })

  it('leaves an exact five-minute mark alone', () => {
    expect(formatClock(roundToFiveMinutes(new Date('2026-08-05T01:15:00')))).toBe('01:15')
  })

  it('rolls over the hour', () => {
    expect(formatClock(roundToFiveMinutes(new Date('2026-08-05T01:58:00')))).toBe('02:00')
  })
})

describe('formatClock', () => {
  it('zero-pads to HH:MM', () => {
    expect(formatClock(new Date('2026-08-05T07:05:00'))).toBe('07:05')
  })
})
