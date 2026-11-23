import type { CSSProperties } from 'react'
import { BR } from '../br/theme'
import { formatDateRu } from './utils'
import type { AllergenSummary } from './foodAggregates'

/**
 * The eight tracked allergens, stalest first, so the one that needs planning is the top row.
 *
 * Exposure counts are period-scoped; "last given" and "days ago" are all-time, because when
 * he last had fish is not a question about the selected range.
 */
export function AllergenPanel({ summary }: { summary: AllergenSummary }) {
  const { stats, taggedMeals, untaggedMeals } = summary

  const headerStyle: CSSProperties = {
    fontFamily: BR.mono,
    fontSize: 9,
    letterSpacing: 2,
    color: BR.dim,
    textTransform: 'uppercase',
    paddingBottom: 6,
    paddingTop: 2,
  }
  const cellStyle: CSSProperties = {
    fontFamily: BR.mono,
    fontSize: 11,
    color: BR.body,
    padding: '7px 0',
    borderTop: `1px solid ${BR.line}`,
    fontVariantNumeric: 'tabular-nums',
  }

  if (taggedMeals === 0) {
    return (
      <div
        className="text-center py-4 uppercase"
        style={{
          fontFamily: BR.mono,
          fontSize: 10,
          letterSpacing: 2,
          color: BR.dim,
          border: `1px solid ${BR.line}`,
          background: BR.char,
        }}
      >
        — no tagged meals yet —
      </div>
    )
  }

  return (
    <div style={{ border: `1px solid ${BR.line}`, background: 'rgba(6,8,10,0.4)', padding: 12 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ ...headerStyle, textAlign: 'left' }}>Allergen</th>
            <th style={{ ...headerStyle, textAlign: 'right' }}>Period</th>
            <th style={{ ...headerStyle, textAlign: 'right' }}>All</th>
            <th style={{ ...headerStyle, textAlign: 'right' }}>Last</th>
            <th style={{ ...headerStyle, textAlign: 'right' }}>Ago</th>
          </tr>
        </thead>
        <tbody>
          {stats.map((s) => {
            const never = s.daysSince === null
            // Stale is relative to how often a baby meets an allergen while they are being
            // introduced: a week is fine, two weeks is drifting, never is the real gap.
            const accent = never ? BR.blood : s.daysSince! >= 14 ? BR.amber : BR.leaf
            return (
              <tr key={s.allergen}>
                <td style={{ ...cellStyle, textAlign: 'left' }}>
                  <div style={{ color: accent, letterSpacing: 1.5 }}>{s.label}</div>
                  <div style={{ fontSize: 9, color: BR.dim, letterSpacing: 0.5 }}>{s.labelRu}</div>
                </td>
                <td style={{ ...cellStyle, textAlign: 'right' }}>
                  {s.periodExposures > 0 ? `${s.periodExposures}×` : '—'}
                </td>
                <td style={{ ...cellStyle, textAlign: 'right', color: BR.dim }}>
                  {s.totalExposures > 0 ? `${s.totalExposures}×` : '—'}
                </td>
                <td style={{ ...cellStyle, textAlign: 'right' }}>
                  {s.lastDate ? formatDateRu(s.lastDate) : '—'}
                </td>
                <td style={{ ...cellStyle, textAlign: 'right', color: accent }}>
                  {never ? 'NEVER' : `${s.daysSince}d`}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <div
        className="mt-2 uppercase"
        style={{ fontFamily: BR.mono, fontSize: 9, letterSpacing: 1.5, color: BR.dim }}
      >
        {taggedMeals} tagged meal{taggedMeals === 1 ? '' : 's'} all-time
        {untaggedMeals > 0 && (
          <span style={{ color: BR.amber }}>
            {' · '}
            {untaggedMeals} untagged (run backfill_food_tags.py)
          </span>
        )}
      </div>
    </div>
  )
}
