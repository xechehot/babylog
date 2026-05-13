import '../components/dashboard/chartSetup'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '../api/client'
import type {
  AllTimeTotals as AllTimeTotalsData,
  DashboardDay,
  DashboardResponse,
  Entry,
} from '../types'
import { FeedingChart } from '../components/dashboard/FeedingChart'
import { FeedingSpeedChart } from '../components/dashboard/FeedingSpeedChart'
import { FeedingGapChart } from '../components/dashboard/FeedingGapChart'
import { DiaperChart } from '../components/dashboard/DiaperChart'
import { BreastGapChart } from '../components/dashboard/BreastGapChart'
import { DiaperGapChart } from '../components/dashboard/DiaperGapChart'
import { WeightChart } from '../components/dashboard/WeightChart'
import { WeeklyGainBarChart } from '../components/dashboard/WeeklyGainBarChart'
import { WeightTable } from '../components/dashboard/WeightTable'
import { DailyAvgBarChart } from '../components/dashboard/DailyAvgBarChart'
import { FeedingByHourChart } from '../components/dashboard/FeedingByHourChart'
import { COLORS } from '../components/dashboard/chartConfig'
import {
  computeDailyAvgFeedingInterval,
  computeDailyAvgBreastInterval,
  computeDailyAvgDiaperInterval,
  computeDailyBreastCount,
} from '../components/dashboard/dailyAggregates'
import { getDateRange, getTodayStr, formatDateRu } from '../components/dashboard/utils'
import { PeriodAverages } from '../components/dashboard/PeriodAverages.tsx'
import { MissingDaysBanner } from '../components/dashboard/MissingDaysBanner'
import {
  computePeriodAverages,
  findMissingDays,
  getLoggedDays,
} from '../components/dashboard/periodAverages'
import { BR } from '../components/br/theme'
import { PageHead } from '../components/br/PageHead'
import { Rule } from '../components/br/Rule'
import { ReadoutTile } from '../components/br/ReadoutTile'
import { useProfile, formatAge } from '../hooks/useProfile'

export const Route = createFileRoute('/dashboard')({
  component: DashboardPage,
})

type PresetDays = 7 | 14 | 30
const PRESETS: PresetDays[] = [7, 14, 30]

type RangeSelection =
  | { kind: 'preset'; days: PresetDays }
  | { kind: 'custom'; from: string; to: string }

function DashboardPage() {
  const [selection, setSelection] = useState<RangeSelection>({ kind: 'preset', days: 7 })
  const { from_date, to_date } =
    selection.kind === 'preset'
      ? getDateRange(selection.days)
      : { from_date: selection.from, to_date: selection.to }
  const { profile } = useProfile()
  const age = profile.birth_date ? formatAge(profile.birth_date) : null

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['dashboard', { from_date, to_date }],
    queryFn: () =>
      api.get<DashboardResponse>(`/api/dashboard?from_date=${from_date}&to_date=${to_date}`),
  })

  const { data: feedingData } = useQuery({
    queryKey: ['entries', { type: 'feeding', from_date, to_date }],
    queryFn: () =>
      api.get<{ entries: Entry[] }>(
        `/api/entries?type=feeding&from_date=${from_date}&to_date=${to_date}`,
      ),
  })

  const { data: diaperData } = useQuery({
    queryKey: ['entries', { type: 'diaper', from_date, to_date }],
    queryFn: () =>
      api.get<{ entries: Entry[] }>(
        `/api/entries?type=diaper&from_date=${from_date}&to_date=${to_date}`,
      ),
  })

  const { data: weightData } = useQuery({
    queryKey: ['entries', { type: 'weight', from_date, to_date }],
    queryFn: () =>
      api.get<{ entries: Entry[] }>(
        `/api/entries?type=weight&from_date=${from_date}&to_date=${to_date}`,
      ),
  })

  const { data: allWeightData } = useQuery({
    queryKey: ['entries', { type: 'weight' }],
    queryFn: () => api.get<{ entries: Entry[] }>('/api/entries?type=weight'),
  })

  const days = data?.days ?? []
  const yesterdayStr = getRelativeDateStr(-1)
  const dayBeforeStr = getRelativeDateStr(-2)
  const yesterdayData = days.find((d) => d.date === yesterdayStr) ?? null
  const dayBeforeData = days.find((d) => d.date === dayBeforeStr) ?? null
  const yesterdayFeedings = (feedingData?.entries ?? []).filter((e) => e.date === yesterdayStr)
  const yesterdayDiapers = (diaperData?.entries ?? []).filter(
    (e) => e.date === yesterdayStr && e.subtype !== 'dry',
  )

  const entriesReady = feedingData !== undefined && diaperData !== undefined
  const allFeedings = feedingData?.entries ?? []
  const allDiapers = diaperData?.entries ?? []
  const loggedDays = getLoggedDays(allFeedings, allDiapers, from_date, to_date)
  const periodResult = computePeriodAverages({
    days,
    feedingEntries: allFeedings,
    diaperEntries: allDiapers,
    from: from_date,
    to: to_date,
  })
  const missingDays = entriesReady
    ? findMissingDays(from_date, to_date, loggedDays, getTodayStr())
    : []

  return (
    <>
      <PageHead
        kicker="VITALS · INDEX"
        title={
          <>
            Vital <span style={{ color: BR.amber }}>Index</span>
          </>
        }
        meta={[
          `${from_date}→${to_date}`,
          profile.baby_name ? `UNIT ${profile.baby_name.toUpperCase()}` : 'UNIT 04-RZ',
          age ? `AGE ${age.replace(' ', '')}` : null,
        ]}
      />

      <div className="px-5">
        <PeriodSelector selection={selection} onChange={setSelection} />
      </div>

      {isLoading && (
        <p
          className="text-center py-8 uppercase"
          style={{ fontFamily: BR.mono, fontSize: 10, letterSpacing: 2, color: BR.dim }}
        >
          Loading…
        </p>
      )}
      {isError && (
        <p
          className="text-center text-sm mt-4 uppercase px-5"
          style={{
            fontFamily: BR.mono,
            fontSize: 11,
            letterSpacing: 1.5,
            color: BR.blood,
          }}
        >
          [ERR] {(error as Error).message}
        </p>
      )}

      {data && (
        <>
          {/* Hero Weight Card */}
          <HeroWeight latestWeight={data.latest_weight} previousWeight={data.previous_weight} />

          {/* Yesterday Summary */}
          <Rule label="YESTERDAY · 24H" />
          <YesterdaySummary
            yesterday={yesterdayData}
            dayBefore={dayBeforeData}
            feedingEntries={yesterdayFeedings}
            diaperEntries={yesterdayDiapers}
          />

          <MissingDaysBanner missing={missingDays} />
          <Rule label="AVERAGES · PER LOGGED DAY" />
          <PeriodAverages result={periodResult} />

          <Rule label="TOTALS · ALL-TIME" accent={BR.cyan} />
          <AllTimeTotals totals={data.all_time_totals} />

          <Rule label="INTAKE · VOLUME" />
          <ChartArea>{days.length > 0 ? <FeedingChart days={days} /> : <EmptyState />}</ChartArea>

          {feedingData && feedingData.entries.length > 0 && (
            <>
              <Rule label="INTAKE · VELOCITY + GAPS" />
              <ChartArea>
                <FeedingSpeedChart entries={feedingData.entries} />
                <FeedingGapChart entries={feedingData.entries} />
              </ChartArea>

              {computeDailyAvgFeedingInterval(feedingData.entries).length > 0 && (
                <>
                  <SubKicker label="avg feeding interval · h" />
                  <ChartArea>
                    <DailyAvgBarChart
                      data={computeDailyAvgFeedingInterval(feedingData.entries)}
                      color={COLORS.amber400}
                    />
                  </ChartArea>
                </>
              )}

              <Rule label="BREAST" accent={BR.rose} />
              {computeDailyAvgBreastInterval(feedingData.entries).length > 0 && (
                <>
                  <SubKicker label="avg breast interval · h" accent={BR.rose} />
                  <ChartArea>
                    <DailyAvgBarChart
                      data={computeDailyAvgBreastInterval(feedingData.entries)}
                      color={COLORS.pink400}
                    />
                  </ChartArea>
                </>
              )}
              {computeDailyBreastCount(feedingData.entries).length > 0 && (
                <>
                  <SubKicker label="breast feedings · per day" accent={BR.rose} />
                  <ChartArea>
                    <DailyAvgBarChart
                      data={computeDailyBreastCount(feedingData.entries)}
                      color={COLORS.pink400}
                      formatValue={(v) => Math.round(v).toString()}
                    />
                  </ChartArea>
                </>
              )}
              <ChartArea>
                <BreastGapChart entries={feedingData.entries} />
              </ChartArea>
            </>
          )}

          <Rule label="DIAPERS" accent={BR.cyan} />
          <ChartArea>{days.length > 0 ? <DiaperChart days={days} /> : <EmptyState />}</ChartArea>

          {diaperData && diaperData.entries.length > 0 && (
            <>
              {computeDailyAvgDiaperInterval(diaperData.entries).length > 0 && (
                <>
                  <SubKicker label="avg diaper interval · h" accent={BR.cyan} />
                  <ChartArea>
                    <DailyAvgBarChart
                      data={computeDailyAvgDiaperInterval(diaperData.entries)}
                      color={COLORS.green400}
                    />
                  </ChartArea>
                </>
              )}

              <ChartArea>
                <DiaperGapChart entries={diaperData.entries} />
              </ChartArea>
            </>
          )}

          {weightData && (weightData.entries.length >= 2 || profile.birth_weight) && (
            <>
              <Rule label="MASS · WHO NORMS" accent={BR.rose} />
              <ChartArea>
                <WeightChart
                  entries={weightData.entries}
                  birthDate={profile.birth_date}
                  birthWeight={profile.birth_weight}
                  sex={profile.sex}
                />
                <WeeklyGainBarChart
                  entries={weightData.entries}
                  birthDate={profile.birth_date}
                  birthWeight={profile.birth_weight}
                />
              </ChartArea>
            </>
          )}

          {allWeightData && profile.birth_weight && (
            <>
              <Rule label="WEIGHT · LOG" accent={BR.rose} />
              <ChartArea>
                <WeightTable
                  entries={allWeightData.entries}
                  birthWeight={profile.birth_weight}
                  birthDate={profile.birth_date ?? null}
                />
              </ChartArea>
            </>
          )}

          {feedingData && feedingData.entries.length > 0 && (
            <>
              <Rule label="INTAKE · BY HOUR" />
              <ChartArea>
                <FeedingByHourChart entries={feedingData.entries} />
              </ChartArea>
            </>
          )}

          <div className="h-8" />
        </>
      )}
    </>
  )
}

function ChartArea({ children }: { children: React.ReactNode }) {
  return <div className="px-5">{children}</div>
}

function SubKicker({ label, accent = BR.amber }: { label: string; accent?: string }) {
  return (
    <div
      className="px-5 pt-2 pb-1 uppercase"
      style={{
        fontFamily: BR.mono,
        fontSize: 9,
        letterSpacing: 2,
        color: accent,
      }}
    >
      › {label}
    </div>
  )
}

function PeriodSelector({
  selection,
  onChange,
}: {
  selection: RangeSelection
  onChange: (s: RangeSelection) => void
}) {
  const today = getTodayStr()
  const custom = selection.kind === 'custom'
  // Seed the inputs from the currently-active range when switching to custom.
  const initialFrom =
    selection.kind === 'custom' ? selection.from : getDateRange(selection.days).from_date
  const initialTo = custom ? selection.to : today

  function setCustom(from: string, to: string) {
    if (!from || !to) return
    let f = from > today ? today : from
    let t = to > today ? today : to
    // Auto-swap so either endpoint can be edited first regardless of order.
    if (f > t) [f, t] = [t, f]
    onChange({ kind: 'custom', from: f, to: t })
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        className="flex gap-2 flex-wrap"
        style={{ fontFamily: BR.mono, fontSize: 10, letterSpacing: 2 }}
      >
        {PRESETS.map((p) => {
          const on = selection.kind === 'preset' && selection.days === p
          return (
            <button
              key={p}
              onClick={() => onChange({ kind: 'preset', days: p })}
              className="uppercase"
              style={{
                padding: '8px 14px',
                border: `1px solid ${on ? BR.amber : BR.line}`,
                color: on ? BR.amber : BR.dim,
                background: on ? 'rgba(255,179,71,0.08)' : 'transparent',
                textShadow: on ? `0 0 8px ${BR.amberGlow}` : 'none',
                minHeight: 40,
              }}
            >
              {p}D
            </button>
          )
        })}
        <button
          key="custom"
          onClick={() =>
            custom ? undefined : onChange({ kind: 'custom', from: initialFrom, to: initialTo })
          }
          className="uppercase"
          style={{
            padding: '8px 14px',
            border: `1px solid ${custom ? BR.amber : BR.line}`,
            color: custom ? BR.amber : BR.dim,
            background: custom ? 'rgba(255,179,71,0.08)' : 'transparent',
            textShadow: custom ? `0 0 8px ${BR.amberGlow}` : 'none',
            minHeight: 40,
          }}
        >
          CUSTOM
        </button>
        <div className="flex-1" />
        <div className="flex items-center gap-1.5 uppercase" style={{ color: BR.dim }}>
          <span>LIVE</span>
          <span
            className="inline-block rounded-full"
            style={{
              width: 6,
              height: 6,
              background: BR.amber,
              boxShadow: `0 0 8px ${BR.amberGlow}`,
              animation: 'brPulse 1.4s infinite ease-in-out',
            }}
          />
        </div>
      </div>
      {custom && (
        <div
          className="flex gap-2 items-center"
          style={{ fontFamily: BR.mono, fontSize: 10, letterSpacing: 1.5 }}
        >
          <input
            type="date"
            value={selection.from}
            max={today}
            onChange={(e) => setCustom(e.target.value, selection.to)}
            style={{
              padding: '6px 10px',
              border: `1px solid ${BR.line}`,
              color: BR.text,
              background: BR.char,
              fontFamily: BR.mono,
              fontSize: 11,
              colorScheme: 'dark',
            }}
          />
          <span style={{ color: BR.dim }}>→</span>
          <input
            type="date"
            value={selection.to}
            max={today}
            onChange={(e) => setCustom(selection.from, e.target.value)}
            style={{
              padding: '6px 10px',
              border: `1px solid ${BR.line}`,
              color: BR.text,
              background: BR.char,
              fontFamily: BR.mono,
              fontSize: 11,
              colorScheme: 'dark',
            }}
          />
        </div>
      )}
    </div>
  )
}

function HeroWeight({
  latestWeight,
  previousWeight,
}: {
  latestWeight: DashboardResponse['latest_weight']
  previousWeight: DashboardResponse['previous_weight']
}) {
  if (!latestWeight) return null

  const weightKg = (latestWeight.value / 1000).toFixed(2)
  const diffG = previousWeight ? Math.round(latestWeight.value - previousWeight.value) : null
  const diffPct =
    previousWeight && previousWeight.value !== 0
      ? Math.round(((latestWeight.value - previousWeight.value) / previousWeight.value) * 100)
      : null

  return (
    <div className="px-5 mt-3">
      <div
        className="relative overflow-hidden"
        style={{
          padding: 20,
          border: `1px solid ${BR.rose}`,
          background: `radial-gradient(circle at 20% 0%, rgba(255,158,163,0.12), transparent 60%), ${BR.char}`,
        }}
      >
        <div className="absolute top-0 right-0 bottom-0" style={{ width: '55%', opacity: 0.35 }}>
          <svg
            width="100%"
            height="100%"
            viewBox="0 0 160 100"
            preserveAspectRatio="none"
            aria-hidden
          >
            <defs>
              <linearGradient id="br-weight-grad" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor={BR.rose} stopOpacity="0.4" />
                <stop offset="1" stopColor={BR.rose} stopOpacity="0" />
              </linearGradient>
            </defs>
            <path
              d="M0 90 C20 88, 40 82, 60 72 S100 55, 130 40, 160 28"
              stroke={BR.rose}
              strokeWidth="1.5"
              fill="none"
            />
            <path
              d="M0 90 C20 88, 40 82, 60 72 S100 55, 130 40, 160 28 L160 100 L0 100 Z"
              fill="url(#br-weight-grad)"
            />
            {[0, 30, 60, 90, 120, 150].map((x) => (
              <circle key={x} cx={x} cy={90 - x * 0.42} r="1.5" fill={BR.rose} />
            ))}
          </svg>
        </div>
        <div className="relative">
          <div
            className="uppercase"
            style={{
              fontFamily: BR.mono,
              fontSize: 9,
              letterSpacing: 3,
              color: BR.rose,
            }}
          >
            MASS · CURRENT
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span
              style={{
                fontFamily: BR.display,
                fontSize: 52,
                fontWeight: 500,
                letterSpacing: -2,
                color: BR.text,
                textShadow: `0 0 18px rgba(255,158,163,0.55)`,
              }}
            >
              {weightKg}
            </span>
            <span
              style={{
                fontFamily: BR.mono,
                fontSize: 14,
                color: BR.rose,
                letterSpacing: 2,
              }}
            >
              KG
            </span>
          </div>
          <div
            className="mt-1 uppercase"
            style={{
              fontFamily: BR.mono,
              fontSize: 10,
              letterSpacing: 1.5,
              color: BR.dim,
            }}
          >
            {diffG != null && (
              <>
                Δ {diffG >= 0 ? '+' : ''}
                {diffG} g
              </>
            )}
            {diffPct != null && (
              <>
                {' · '}
                <span style={{ color: diffPct >= 0 ? BR.rose : BR.cyan }}>
                  {diffPct >= 0 ? '▲' : '▼'} {Math.abs(diffPct)}%
                </span>
              </>
            )}
            {' · '}
            <span>{formatDateRu(latestWeight.date)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function getRelativeDateStr(offset: number): string {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return d.toISOString().slice(0, 10)
}

function computeAvgInterval(entries: Entry[]): number | null {
  if (entries.length < 2) return null
  const sorted = [...entries].sort(
    (a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime(),
  )
  const gaps: number[] = []
  for (let i = 1; i < sorted.length; i++) {
    const hours =
      (new Date(sorted[i].occurred_at).getTime() - new Date(sorted[i - 1].occurred_at).getTime()) /
      (1000 * 60 * 60)
    if (hours >= 10 / 60) gaps.push(hours)
  }
  if (gaps.length === 0) return null
  return gaps.reduce((s, g) => s + g, 0) / gaps.length
}

function pctChange(curr: number, prev: number): string | null {
  if (prev === 0) return null
  const pct = Math.round(((curr - prev) / prev) * 100)
  return pct >= 0 ? `+${pct}%` : `${pct}%`
}

function YesterdaySummary({
  yesterday,
  dayBefore,
  feedingEntries,
  diaperEntries,
}: {
  yesterday: DashboardDay | null
  dayBefore: DashboardDay | null
  feedingEntries: Entry[]
  diaperEntries: Entry[]
}) {
  if (!yesterday) {
    return (
      <div className="px-5">
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
          — no data for yesterday —
        </div>
      </div>
    )
  }

  const diaperTotal =
    yesterday.diaper_pee_count + yesterday.diaper_poo_count + yesterday.diaper_pee_poo_count
  const diaperTotalPrev = dayBefore
    ? dayBefore.diaper_pee_count + dayBefore.diaper_poo_count + dayBefore.diaper_pee_poo_count
    : 0
  const wetCount = yesterday.diaper_pee_count + yesterday.diaper_pee_poo_count
  const soilCount = yesterday.diaper_poo_count + yesterday.diaper_pee_poo_count

  const feedingWithMl = feedingEntries.filter((e) => e.value != null && e.value > 0)
  const avgFeedingInterval = computeAvgInterval(feedingWithMl)
  const avgDiaperInterval = computeAvgInterval(diaperEntries)
  const velocity = yesterday.feeding_total_ml / 24

  const mlPct = dayBefore ? pctChange(yesterday.feeding_total_ml, dayBefore.feeding_total_ml) : null
  const diaperPct = dayBefore ? pctChange(diaperTotal, diaperTotalPrev) : null

  return (
    <div className="px-5 grid grid-cols-2 gap-3">
      <ReadoutTile
        label="FEEDINGS"
        value={yesterday.feeding_count}
        unit={`× · ${Math.round(yesterday.feeding_total_ml)}ml`}
        note={mlPct ? `ml change: ${mlPct}` : undefined}
      />
      <ReadoutTile
        label="DIAPERS"
        value={diaperTotal}
        unit="×"
        accent={BR.cyan}
        note={diaperPct ? `Δ ${diaperPct}` : `W ${wetCount} · S ${soilCount}`}
      />
      <ReadoutTile
        label="FEED INT"
        value={avgFeedingInterval != null ? avgFeedingInterval.toFixed(1) : '—'}
        unit="h"
        note="avg interval"
      />
      <ReadoutTile
        label="VELOCITY"
        value={velocity > 0 ? velocity.toFixed(1) : '—'}
        unit="ml/h"
        accent={BR.cyan}
        note="24h average"
      />
      {avgDiaperInterval != null && (
        <ReadoutTile
          label="DIAPER INT"
          value={avgDiaperInterval.toFixed(1)}
          unit="h"
          accent={BR.cyan}
          note="wet+soil"
        />
      )}
    </div>
  )
}

function EmptyState() {
  return (
    <p
      className="text-center py-6 uppercase"
      style={{ fontFamily: BR.mono, fontSize: 10, letterSpacing: 2, color: BR.dim }}
    >
      — no data —
    </p>
  )
}

function nextBeautifulNumber(n: number): number {
  const candidates: number[] = []
  candidates.push(50)
  for (let base = 100; base <= 100000; base *= 10) {
    for (let mult = 1; mult <= 9; mult++) {
      candidates.push(base * mult)
    }
  }
  for (let digits = 3; digits <= 5; digits++) {
    const unit = Number('1'.repeat(digits))
    for (let mult = 1; mult <= 9; mult++) {
      candidates.push(unit * mult)
    }
  }
  candidates.sort((a, b) => a - b)
  return candidates.find((c) => c > n) ?? candidates[candidates.length - 1]
}

const THRESHOLD = 3

function AllTimeTotals({ totals }: { totals: AllTimeTotalsData | null }) {
  if (!totals) return null

  const stats = [
    { label: 'DIAPERS', value: totals.diaper_total, accent: BR.cyan },
    { label: 'WET', value: totals.diaper_pee, accent: BR.cyan },
    { label: 'SOIL', value: totals.diaper_poo, accent: BR.stool },
    { label: 'BREAST', value: totals.feeding_breast, accent: BR.rose },
    { label: 'FORMULA', value: totals.feeding_formula, accent: BR.amber },
  ]

  const hints: string[] = []
  for (const s of stats) {
    const next = nextBeautifulNumber(s.value)
    const remaining = next - s.value
    if (remaining <= THRESHOLD) {
      hints.push(
        `${s.label.toLowerCase()} → ${next}: ${remaining === 0 ? 'milestone!' : `${remaining} to go`}`,
      )
    }
  }

  return (
    <>
      <div className="px-5 grid grid-cols-2 gap-3">
        {stats.map((s) => (
          <ReadoutTile key={s.label} label={s.label} value={s.value} accent={s.accent} />
        ))}
      </div>
      {hints.length > 0 && (
        <div
          className="mx-5 mt-2 px-3 py-2 uppercase"
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
          {hints.map((h) => (
            <div key={h}>› {h}</div>
          ))}
        </div>
      )}
    </>
  )
}
