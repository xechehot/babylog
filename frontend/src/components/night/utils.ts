/** Formats a Date as local "HH:MM". */
export function formatClock(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** Formats a Date as a local ISO string the backend accepts (no timezone suffix). */
export function toLocalISO(d: Date | null): string | null {
  if (!d) return null
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  )
}

/**
 * Resolves a bare "HH:MM" to its most recent past occurrence within 24 hours.
 *
 * The time field carries no date, so entering 23:30 just after midnight has to
 * mean last night. Attaching today's date instead would place the feeding
 * almost a day in the future and predict nonsense.
 */
export function resolveClockTime(value: string, now: Date): Date | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim())
  if (!match) return null

  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return null

  const resolved = new Date(now)
  resolved.setHours(hours, minutes, 0, 0)
  if (resolved.getTime() > now.getTime()) {
    resolved.setDate(resolved.getDate() - 1)
  }
  return resolved
}

/** Rounds to the nearest five minutes, matching how the backend reports times. */
export function roundToFiveMinutes(d: Date): Date {
  const rounded = new Date(d)
  rounded.setSeconds(0, 0)
  rounded.setMinutes(Math.round(rounded.getMinutes() / 5) * 5)
  return rounded
}
