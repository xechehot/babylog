import type { CSSProperties } from 'react'
import { BR } from '../br/theme'
import { formatDateRu } from './utils'
import type { FoodGroupDay } from './foodAggregates'
import { FOOD_GROUPS, FOOD_GROUP_COLORS, FOOD_GROUP_LABELS, FOOD_GROUP_LABELS_RU } from './foodTags'

/**
 * Per-day food-group coverage, newest day first — no grams, just whether each group showed up.
 *
 * A lit cell carries the number of meals that day covering the group; an unlit cell is a gap.
 * Days with no solids logged stay in the grid as empty rows, because those are gaps too.
 */
export function FoodGroupGrid({ days }: { days: FoodGroupDay[] }) {
  if (days.length === 0) return null

  const headerStyle: CSSProperties = {
    fontFamily: BR.mono,
    fontSize: 8,
    letterSpacing: 1,
    textTransform: 'uppercase',
    paddingBottom: 6,
    textAlign: 'center',
  }
  const dateCellStyle: CSSProperties = {
    fontFamily: BR.mono,
    fontSize: 10,
    letterSpacing: 1,
    color: BR.body,
    padding: '5px 6px 5px 0',
    borderTop: `1px solid ${BR.line}`,
    whiteSpace: 'nowrap',
  }

  const covered = (group: (typeof FOOD_GROUPS)[number]) =>
    days.filter((d) => d.counts[group] > 0).length

  return (
    <div style={{ border: `1px solid ${BR.line}`, background: 'rgba(6,8,10,0.4)', padding: 12 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ ...headerStyle, textAlign: 'left', color: BR.dim }}>Day</th>
            {FOOD_GROUPS.map((g) => (
              <th key={g} style={{ ...headerStyle, color: FOOD_GROUP_COLORS[g] }}>
                <div>{FOOD_GROUP_LABELS[g]}</div>
                <div style={{ fontSize: 7, color: BR.dim, letterSpacing: 0 }}>
                  {FOOD_GROUP_LABELS_RU[g]}
                </div>
              </th>
            ))}
            <th style={{ ...headerStyle, textAlign: 'right', color: BR.dim }}>Meals</th>
          </tr>
        </thead>
        <tbody>
          {days.map((day) => (
            <tr key={day.date}>
              <td style={dateCellStyle}>{formatDateRu(day.date)}</td>
              {FOOD_GROUPS.map((g) => {
                const count = day.counts[g]
                const color = FOOD_GROUP_COLORS[g]
                return (
                  <td
                    key={g}
                    style={{
                      borderTop: `1px solid ${BR.line}`,
                      padding: '5px 2px',
                      textAlign: 'center',
                    }}
                  >
                    <span
                      className="inline-flex items-center justify-center"
                      style={{
                        width: 22,
                        height: 18,
                        fontFamily: BR.mono,
                        fontSize: 10,
                        fontVariantNumeric: 'tabular-nums',
                        border: `1px solid ${count > 0 ? color : BR.line}`,
                        background: count > 0 ? `${color}22` : 'transparent',
                        color: count > 0 ? color : BR.dim,
                        textShadow: count > 0 ? `0 0 8px ${color}66` : 'none',
                      }}
                    >
                      {count > 0 ? count : '·'}
                    </span>
                  </td>
                )
              })}
              <td
                style={{
                  ...dateCellStyle,
                  textAlign: 'right',
                  color: day.mealCount > 0 ? BR.dim : BR.blood,
                  padding: '5px 0 5px 6px',
                }}
              >
                {day.mealCount > 0 ? day.mealCount : '—'}
                {day.untaggedMeals > 0 && (
                  <span style={{ color: BR.amber }}> ({day.untaggedMeals}?)</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div
        className="mt-2 uppercase"
        style={{ fontFamily: BR.mono, fontSize: 9, letterSpacing: 1.5, color: BR.dim }}
      >
        days covered ·{' '}
        {FOOD_GROUPS.map((g) => (
          <span key={g} style={{ color: FOOD_GROUP_COLORS[g] }}>
            {FOOD_GROUP_LABELS[g]} {covered(g)}/{days.length}
            {g === 'produce' ? '' : ' · '}
          </span>
        ))}
      </div>
    </div>
  )
}
