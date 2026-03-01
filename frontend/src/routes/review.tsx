import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useRef, useState } from 'react'
import { api } from '../api/client'
import type { Entry, EntryType, Upload, UploadDetail } from '../types'

const BASE_PATH = import.meta.env.BASE_URL.replace(/\/$/, '')

interface ReviewSearch {
  uploadId?: number
}

export const Route = createFileRoute('/review')({
  component: ReviewPage,
  validateSearch: (search: Record<string, unknown>): ReviewSearch => ({
    uploadId: search.uploadId ? Number(search.uploadId) : undefined,
  }),
})

const TYPE_LABELS: Record<EntryType, string> = {
  feeding: 'Feeding',
  diaper: 'Diaper',
  weight: 'Weight',
}

const SUBTYPE_ICONS: Record<string, string> = {
  breast: '\u{1F930}',
  formula: '\u{1F37C}',
  pee: '\u{1F4A7}',
  poo: '\u{1F4A9}',
  dry: '\u{2705}',
  'pee+poo': '\u{1F4A7}\u{1F4A9}',
}

function getEntryIcon(entryType: string, subtype: string | null): string {
  if (subtype && SUBTYPE_ICONS[subtype]) {
    return SUBTYPE_ICONS[subtype]
  }
  if (entryType === 'weight') return '\u{2696}\u{FE0F}'
  if (entryType === 'feeding') return '\u{1F37C}'
  if (entryType === 'diaper') return '\u{1FA7B}'
  return ''
}

const SUBTYPE_LABELS: Record<string, string> = {
  breast: 'breast',
  formula: 'formula',
  pee: 'pee',
  poo: 'poo',
  dry: 'dry',
  'pee+poo': 'pee+poo',
}

const FEEDING_SUBTYPES = ['breast', 'formula'] as const
const DIAPER_SUBTYPES = ['pee', 'poo', 'dry', 'pee+poo'] as const

const CONFIDENCE_STYLES: Record<string, string> = {
  high: 'border-l-4 border-l-transparent',
  medium: 'border-l-4 border-l-amber-400',
  low: 'border-l-4 border-l-red-400',
}

function ReviewPage() {
  const { uploadId } = Route.useSearch()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [editingId, setEditingId] = useState<number | null>(null)
  const [isAdding, setIsAdding] = useState(false)

  const uploadsQuery = useQuery({
    queryKey: ['uploads'],
    queryFn: () => api.get<{ uploads: Upload[] }>('/api/uploads'),
  })

  const detailQuery = useQuery({
    queryKey: ['upload', uploadId],
    queryFn: () => api.get<UploadDetail>(`/api/uploads/${uploadId}`),
    enabled: !!uploadId,
    refetchInterval: (query) => {
      const data = query.state.data
      return data?.status === 'processing' || data?.status === 'pending' ? 2000 : false
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: { id: number; entry_type?: string; subtype?: string | null; occurred_at?: string; value?: number | null; notes?: string | null; confirmed?: boolean }) =>
      api.patch<Entry>(`/api/entries/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['upload', uploadId] })
      setEditingId(null)
    },
  })

  const createMutation = useMutation({
    mutationFn: (data: { entry_type: string; subtype?: string | null; occurred_at: string; value?: number | null; notes?: string | null; upload_id?: number | null }) =>
      api.post<Entry>('/api/entries', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['upload', uploadId] })
      queryClient.invalidateQueries({ queryKey: ['uploads'] })
      setIsAdding(false)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.del(`/api/entries/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['upload', uploadId] })
    },
  })

  const doneUploads = (uploadsQuery.data?.uploads ?? []).filter(
    (u) => u.status === 'done',
  )

  const detail = detailQuery.data
  const entries = detail?.entries ?? []

  // Group entries by date
  const grouped = entries.reduce<Record<string, Entry[]>>((acc, entry) => {
    const d = entry.date
    if (!acc[d]) acc[d] = []
    acc[d].push(entry)
    return acc
  }, {})

  const showSplitView = uploadId && detail?.status === 'done'

  return (
    <div className={showSplitView ? 'flex flex-col h-[calc(100vh-theme(spacing.16))]' : 'p-4'}>
      {/* Upload selector */}
      <div className={showSplitView ? 'p-4 pb-2 shrink-0' : ''}>
        {!showSplitView && <h1 className="text-xl font-bold mb-4">Review</h1>}
        <select
          className="w-full p-2 border border-gray-300 rounded-lg bg-white"
          value={uploadId ?? ''}
          onChange={(e) => {
            const val = e.target.value
            navigate({
              to: '/review',
              search: val ? { uploadId: Number(val) } : {},
            })
          }}
        >
          <option value="">Select an upload...</option>
          {doneUploads.map((u) => (
            <option key={u.id} value={u.id}>
              {u.filename} ({u.entry_count ?? 0} entries)
            </option>
          ))}
        </select>
      </div>

      {!uploadId && (
        <p className="text-gray-400 text-center mt-8">
          Select an upload to review its entries
        </p>
      )}

      {uploadId && detail?.status === 'processing' && (
        <p className="text-blue-600 text-center mt-8">Processing...</p>
      )}

      {uploadId && detail?.status === 'pending' && (
        <p className="text-yellow-600 text-center mt-8">Waiting to process...</p>
      )}

      {uploadId && detail?.status === 'failed' && (
        <p className="text-red-600 text-center mt-8">
          Failed: {detail.error_message}
        </p>
      )}

      {/* Split-screen layout */}
      {showSplitView && (
        <>
          {/* Top panel: Image with pinch-to-zoom */}
          <PinchZoomImage
            src={`${BASE_PATH}/api/uploads/${uploadId}/image`}
            alt="Uploaded log"
          />

          {/* Divider */}
          <div className="h-px bg-gray-300 shrink-0" />

          {/* Bottom panel: Entries */}
          <div className="flex-1 min-h-0 overflow-y-auto p-4 pt-2">
            {/* Confidence legend */}
            <div className="flex gap-4 mb-3 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded border-l-4 border-l-transparent bg-gray-100" />
                High
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded border-l-4 border-l-amber-400 bg-gray-100" />
                Medium
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded border-l-4 border-l-red-400 bg-gray-100" />
                Low
              </span>
            </div>

            {/* Entries grouped by date */}
            {Object.entries(grouped).map(([date, dayEntries]) => (
              <div key={date} className="mb-6">
                <h3 className="text-sm font-medium text-gray-500 mb-2">{date}</h3>
                <div className="space-y-2">
                  {dayEntries.map((entry) => (
                    <EntryCard
                      key={entry.id}
                      entry={entry}
                      isEditing={editingId === entry.id}
                      onEdit={() => { setEditingId(entry.id); setIsAdding(false) }}
                      onCancel={() => setEditingId(null)}
                      onSave={(data) =>
                        updateMutation.mutate({ id: entry.id, ...data })
                      }
                      onConfirm={() =>
                        updateMutation.mutate({
                          id: entry.id,
                          confirmed: !entry.confirmed,
                        })
                      }
                      onDelete={() => {
                        if (confirm('Delete this entry?')) {
                          deleteMutation.mutate(entry.id)
                        }
                      }}
                      isSaving={updateMutation.isPending}
                    />
                  ))}
                </div>
              </div>
            ))}

            {entries.length === 0 && (
              <p className="text-gray-400 text-center mt-4">No entries found</p>
            )}

            {/* Add missing entry */}
            {isAdding ? (
              <AddEntryForm
                defaultDate={entries.length > 0 ? entries[entries.length - 1].date : ''}
                uploadId={uploadId!}
                isSaving={createMutation.isPending}
                onSave={(data) => createMutation.mutate(data)}
                onCancel={() => setIsAdding(false)}
              />
            ) : (
              <button
                className="w-full mt-4 p-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-400 text-sm min-h-[44px] active:bg-gray-50"
                onClick={() => { setIsAdding(true); setEditingId(null) }}
              >
                + Add missing entry
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function EntryCard({
  entry,
  isEditing,
  onEdit,
  onCancel,
  onSave,
  onConfirm,
  onDelete,
  isSaving,
}: {
  entry: Entry
  isEditing: boolean
  onEdit: () => void
  onCancel: () => void
  onSave: (data: { entry_type?: string; subtype?: string | null; occurred_at?: string; value?: number | null; notes?: string | null }) => void
  onConfirm: () => void
  onDelete: () => void
  isSaving: boolean
}) {
  const [editType, setEditType] = useState(entry.entry_type)
  const [editSubtype, setEditSubtype] = useState(entry.subtype ?? '')
  const [editTime, setEditTime] = useState(entry.occurred_at)
  const [editValue, setEditValue] = useState(entry.value?.toString() ?? '')
  const [editNotes, setEditNotes] = useState(entry.notes ?? '')

  const confidenceStyle =
    CONFIDENCE_STYLES[entry.confidence ?? 'high'] ?? CONFIDENCE_STYLES.high

  const cardBg = entry.confirmed
    ? 'bg-green-50 border-green-200'
    : 'bg-white border-gray-200'

  if (isEditing) {
    return (
      <div className={`bg-white rounded-lg border border-blue-300 p-3 ${confidenceStyle}`}>
        <div className="grid grid-cols-3 gap-2 mb-2">
          <select
            className="p-1 border rounded text-sm"
            value={editType}
            onChange={(e) => {
              const newType = e.target.value as EntryType
              setEditType(newType)
              if (newType === 'feeding') setEditSubtype('formula')
              else if (newType === 'diaper') setEditSubtype('pee')
              else setEditSubtype('')
            }}
          >
            {Object.entries(TYPE_LABELS).map(([val, label]) => (
              <option key={val} value={val}>
                {label}
              </option>
            ))}
          </select>
          {editType === 'feeding' && (
            <select
              className="p-1 border rounded text-sm"
              value={editSubtype}
              onChange={(e) => setEditSubtype(e.target.value)}
            >
              {FEEDING_SUBTYPES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          )}
          {editType === 'diaper' && (
            <select
              className="p-1 border rounded text-sm"
              value={editSubtype}
              onChange={(e) => setEditSubtype(e.target.value)}
            >
              {DIAPER_SUBTYPES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          )}
          <input
            type="text"
            className="p-1 border rounded text-sm"
            value={editTime}
            onChange={(e) => setEditTime(e.target.value)}
            placeholder="YYYY-MM-DD HH:MM"
          />
        </div>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <input
            type="number"
            className="p-1 border rounded text-sm"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            placeholder="Value"
          />
          <input
            type="text"
            className="p-1 border rounded text-sm"
            value={editNotes}
            onChange={(e) => setEditNotes(e.target.value)}
            placeholder="Notes"
          />
        </div>
        <div className="flex gap-2">
          <button
            className="px-3 py-1 text-xs bg-blue-600 text-white rounded"
            disabled={isSaving}
            onClick={() =>
              onSave({
                entry_type: editType,
                subtype: editSubtype || null,
                occurred_at: editTime,
                value: editValue ? Number(editValue) : null,
                notes: editNotes || null,
              })
            }
          >
            Save
          </button>
          <button
            className="px-3 py-1 text-xs bg-gray-200 rounded"
            onClick={onCancel}
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  const time = entry.occurred_at.split(' ')[1] ?? ''
  const icon = getEntryIcon(entry.entry_type, entry.subtype)

  return (
    <div className={`rounded-lg border p-3 ${cardBg} ${confidenceStyle}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm text-gray-400 w-12 shrink-0">{time}</span>
          <span className="text-base">{icon}</span>
          <span className="text-sm font-medium">
            {TYPE_LABELS[entry.entry_type] ?? entry.entry_type}
          </span>
          {entry.value != null && (
            <span className="text-sm text-gray-600">
              {entry.entry_type === 'weight'
                ? `${entry.value}g`
                : `${entry.value}ml`}
            </span>
          )}
          {entry.notes && (
            <span className="text-xs text-gray-400 truncate">{entry.notes}</span>
          )}
        </div>
        <div className="flex gap-1 shrink-0">
          {entry.confidence === 'low' && (
            <span className="text-red-500 text-xs" title="Low confidence">
              !!
            </span>
          )}
          <button
            className={`px-2 py-1 text-xs rounded ${
              entry.confirmed
                ? 'text-green-700 bg-green-100 hover:bg-green-200'
                : 'text-gray-400 hover:text-green-600'
            }`}
            onClick={onConfirm}
            title={entry.confirmed ? 'Unconfirm' : 'Confirm'}
          >
            {'\u2713'}
          </button>
          <button
            className="px-2 py-1 text-xs text-gray-500 hover:text-blue-600"
            onClick={onEdit}
          >
            Edit
          </button>
          <button
            className="px-2 py-1 text-xs text-gray-500 hover:text-red-600"
            onClick={onDelete}
          >
            Del
          </button>
        </div>
      </div>
      {entry.raw_text && (
        <p className="text-xs text-gray-400 mt-1 truncate" title={entry.raw_text}>
          {entry.raw_text}
        </p>
      )}
    </div>
  )
}

function AddEntryForm({
  defaultDate,
  uploadId,
  isSaving,
  onSave,
  onCancel,
}: {
  defaultDate: string
  uploadId: number
  isSaving: boolean
  onSave: (data: { entry_type: string; subtype?: string | null; occurred_at: string; value?: number | null; notes?: string | null; upload_id: number }) => void
  onCancel: () => void
}) {
  const [type, setType] = useState<EntryType>('feeding')
  const [subtype, setSubtype] = useState('formula')
  const [date, setDate] = useState(defaultDate)
  const [time, setTime] = useState('')
  const [value, setValue] = useState('')
  const [notes, setNotes] = useState('')
  const timeRef = useRef<HTMLInputElement>(null)

  const occurredAt = date && time ? `${date} ${time}` : ''

  return (
    <div className="mt-4 rounded-lg border-2 border-dashed border-green-300 bg-green-50/50 p-3">
      <div className="text-xs font-medium text-green-700 mb-2">New entry</div>
      <div className="grid grid-cols-2 gap-2 mb-2">
        <select
          className="p-1 border rounded text-base min-h-[44px]"
          value={type}
          onChange={(e) => {
            const newType = e.target.value as EntryType
            setType(newType)
            if (newType === 'feeding') setSubtype('formula')
            else if (newType === 'diaper') setSubtype('pee')
            else setSubtype('')
          }}
        >
          {Object.entries(TYPE_LABELS).map(([val, label]) => (
            <option key={val} value={val}>{label}</option>
          ))}
        </select>
        {type === 'feeding' && (
          <select
            className="p-1 border rounded text-base min-h-[44px]"
            value={subtype}
            onChange={(e) => setSubtype(e.target.value)}
          >
            {FEEDING_SUBTYPES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        )}
        {type === 'diaper' && (
          <select
            className="p-1 border rounded text-base min-h-[44px]"
            value={subtype}
            onChange={(e) => setSubtype(e.target.value)}
          >
            {DIAPER_SUBTYPES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2 mb-2">
        <input
          type="date"
          className="p-1 border rounded text-base min-h-[44px]"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <input
          ref={timeRef}
          type="time"
          className="p-1 border rounded text-base min-h-[44px]"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          autoFocus
        />
      </div>
      <div className="grid grid-cols-2 gap-2 mb-2">
        <input
          type="number"
          className="p-1 border rounded text-base min-h-[44px]"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Value"
        />
        <input
          type="text"
          className="p-1 border rounded text-base min-h-[44px]"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes"
        />
      </div>
      <div className="flex gap-2">
        <button
          className="px-3 py-1 text-sm bg-green-600 text-white rounded min-h-[44px] disabled:opacity-50"
          disabled={!occurredAt || isSaving}
          onClick={() =>
            onSave({
              entry_type: type,
              subtype: subtype || null,
              occurred_at: occurredAt,
              value: value ? Number(value) : null,
              notes: notes || null,
              upload_id: uploadId,
            })
          }
        >
          Add Entry
        </button>
        <button
          className="px-3 py-1 text-sm bg-gray-200 rounded min-h-[44px]"
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

function PinchZoomImage({ src, alt }: { src: string; alt: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [translate, setTranslate] = useState({ x: 0, y: 0 })
  const gestureRef = useRef<{
    initialDistance: number
    initialScale: number
    initialMid: { x: number; y: number }
    lastMid: { x: number; y: number }
    initialTranslate: { x: number; y: number }
  } | null>(null)

  const clampTranslate = useCallback(
    (tx: number, ty: number, s: number) => {
      if (s <= 1) return { x: 0, y: 0 }
      const el = containerRef.current
      if (!el) return { x: tx, y: ty }
      const maxX = (el.scrollWidth * (s - 1)) / 2
      const maxY = (el.scrollHeight * (s - 1)) / 2
      return {
        x: Math.max(-maxX, Math.min(maxX, tx)),
        y: Math.max(-maxY, Math.min(maxY, ty)),
      }
    },
    [],
  )

  const getDistance = (t1: Touch, t2: Touch) =>
    Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY)

  const getMid = (t1: Touch, t2: Touch) => ({
    x: (t1.clientX + t2.clientX) / 2,
    y: (t1.clientY + t2.clientY) / 2,
  })

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault()
        const d = getDistance(e.touches[0], e.touches[1])
        const mid = getMid(e.touches[0], e.touches[1])
        gestureRef.current = {
          initialDistance: d,
          initialScale: scale,
          initialMid: mid,
          lastMid: mid,
          initialTranslate: { ...translate },
        }
      }
    },
    [scale, translate],
  )

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 2 && gestureRef.current) {
        e.preventDefault()
        const g = gestureRef.current
        const d = getDistance(e.touches[0], e.touches[1])
        const mid = getMid(e.touches[0], e.touches[1])
        const newScale = Math.max(1, Math.min(5, g.initialScale * (d / g.initialDistance)))
        const dx = mid.x - g.initialMid.x
        const dy = mid.y - g.initialMid.y
        const newTranslate = clampTranslate(
          g.initialTranslate.x + dx,
          g.initialTranslate.y + dy,
          newScale,
        )
        g.lastMid = mid
        setScale(newScale)
        setTranslate(newTranslate)
      }
    },
    [clampTranslate],
  )

  const onTouchEnd = useCallback(() => {
    gestureRef.current = null
  }, [])

  const resetZoom = useCallback(() => {
    if (scale > 1) {
      setScale(1)
      setTranslate({ x: 0, y: 0 })
    }
  }, [scale])

  return (
    <div
      ref={containerRef}
      className={`flex-1 min-h-0 ${scale > 1 ? 'overflow-hidden' : 'overflow-auto'} p-4 pt-2 relative`}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      style={{ touchAction: scale > 1 ? 'none' : 'pan-y' }}
    >
      <img
        src={src}
        alt={alt}
        className="w-full rounded-lg border border-gray-200"
        draggable={false}
        style={{
          transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
          transformOrigin: 'center center',
          transition: gestureRef.current ? 'none' : 'transform 0.2s ease-out',
        }}
      />
      {scale > 1 && (
        <button
          className="absolute top-3 right-5 bg-black/50 text-white text-xs px-2 py-1 rounded"
          onClick={resetZoom}
        >
          Reset zoom
        </button>
      )}
    </div>
  )
}
