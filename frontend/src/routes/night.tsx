import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { api } from '../api/client'
import type { NextFeedingPrediction, PredictionBasis } from '../types'
import { BR } from '../components/br/theme'
import { PageHead } from '../components/br/PageHead'
import { Rule } from '../components/br/Rule'
import {
  formatClock,
  resolveClockTime,
  roundToFiveMinutes,
  toLocalISO,
} from '../components/night/utils'

export const Route = createFileRoute('/night')({
  component: NightPage,
})

const DEBOUNCE_MS = 300

const BASIS_NOTE: Record<PredictionBasis, string | null> = {
  regression: null,
  median_measured: 'volume signal weak — using typical gap',
  median_unmeasured: 'unmeasured feed — using typical top-up gap',
  insufficient_data: null,
}

function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

function NightPage() {
  const [time, setTime] = useState(() => formatClock(roundToFiveMinutes(new Date())))
  const [ml, setMl] = useState('')

  const debouncedTime = useDebounced(time, DEBOUNCE_MS)
  const debouncedMl = useDebounced(ml, DEBOUNCE_MS)

  const at = useMemo(() => toLocalISO(resolveClockTime(debouncedTime, new Date())), [debouncedTime])
  const mlValue = debouncedMl.trim() === '' ? null : Number(debouncedMl)
  const mlIsValid = mlValue === null || (Number.isFinite(mlValue) && mlValue >= 0)

  const { data, isFetching, isError } = useQuery({
    queryKey: ['prediction', at, mlValue],
    queryFn: () => {
      const params = new URLSearchParams({ at: at! })
      if (mlValue !== null) params.set('ml', String(mlValue))
      return api.get<NextFeedingPrediction>(`/api/predict/next-feeding?${params}`)
    },
    enabled: at !== null && mlIsValid,
  })

  return (
    <div className="pb-28">
      <PageHead kicker="Night" title="Next feeding" meta={['predicted from your own history']} />

      <Rule label="last feeding" />

      <div className="px-5 grid grid-cols-2 gap-3">
        <Field label="Time">
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="w-full bg-transparent outline-none"
            style={{ fontFamily: BR.mono, fontSize: 22, color: BR.text }}
          />
        </Field>
        <Field label="Volume">
          <div className="flex items-baseline gap-1.5">
            <input
              type="text"
              inputMode="numeric"
              value={ml}
              onChange={(e) => setMl(e.target.value.replace(/[^\d]/g, ''))}
              placeholder="—"
              className="w-full bg-transparent outline-none"
              style={{ fontFamily: BR.mono, fontSize: 22, color: BR.text }}
            />
            <span style={{ fontFamily: BR.mono, fontSize: 11, color: BR.dim }}>ml</span>
          </div>
        </Field>
      </div>

      <p
        className="px-5 pt-2 uppercase"
        style={{ fontFamily: BR.mono, fontSize: 9, letterSpacing: 1.5, color: BR.dim }}
      >
        leave volume empty for a breast feed
      </p>

      <Rule label="prediction" />

      <div className="px-5">
        <Result data={data} isFetching={isFetching} isError={isError} />
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label
      className="block px-3.5 py-2.5 rounded"
      style={{ border: `1px solid ${BR.lineStrong}`, background: BR.char }}
    >
      <div
        className="uppercase mb-1"
        style={{ fontFamily: BR.mono, fontSize: 9, letterSpacing: 2, color: BR.dim }}
      >
        {label}
      </div>
      {children}
    </label>
  )
}

function Result({
  data,
  isFetching,
  isError,
}: {
  data: NextFeedingPrediction | undefined
  isFetching: boolean
  isError: boolean
}) {
  if (isError) {
    return <Notice text="Could not reach the server." accent={BR.blood} />
  }

  if (!data) {
    return <Notice text={isFetching ? 'Calculating…' : 'Enter the last feeding above.'} />
  }

  if (data.basis === 'insufficient_data' || !data.predicted_at) {
    return (
      <Notice text="Not enough night feedings logged yet to predict. Upload a few more nights of notes and try again." />
    )
  }

  const predicted = new Date(data.predicted_at)
  const earliest = data.earliest_at ? new Date(data.earliest_at) : null
  const latest = data.latest_at ? new Date(data.latest_at) : null
  const note = BASIS_NOTE[data.basis]

  return (
    <div
      className="rounded px-5 py-6 text-center"
      style={{
        border: `1px solid ${BR.lineStrong}`,
        background: BR.char,
        opacity: isFetching ? 0.55 : 1,
        transition: 'opacity 120ms',
      }}
    >
      <div
        style={{
          fontFamily: BR.display,
          fontSize: 52,
          lineHeight: 1,
          letterSpacing: -2,
          color: BR.amber,
          textShadow: `0 0 24px ${BR.amberGlow}`,
        }}
      >
        {formatClock(predicted)}
      </div>

      {earliest && latest && (
        <div className="mt-2" style={{ fontFamily: BR.mono, fontSize: 13, color: BR.body }}>
          {formatClock(earliest)} – {formatClock(latest)}
        </div>
      )}

      {data.predicted_ml !== null && (
        <div
          className="mt-4 pt-4"
          style={{ borderTop: `1px solid ${BR.line}`, fontFamily: BR.mono, color: BR.text }}
        >
          <span style={{ fontSize: 20 }}>~{data.predicted_ml} ml</span>
          {data.ml_low !== null && data.ml_high !== null && (
            <span style={{ fontSize: 12, color: BR.dim }}>
              {'  '}
              {data.ml_low}–{data.ml_high}
            </span>
          )}
        </div>
      )}

      <div
        className="mt-4 uppercase"
        style={{ fontFamily: BR.mono, fontSize: 9, letterSpacing: 1.5, color: BR.dim }}
      >
        {data.sample_size} night gaps ·{' '}
        {data.window_days ? `last ${data.window_days} days` : 'all history'}
      </div>

      {note && (
        <div
          className="mt-1.5 uppercase"
          style={{ fontFamily: BR.mono, fontSize: 9, letterSpacing: 1.5, color: BR.stool }}
        >
          {note}
        </div>
      )}
    </div>
  )
}

function Notice({ text, accent = BR.dim }: { text: string; accent?: string }) {
  return (
    <div
      className="rounded px-5 py-8 text-center"
      style={{
        border: `1px solid ${BR.line}`,
        background: BR.char,
        fontFamily: BR.mono,
        fontSize: 11,
        lineHeight: 1.7,
        color: accent,
      }}
    >
      {text}
    </div>
  )
}
