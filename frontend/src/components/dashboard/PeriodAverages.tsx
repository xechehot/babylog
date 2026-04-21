import { BR } from '../br/theme'
import { ReadoutTile } from '../br/ReadoutTile'
import type { PeriodAveragesResult } from './periodAverages'

function fmtCount(v: number | null): string {
  if (v == null) return '—'
  return Number.isInteger(v) ? v.toString() : v.toFixed(1)
}

function fmtHours(v: number | null): string {
  if (v == null) return '—'
  return v.toFixed(1)
}

function fmtMl(v: number | null): string {
  if (v == null) return '—'
  return Math.round(v).toString()
}

export function PeriodAverages({ result }: { result: PeriodAveragesResult }) {
  const n = result.loggedDayCount
  return (
    <div className="px-5 grid grid-cols-2 gap-3">
      <ReadoutTile
        label="INTAKE / DAY"
        value={fmtMl(result.mlPerDay)}
        unit="ml"
        note={n > 0 ? `${n} logged day${n === 1 ? '' : 's'}` : undefined}
      />
      <ReadoutTile
        label="BREAST / DAY"
        value={fmtCount(result.breastPerDay)}
        unit="×"
        accent={BR.rose}
      />
      <ReadoutTile label="FORMULA / DAY" value={fmtCount(result.formulaPerDay)} unit="×" />
      <ReadoutTile label="WET / DAY" value={fmtCount(result.wetPerDay)} unit="×" accent={BR.cyan} />
      <ReadoutTile
        label="SOIL / DAY"
        value={fmtCount(result.soilPerDay)}
        unit="×"
        accent={BR.stool}
      />
      <ReadoutTile label="FEED INT" value={fmtHours(result.feedingInterval)} unit="h" />
      <ReadoutTile
        label="BREAST INT"
        value={fmtHours(result.breastInterval)}
        unit="h"
        accent={BR.rose}
      />
      <ReadoutTile label="FORMULA INT" value={fmtHours(result.formulaInterval)} unit="h" />
      <ReadoutTile
        label="DIAPER INT"
        value={fmtHours(result.diaperInterval)}
        unit="h"
        accent={BR.cyan}
      />
    </div>
  )
}
