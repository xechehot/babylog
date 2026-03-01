import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { api } from '../api/client'
import type { Entry, EntryType } from '../types'
import { getDateRange, getTodayStr, formatDateRuFull } from '../components/dashboard/utils'
import { BottomSheet } from '../components/BottomSheet'
import {
  TYPE_LABELS_RU,
  SUBTYPE_LABELS_RU,
  getEntryIcon,
  FEEDING_SUBTYPES,
  DIAPER_SUBTYPES,
} from '../components/entry/constants'

export const Route = createFileRoute('/log')({
  component: LogPage,
})

const ENTRY_COLORS: Record<string, string> = {
  feeding: 'bg-blue-50 border-blue-200',
  pee: 'bg-amber-50 border-amber-200',
  'pee+poo': 'bg-amber-50 border-amber-200',
  poo: 'bg-orange-100 border-orange-300',
  dry: 'bg-gray-50 border-gray-200',
  weight: 'bg-green-50 border-green-200',
}

function getRowColor(entryType: string, subtype: string | null): string {
  if (subtype && ENTRY_COLORS[subtype]) return ENTRY_COLORS[subtype]
  return ENTRY_COLORS[entryType] ?? 'bg-white border-gray-200'
}

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

  // Group by date (descending: newest day first)
  const grouped = entries.reduce<Record<string, Entry[]>>((acc, entry) => {
    const d = entry.date
    if (!acc[d]) acc[d] = []
    acc[d].push(entry)
    return acc
  }, {})
  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a))

  // Auto-scroll to today once
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
    <div className="flex flex-col h-[calc(100vh-theme(spacing.16))]">
      {/* Sticky header */}
      <div className="sticky top-0 z-30 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shrink-0">
        <h1 className="text-xl font-bold">Журнал</h1>
        <button
          className="text-sm font-medium text-blue-600 active:text-blue-800 min-h-[44px] px-3"
          onClick={() => {
            setSheetOpen(true)
            setEditingId(null)
          }}
        >
          + Добавить
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {entriesQuery.isLoading && (
          <p className="text-gray-400 text-center mt-8">Загрузка...</p>
        )}

        {!entriesQuery.isLoading && entries.length === 0 && (
          <p className="text-gray-400 text-center mt-8">Нет записей за выбранный период</p>
        )}

        {sortedDates.map((date) => {
          const isToday = date === todayStr
          const dayEntries = grouped[date]
          return (
            <div key={date}>
              <DayHeader
                ref={isToday ? todayRef : undefined}
                dateStr={date}
                isToday={isToday}
              />
              <div className="px-4 pb-2 space-y-1.5">
                {dayEntries.map((entry) =>
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

        {/* Load more */}
        {!entriesQuery.isLoading && entries.length > 0 && (
          <div className="px-4 py-4">
            <button
              className="w-full py-3 text-sm text-blue-600 border border-blue-200 rounded-lg active:bg-blue-50 min-h-[44px]"
              onClick={() => setRangeDays((d) => d + 14)}
              disabled={entriesQuery.isFetching}
            >
              {entriesQuery.isFetching ? 'Загрузка...' : 'Загрузить ещё'}
            </button>
          </div>
        )}
      </div>

      {/* Add entry bottom sheet */}
      <BottomSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Новая запись"
      >
        <EntryForm
          isSaving={createMutation.isPending}
          onSave={(data) => createMutation.mutate(data)}
        />
      </BottomSheet>
    </div>
  )
}

/* ---------- DayHeader ---------- */

import { forwardRef } from 'react'

const DayHeader = forwardRef<HTMLDivElement, { dateStr: string; isToday: boolean }>(
  ({ dateStr, isToday }, ref) => (
    <div
      ref={ref}
      className="sticky top-[57px] z-20 bg-gray-100/95 backdrop-blur-sm px-4 py-2 flex items-center gap-2"
    >
      <span className="text-sm font-semibold text-gray-600">
        {formatDateRuFull(dateStr)}
      </span>
      {isToday && (
        <span className="text-[10px] font-bold bg-blue-600 text-white px-1.5 py-0.5 rounded">
          СЕГОДНЯ
        </span>
      )}
    </div>
  ),
)

/* ---------- EntryRow ---------- */

function EntryRow({ entry, onTap }: { entry: Entry; onTap: () => void }) {
  const time = entry.occurred_at.split(' ')[1]?.slice(0, 5) ?? ''
  const icon = getEntryIcon(entry.entry_type, entry.subtype)
  const color = getRowColor(entry.entry_type, entry.subtype)

  let label = TYPE_LABELS_RU[entry.entry_type] ?? entry.entry_type
  if (entry.subtype && SUBTYPE_LABELS_RU[entry.subtype]) {
    label = SUBTYPE_LABELS_RU[entry.subtype]
  }

  let valueStr = ''
  if (entry.value != null) {
    if (entry.entry_type === 'weight') {
      valueStr = `${(entry.value / 1000).toFixed(2)} кг`
    } else {
      valueStr = `${entry.value} мл`
    }
  }

  return (
    <button
      className={`w-full flex items-center gap-3 rounded-lg border p-3 text-left active:opacity-70 ${color}`}
      onClick={onTap}
    >
      <span className="text-xs text-gray-400 w-10 shrink-0 tabular-nums">{time}</span>
      <span className="text-base">{icon}</span>
      <span className="text-sm font-medium">{label}</span>
      {valueStr && <span className="text-sm text-gray-600">{valueStr}</span>}
      {entry.notes && (
        <span className="text-xs text-gray-400 truncate ml-auto">{entry.notes}</span>
      )}
    </button>
  )
}

/* ---------- InlineEditForm ---------- */

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
  const [editTime, setEditTime] = useState(
    entry.occurred_at.split(' ')[1]?.slice(0, 5) ?? '',
  )
  const [editValue, setEditValue] = useState(entry.value?.toString() ?? '')
  const [editNotes, setEditNotes] = useState(entry.notes ?? '')

  return (
    <div className="rounded-lg border-2 border-blue-300 bg-white p-3 space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <select
          className="p-2 border rounded text-base min-h-[44px]"
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
            className="p-2 border rounded text-base min-h-[44px]"
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
            className="p-2 border rounded text-base min-h-[44px]"
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
      <div className="grid grid-cols-2 gap-2">
        <input
          type="date"
          className="p-2 border rounded text-base min-h-[44px]"
          value={editDate}
          onChange={(e) => setEditDate(e.target.value)}
        />
        <input
          type="time"
          className="p-2 border rounded text-base min-h-[44px]"
          value={editTime}
          onChange={(e) => setEditTime(e.target.value)}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input
          type="number"
          className="p-2 border rounded text-base min-h-[44px]"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          placeholder="Значение"
        />
        <input
          type="text"
          className="p-2 border rounded text-base min-h-[44px]"
          value={editNotes}
          onChange={(e) => setEditNotes(e.target.value)}
          placeholder="Заметки"
        />
      </div>
      <div className="flex gap-2">
        <button
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded min-h-[44px] disabled:opacity-50"
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
        >
          Сохранить
        </button>
        <button
          className="px-4 py-2 text-sm bg-gray-200 rounded min-h-[44px]"
          onClick={onCancel}
        >
          Отмена
        </button>
        <button
          className="px-4 py-2 text-sm text-red-600 ml-auto min-h-[44px]"
          onClick={onDelete}
        >
          Удалить
        </button>
      </div>
    </div>
  )
}

/* ---------- EntryForm (for BottomSheet) ---------- */

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

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <select
          className="p-2 border rounded text-base min-h-[44px]"
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
          <select
            className="p-2 border rounded text-base min-h-[44px]"
            value={subtype}
            onChange={(e) => setSubtype(e.target.value)}
          >
            {FEEDING_SUBTYPES.map((s) => (
              <option key={s} value={s}>
                {SUBTYPE_LABELS_RU[s]}
              </option>
            ))}
          </select>
        )}
        {type === 'diaper' && (
          <select
            className="p-2 border rounded text-base min-h-[44px]"
            value={subtype}
            onChange={(e) => setSubtype(e.target.value)}
          >
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
          className="p-2 border rounded text-base min-h-[44px]"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <input
          type="time"
          className="p-2 border rounded text-base min-h-[44px]"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          autoFocus
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input
          type="number"
          className="p-2 border rounded text-base min-h-[44px]"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Значение"
        />
        <input
          type="text"
          className="p-2 border rounded text-base min-h-[44px]"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Заметки"
        />
      </div>
      <button
        className="w-full py-3 text-sm font-medium bg-blue-600 text-white rounded-lg min-h-[44px] disabled:opacity-50"
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
      >
        {isSaving ? 'Сохранение...' : 'Добавить запись'}
      </button>
    </div>
  )
}
