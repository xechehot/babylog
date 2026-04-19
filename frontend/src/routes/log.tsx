import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState, forwardRef } from 'react'
import { api } from '../api/client'
import type { Entry, EntryType } from '../types'
import { getDateRange, getTodayStr, formatDateRuFull } from '../components/dashboard/utils'
import { BottomSheet } from '../components/BottomSheet'
import {
  TYPE_LABELS_RU,
  SUBTYPE_LABELS_RU,
  FEEDING_SUBTYPES,
  DIAPER_SUBTYPES,
} from '../components/entry/constants'
import { BR, entryAccent } from '../components/br/theme'
import { PageHead } from '../components/br/PageHead'
import { GlyphDot } from '../components/br/GlyphDot'

export const Route = createFileRoute('/log')({
  component: LogPage,
})

function LogPage() {
  const queryClient = useQueryClient()
  const [rangeDays, setRangeDays] = useState(14)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const todayRef = useRef<HTMLDivElement>(null)
  const scrolledRef = useRef(false)
  const todayStr = getTodayStr()

  const range = getDateRange(rangeDays)

  const entriesQuery = useQuery({
    queryKey: ['entries', { from_date: range.from_date, to_date: range.to_date }],
    queryFn: () =>
      api.get<{ entries: Entry[] }>(
        `/api/entries?from_date=${range.from_date}&to_date=${range.to_date}`,
      ),
  })

  const entries = entriesQuery.data?.entries ?? []

  const grouped = entries.reduce<Record<string, Entry[]>>((acc, entry) => {
    const d = entry.date
    if (!acc[d]) acc[d] = []
    acc[d].push(entry)
    return acc
  }, {})
  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a))

  useEffect(() => {
    if (entries.length > 0 && !scrolledRef.current && todayRef.current) {
      todayRef.current.scrollIntoView({ behavior: 'instant', block: 'start' })
      scrolledRef.current = true
    }
  }, [entries.length])

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      ...data
    }: {
      id: number
      entry_type?: string
      subtype?: string | null
      occurred_at?: string
      value?: number | null
      notes?: string | null
    }) => api.patch<Entry>(`/api/entries/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entries'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      setEditingId(null)
    },
  })

  const createMutation = useMutation({
    mutationFn: (data: {
      entry_type: string
      subtype?: string | null
      occurred_at: string
      value?: number | null
      notes?: string | null
    }) => api.post<Entry>('/api/entries', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entries'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      setSheetOpen(false)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.del(`/api/entries/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entries'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })

  return (
    <>
      <PageHead
        kicker="TIMELINE · UNIT 04-RZ"
        title={
          <>
            Журнал <span style={{ color: BR.amber, fontStyle: 'italic' }}>отклика</span>
          </>
        }
        meta={[`${entries.length} ENTRIES`, `${sortedDates.length} DAYS`, `RANGE ${rangeDays}D`]}
      />

      {/* search/filter row */}
      <div
        className="mx-5 flex items-center gap-2.5"
        style={{
          padding: '10px 12px',
          border: `1px solid ${BR.line}`,
          fontFamily: BR.mono,
          fontSize: 12,
          color: BR.dim,
        }}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
          <circle cx="5" cy="5" r="4" stroke={BR.amber} strokeWidth="1" />
          <path d="M8 8l3 3" stroke={BR.amber} strokeWidth="1" />
        </svg>
        <span style={{ color: BR.amber, letterSpacing: 2 }}>QUERY</span>
        <span style={{ flex: 1, letterSpacing: 1 }}>› filter: all types</span>
        <button
          onClick={() => {
            setSheetOpen(true)
            setEditingId(null)
          }}
          className="uppercase"
          style={{
            color: BR.amber,
            letterSpacing: 2,
            borderLeft: `1px solid ${BR.line}`,
            paddingLeft: 10,
            fontFamily: BR.mono,
            fontSize: 11,
          }}
        >
          + NEW
        </button>
      </div>

      {/* Scrollable content */}
      <div className="mt-2">
        {entriesQuery.isLoading && (
          <p
            className="text-center mt-8 uppercase"
            style={{ fontFamily: BR.mono, fontSize: 10, letterSpacing: 2, color: BR.dim }}
          >
            Загрузка…
          </p>
        )}

        {!entriesQuery.isLoading && entries.length === 0 && (
          <p
            className="text-center mt-8 uppercase"
            style={{ fontFamily: BR.mono, fontSize: 10, letterSpacing: 2, color: BR.dim }}
          >
            Нет записей за выбранный период
          </p>
        )}

        {sortedDates.map((date) => {
          const isToday = date === todayStr
          const dayEntries = grouped[date]
          const totals = computeTotals(dayEntries)
          return (
            <div key={date}>
              <DayHeader
                ref={isToday ? todayRef : undefined}
                dateStr={date}
                isToday={isToday}
                totals={totals}
              />
              <div>
                {[...dayEntries].reverse().map((entry) =>
                  editingId === entry.id ? (
                    <InlineEditForm
                      key={entry.id}
                      entry={entry}
                      isSaving={updateMutation.isPending}
                      onSave={(data) => updateMutation.mutate({ id: entry.id, ...data })}
                      onCancel={() => setEditingId(null)}
                      onDelete={() => {
                        if (confirm('Удалить запись?')) {
                          deleteMutation.mutate(entry.id)
                          setEditingId(null)
                        }
                      }}
                    />
                  ) : (
                    <EntryRow
                      key={entry.id}
                      entry={entry}
                      onTap={() => {
                        setEditingId(entry.id)
                        setSheetOpen(false)
                      }}
                    />
                  ),
                )}
              </div>
            </div>
          )
        })}

        {!entriesQuery.isLoading && entries.length > 0 && (
          <div className="px-5 py-4">
            <button
              className="w-full py-3 uppercase"
              onClick={() => setRangeDays((d) => d + 14)}
              disabled={entriesQuery.isFetching}
              style={{
                fontFamily: BR.mono,
                fontSize: 10,
                letterSpacing: 2,
                color: BR.amber,
                border: `1px solid ${BR.line}`,
                background: 'rgba(255,179,71,0.04)',
              }}
            >
              {entriesQuery.isFetching ? 'LOADING…' : '⤓ LOAD MORE'}
            </button>
          </div>
        )}
      </div>

      {/* Floating action */}
      <button
        onClick={() => {
          setSheetOpen(true)
          setEditingId(null)
        }}
        aria-label="Добавить запись"
        className="fixed z-30 flex items-center justify-center"
        style={{
          right: 22,
          bottom: 100,
          width: 56,
          height: 56,
          borderRadius: 28,
          background: BR.ink,
          border: `1px solid ${BR.amber}`,
          color: BR.amber,
          fontFamily: BR.mono,
          fontSize: 26,
          boxShadow: `0 0 30px ${BR.amberGlow}, inset 0 0 15px rgba(255,179,71,0.15)`,
        }}
      >
        ＋
      </button>

      <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="НОВАЯ ЗАПИСЬ">
        <EntryForm
          isSaving={createMutation.isPending}
          onSave={(data) => createMutation.mutate(data)}
        />
      </BottomSheet>
    </>
  )
}

function computeTotals(entries: Entry[]) {
  let feedMl = 0
  let pee = 0
  let poo = 0
  for (const e of entries) {
    if (e.entry_type === 'feeding' && e.value) feedMl += e.value
    if (e.subtype === 'pee') pee += 1
    if (e.subtype === 'poo') poo += 1
    if (e.subtype === 'pee+poo') {
      pee += 1
      poo += 1
    }
  }
  return { feedMl: Math.round(feedMl), pee, poo }
}

const DayHeader = forwardRef<
  HTMLDivElement,
  { dateStr: string; isToday: boolean; totals: { feedMl: number; pee: number; poo: number } }
>(({ dateStr, isToday, totals }, ref) => (
  <div
    ref={ref}
    className="relative"
    style={{
      padding: '20px 20px 10px',
      borderTop: `1px solid ${BR.lineStrong}`,
      background: 'linear-gradient(to bottom, rgba(255,179,71,0.06), transparent 70%)',
    }}
  >
    <div className="flex items-baseline justify-between">
      <div>
        <div
          className="uppercase"
          style={{
            fontFamily: BR.mono,
            fontSize: 10,
            letterSpacing: 2.5,
            color: BR.dim,
          }}
        >
          {formatWeekday(dateStr)}
        </div>
        <div
          className="mt-0.5"
          style={{
            fontFamily: BR.display,
            fontSize: 22,
            fontWeight: 500,
            letterSpacing: -0.5,
            color: BR.text,
          }}
        >
          {formatDateRuFull(dateStr)}
        </div>
      </div>
      {isToday && (
        <span
          className="uppercase"
          style={{
            fontFamily: BR.mono,
            fontSize: 9,
            letterSpacing: 2.5,
            color: BR.amber,
            padding: '4px 8px',
            border: `1px solid ${BR.amber}`,
            textShadow: `0 0 8px ${BR.amberGlow}`,
            boxShadow: '0 0 10px rgba(255,179,71,0.2), inset 0 0 10px rgba(255,179,71,0.08)',
          }}
        >
          ● CURRENT
        </span>
      )}
    </div>
    {(totals.feedMl > 0 || totals.pee > 0 || totals.poo > 0) && (
      <div
        className="mt-2.5 flex gap-4 uppercase"
        style={{
          fontFamily: BR.mono,
          fontSize: 10,
          letterSpacing: 1.5,
          color: BR.dim,
        }}
      >
        <span>
          FEED · <span style={{ color: BR.amber }}>{totals.feedMl}ml</span>
        </span>
        <span>
          WET · <span style={{ color: BR.cyan }}>{totals.pee}</span>
        </span>
        <span>
          STL · <span style={{ color: BR.stool }}>{totals.poo}</span>
        </span>
      </div>
    )}
  </div>
))
DayHeader.displayName = 'DayHeader'

const WEEKDAYS_RU = ['ВОСКР', 'ПОНЕД', 'ВТОРНИК', 'СРЕДА', 'ЧЕТВЕРГ', 'ПЯТНИЦА', 'СУББОТА']

function formatWeekday(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return WEEKDAYS_RU[d.getDay()] ?? ''
}

function EntryRow({ entry, onTap }: { entry: Entry; onTap: () => void }) {
  const time = entry.occurred_at.split(' ')[1]?.slice(0, 5) ?? ''
  const accent = entryAccent(entry.entry_type, entry.subtype)
  const label = formatLabelEn(entry.entry_type, entry.subtype)
  const valueStr = formatValue(entry)

  return (
    <button
      className="w-full grid items-center text-left"
      onClick={onTap}
      style={{
        gridTemplateColumns: '52px 26px 1fr auto',
        gap: 14,
        padding: '11px 20px',
        borderBottom: `1px dashed ${BR.line}`,
      }}
    >
      <div
        style={{
          fontFamily: BR.mono,
          fontSize: 13,
          color: BR.text,
          letterSpacing: 0.5,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {time}
      </div>
      <GlyphDot entryType={entry.entry_type} subtype={entry.subtype} />
      <div className="min-w-0">
        <div
          className="uppercase"
          style={{
            fontFamily: BR.mono,
            fontSize: 11,
            letterSpacing: 2,
            color: accent,
          }}
        >
          {label}
        </div>
        {entry.notes && (
          <div
            className="truncate mt-0.5"
            style={{
              fontFamily: BR.serif,
              fontStyle: 'italic',
              fontSize: 13,
              color: BR.dim,
              letterSpacing: 0.2,
            }}
          >
            «{entry.notes}»
          </div>
        )}
      </div>
      <div
        style={{
          fontFamily: BR.display,
          fontSize: 18,
          fontWeight: 500,
          color: valueStr ? BR.text : BR.dim,
          fontVariantNumeric: 'tabular-nums',
          textShadow:
            valueStr && entry.entry_type === 'feeding' ? `0 0 12px ${BR.amberGlow}` : 'none',
        }}
      >
        {valueStr || '—'}
      </div>
    </button>
  )
}

function formatLabelEn(entryType: string, subtype: string | null): string {
  if (entryType === 'feeding') {
    if (subtype === 'breast') return 'FEEDING · BREAST'
    if (subtype === 'formula') return 'FEEDING · FORMULA'
    return 'FEEDING'
  }
  if (entryType === 'diaper') {
    if (subtype === 'pee') return 'DIAPER · WET'
    if (subtype === 'poo') return 'DIAPER · SOILED'
    if (subtype === 'pee+poo') return 'DIAPER · WET+SOILED'
    if (subtype === 'dry') return 'DIAPER · DRY'
    return 'DIAPER'
  }
  if (entryType === 'weight') return 'WEIGHT · MASS'
  return entryType.toUpperCase()
}

function formatValue(entry: Entry): string {
  if (entry.value == null) return ''
  if (entry.entry_type === 'weight') return `${(entry.value / 1000).toFixed(2)} kg`
  if (entry.entry_type === 'feeding') return `${entry.value} ml`
  return String(entry.value)
}

function InlineEditForm({
  entry,
  isSaving,
  onSave,
  onCancel,
  onDelete,
}: {
  entry: Entry
  isSaving: boolean
  onSave: (data: {
    entry_type?: string
    subtype?: string | null
    occurred_at?: string
    value?: number | null
    notes?: string | null
  }) => void
  onCancel: () => void
  onDelete: () => void
}) {
  const [editType, setEditType] = useState<EntryType>(entry.entry_type)
  const [editSubtype, setEditSubtype] = useState(entry.subtype ?? '')
  const [editDate, setEditDate] = useState(entry.date)
  const [editTime, setEditTime] = useState(entry.occurred_at.split(' ')[1]?.slice(0, 5) ?? '')
  const [editValue, setEditValue] = useState(entry.value?.toString() ?? '')
  const [editNotes, setEditNotes] = useState(entry.notes ?? '')

  const inputStyle: React.CSSProperties = {
    fontFamily: BR.mono,
    fontSize: 14,
    color: BR.text,
    background: BR.char,
    border: `1px solid ${BR.line}`,
    padding: '10px 12px',
    minHeight: 44,
    letterSpacing: 0.5,
    width: '100%',
  }

  return (
    <div
      className="mx-3"
      style={{
        padding: 14,
        border: `1px solid ${BR.amber}`,
        background: 'rgba(255,179,71,0.04)',
        boxShadow: `inset 0 0 12px rgba(255,179,71,0.08)`,
      }}
    >
      <div className="grid grid-cols-2 gap-2">
        <select
          style={inputStyle}
          value={editType}
          onChange={(e) => {
            const t = e.target.value as EntryType
            setEditType(t)
            if (t === 'feeding') setEditSubtype('formula')
            else if (t === 'diaper') setEditSubtype('pee')
            else setEditSubtype('')
          }}
        >
          {Object.entries(TYPE_LABELS_RU).map(([val, label]) => (
            <option key={val} value={val}>
              {label}
            </option>
          ))}
        </select>
        {editType === 'feeding' && (
          <select
            style={inputStyle}
            value={editSubtype}
            onChange={(e) => setEditSubtype(e.target.value)}
          >
            {FEEDING_SUBTYPES.map((s) => (
              <option key={s} value={s}>
                {SUBTYPE_LABELS_RU[s]}
              </option>
            ))}
          </select>
        )}
        {editType === 'diaper' && (
          <select
            style={inputStyle}
            value={editSubtype}
            onChange={(e) => setEditSubtype(e.target.value)}
          >
            {DIAPER_SUBTYPES.map((s) => (
              <option key={s} value={s}>
                {SUBTYPE_LABELS_RU[s]}
              </option>
            ))}
          </select>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2 mt-2">
        <input
          type="date"
          style={inputStyle}
          value={editDate}
          onChange={(e) => setEditDate(e.target.value)}
        />
        <input
          type="time"
          style={inputStyle}
          value={editTime}
          onChange={(e) => setEditTime(e.target.value)}
        />
      </div>
      <div className="grid grid-cols-2 gap-2 mt-2">
        <input
          type="number"
          style={inputStyle}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          placeholder="Значение"
        />
        <input
          type="text"
          style={inputStyle}
          value={editNotes}
          onChange={(e) => setEditNotes(e.target.value)}
          placeholder="Заметки"
        />
      </div>
      <div className="flex gap-2 mt-3">
        <button
          className="flex-1 uppercase"
          disabled={isSaving}
          onClick={() =>
            onSave({
              entry_type: editType,
              subtype: editSubtype || null,
              occurred_at: `${editDate} ${editTime}`,
              value: editValue ? Number(editValue) : null,
              notes: editNotes || null,
            })
          }
          style={{
            fontFamily: BR.mono,
            fontSize: 11,
            letterSpacing: 2,
            color: BR.amber,
            padding: '10px 12px',
            border: `1px solid ${BR.amber}`,
            background: 'rgba(255,179,71,0.12)',
            textShadow: `0 0 10px ${BR.amberGlow}`,
            minHeight: 44,
          }}
        >
          [ SAVE ]
        </button>
        <button
          className="uppercase"
          onClick={onCancel}
          style={{
            fontFamily: BR.mono,
            fontSize: 11,
            letterSpacing: 2,
            color: BR.dim,
            padding: '10px 12px',
            border: `1px solid ${BR.line}`,
            minHeight: 44,
          }}
        >
          CANCEL
        </button>
        <button
          className="ml-auto uppercase"
          onClick={onDelete}
          style={{
            fontFamily: BR.mono,
            fontSize: 11,
            letterSpacing: 2,
            color: BR.blood,
            padding: '10px 12px',
            border: `1px solid ${BR.blood}`,
            minHeight: 44,
          }}
        >
          DEL
        </button>
      </div>
    </div>
  )
}

function EntryForm({
  isSaving,
  onSave,
}: {
  isSaving: boolean
  onSave: (data: {
    entry_type: string
    subtype?: string | null
    occurred_at: string
    value?: number | null
    notes?: string | null
  }) => void
}) {
  const [type, setType] = useState<EntryType>('feeding')
  const [subtype, setSubtype] = useState('formula')
  const [date, setDate] = useState(getTodayStr())
  const [time, setTime] = useState('')
  const [value, setValue] = useState('')
  const [notes, setNotes] = useState('')

  const occurredAt = date && time ? `${date} ${time}` : ''

  const inputStyle: React.CSSProperties = {
    fontFamily: BR.mono,
    fontSize: 16,
    color: BR.text,
    background: BR.char,
    border: `1px solid ${BR.line}`,
    padding: '10px 12px',
    minHeight: 44,
    letterSpacing: 0.5,
    width: '100%',
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <select
          style={inputStyle}
          value={type}
          onChange={(e) => {
            const t = e.target.value as EntryType
            setType(t)
            if (t === 'feeding') setSubtype('formula')
            else if (t === 'diaper') setSubtype('pee')
            else setSubtype('')
          }}
        >
          {Object.entries(TYPE_LABELS_RU).map(([val, label]) => (
            <option key={val} value={val}>
              {label}
            </option>
          ))}
        </select>
        {type === 'feeding' && (
          <select style={inputStyle} value={subtype} onChange={(e) => setSubtype(e.target.value)}>
            {FEEDING_SUBTYPES.map((s) => (
              <option key={s} value={s}>
                {SUBTYPE_LABELS_RU[s]}
              </option>
            ))}
          </select>
        )}
        {type === 'diaper' && (
          <select style={inputStyle} value={subtype} onChange={(e) => setSubtype(e.target.value)}>
            {DIAPER_SUBTYPES.map((s) => (
              <option key={s} value={s}>
                {SUBTYPE_LABELS_RU[s]}
              </option>
            ))}
          </select>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input
          type="date"
          style={inputStyle}
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <input
          type="time"
          style={inputStyle}
          value={time}
          onChange={(e) => setTime(e.target.value)}
          autoFocus
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input
          type="number"
          style={inputStyle}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Значение"
        />
        <input
          type="text"
          style={inputStyle}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Заметки"
        />
      </div>
      <button
        className="w-full uppercase"
        disabled={!occurredAt || isSaving}
        onClick={() =>
          onSave({
            entry_type: type,
            subtype: subtype || null,
            occurred_at: occurredAt,
            value: value ? Number(value) : null,
            notes: notes || null,
          })
        }
        style={{
          fontFamily: BR.mono,
          fontSize: 12,
          letterSpacing: 2,
          color: BR.amber,
          padding: '14px 12px',
          border: `1px solid ${BR.amber}`,
          background: 'rgba(255,179,71,0.12)',
          textShadow: `0 0 10px ${BR.amberGlow}`,
          minHeight: 48,
          opacity: !occurredAt || isSaving ? 0.5 : 1,
        }}
      >
        {isSaving ? 'SAVING…' : '[ СОХРАНИТЬ ]'}
      </button>
    </div>
  )
}
