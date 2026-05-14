import type { CSSProperties } from 'react'
import { BR } from '../br/theme'
import { formatDateRu } from './utils'
import type { Entry } from '../../types'

export interface WeightRow {
  dateStr: string | null // YYYY-MM-DD for display; null if birth row and no birth_date
  weightGrams: number
  days: number | null // null = unknown (no birth_date for first row)
  gainGrams: number | null // null for birth row
  pctPrev: number | null // null for birth row; % change from previous entry
  gPerWeek: number | null // null for birth row, or when days <= 0
  isBirth: boolean
}

function daysBetween(fromDateStr: string, toDateStr: string): number {
  const from = new Date(fromDateStr + 'T00:00:00').getTime()
  const to = new Date(toDateStr + 'T00:00:00').getTime()
  return Math.round((to - from) / (1000 * 60 * 60 * 24))
}

export function buildWeightRows(
  entries: Entry[],
  birthWeight: number,
  birthDate: string | null,
): WeightRow[] {
  const sorted = entries
    .filter((e) => e.value != null && e.value > 0)
    .sort((a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime())

  const birthRow: WeightRow = {
    dateStr: birthDate,
    weightGrams: birthWeight,
    days: null,
    gainGrams: null,
    pctPrev: null,
    gPerWeek: null,
    isBirth: true,
  }

  const rows: WeightRow[] = [birthRow]

  for (let i = 0; i < sorted.length; i++) {
    const entry = sorted[i]
    const prevWeight = i === 0 ? birthWeight : sorted[i - 1].value!
    const prevDate = i === 0 ? birthDate : sorted[i - 1].date

    const days = prevDate != null ? daysBetween(prevDate, entry.date) : null
    const gainGrams = entry.value! - prevWeight
    const pctPrev = (gainGrams / prevWeight) * 100
    const gPerWeek = days != null && days > 0 ? Math.round((gainGrams / days) * 7) : null

    rows.push({
      dateStr: entry.date,
      weightGrams: entry.value!,
      days,
      gainGrams,
      pctPrev,
      gPerWeek,
      isBirth: false,
    })
  }

  return rows
}

function fmtKg(grams: number): string {
  return (grams / 1000).toFixed(3) + ' kg'
}

function fmtGain(g: number | null): { text: string; color: string } {
  if (g === null) return { text: '—', color: BR.dim }
  if (g === 0) return { text: '±0 g', color: BR.dim }
  const sign = g > 0 ? '+' : '−'
  return {
    text: `${sign}${Math.abs(g)} g`,
    color: g > 0 ? BR.cyan : BR.blood,
  }
}

function fmtPct(pct: number | null): { text: string; color: string } {
  if (pct === null) return { text: '—', color: BR.dim }
  if (Math.abs(pct) < 0.05) return { text: '±0.0%', color: BR.dim }
  const sign = pct > 0 ? '+' : '−'
  return {
    text: `${sign}${Math.abs(pct).toFixed(1)}%`,
    color: pct > 0 ? BR.cyan : BR.blood,
  }
}

function fmtGPerWeek(gpw: number | null): { text: string; color: string } {
  if (gpw === null) return { text: '—', color: BR.dim }
  if (gpw === 0) return { text: '±0', color: BR.dim }
  const sign = gpw > 0 ? '+' : '−'
  return {
    text: `${sign}${Math.abs(gpw)}`,
    color: gpw > 0 ? BR.cyan : BR.blood,
  }
}

interface WeightTableProps {
  entries: Entry[]
  birthWeight: number
  birthDate: string | null
}

export function WeightTable({ entries, birthWeight, birthDate }: WeightTableProps) {
  const rows = buildWeightRows(entries, birthWeight, birthDate)

  const headerStyle: CSSProperties = {
    fontFamily: BR.mono,
    fontSize: 9,
    letterSpacing: 2,
    color: BR.dim,
    textTransform: 'uppercase',
    paddingBottom: 4,
    paddingTop: 2,
  }

  const cellStyle: CSSProperties = {
    fontFamily: BR.mono,
    fontSize: 11,
    paddingTop: 5,
    paddingBottom: 5,
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {['DATE', 'WEIGHT', 'DAYS', '+G', '%∆', 'G/WK'].map((h) => (
              <th
                key={h}
                scope="col"
                style={{ ...headerStyle, textAlign: 'left', fontWeight: 400 }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const gain = fmtGain(row.gainGrams)
            const pct = fmtPct(row.pctPrev)
            const gpw = fmtGPerWeek(row.gPerWeek)
            return (
              <tr
                key={row.isBirth ? 'birth' : (row.dateStr ?? String(i))}
                style={{ borderTop: `1px solid rgba(215,200,180,0.08)` }}
              >
                <td
                  style={{
                    ...cellStyle,
                    color: row.isBirth ? BR.rose : 'rgba(215,200,180,0.7)',
                    paddingRight: 8,
                  }}
                >
                  {row.dateStr ? formatDateRu(row.dateStr) : '—'}
                  {row.isBirth && (
                    <span style={{ color: BR.dim, marginLeft: 4, fontSize: 9 }}>★</span>
                  )}
                </td>
                <td style={{ ...cellStyle, color: 'rgba(215,200,180,0.9)', paddingRight: 8 }}>
                  {fmtKg(row.weightGrams)}
                </td>
                <td style={{ ...cellStyle, color: BR.dim, paddingRight: 8 }}>
                  {row.days != null ? row.days : '—'}
                </td>
                <td style={{ ...cellStyle, color: gain.color, paddingRight: 8 }}>{gain.text}</td>
                <td style={{ ...cellStyle, color: pct.color, paddingRight: 8 }}>{pct.text}</td>
                <td style={{ ...cellStyle, color: gpw.color }}>{gpw.text}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
