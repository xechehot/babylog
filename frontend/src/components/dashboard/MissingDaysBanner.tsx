import { BR } from '../br/theme'
import { formatDateRu } from './utils'

const MAX_DATES_SHOWN = 5

export function MissingDaysBanner({ missing }: { missing: string[] }) {
  if (missing.length === 0) return null
  const shown = missing.slice(0, MAX_DATES_SHOWN).map(formatDateRu).join(' · ')
  const extra = missing.length - MAX_DATES_SHOWN
  const suffix = extra > 0 ? ` · +${extra} MORE` : ''
  return (
    <div
      className="mx-5 mt-3 px-3 py-2 uppercase"
      style={{
        border: `1px solid ${BR.amber}`,
        background: 'rgba(255,179,71,0.06)',
        fontFamily: BR.mono,
        fontSize: 10,
        letterSpacing: 1.5,
        color: BR.amber,
        textShadow: `0 0 8px ${BR.amberGlow}`,
      }}
    >
      ⚠ MISSING DATA: {shown}
      {suffix}
    </div>
  )
}
