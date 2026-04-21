import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useRef, useState } from 'react'
import { api } from '../api/client'
import type { Entry, EntryType, Upload, UploadDetail } from '../types'
import { BR, entryAccent } from '../components/br/theme'
import { PageHead } from '../components/br/PageHead'
import { Rule } from '../components/br/Rule'
import { GlyphDot } from '../components/br/GlyphDot'

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
  feeding: 'FEEDING',
  diaper: 'DIAPER',
  weight: 'WEIGHT',
  pills: 'PILLS',
}

const FEEDING_SUBTYPES = ['breast', 'formula'] as const
const DIAPER_SUBTYPES = ['pee', 'poo', 'dry', 'pee+poo'] as const
const PILLS_SUBTYPES = ['vigantol'] as const

const CONFIDENCE_COLOR: Record<string, string> = {
  high: BR.amber,
  medium: '#d7a85c',
  low: BR.blood,
}

const APPROVED_COLOR = '#7fe0a4'
const APPROVED_BG = 'rgba(127,224,164,0.08)'
const APPROVED_GLOW = 'rgba(127,224,164,0.55)'

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
      confirmed?: boolean
    }) => api.patch<Entry>(`/api/entries/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['upload', uploadId] })
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
      upload_id?: number | null
    }) => api.post<Entry>('/api/entries', data),
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

  const wipeMutation = useMutation({
    mutationFn: (id: number) => api.del(`/api/uploads/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['uploads'] })
      queryClient.removeQueries({ queryKey: ['upload', uploadId] })
      navigate({ to: '/review', search: {} })
    },
  })

  const rescanMutation = useMutation({
    mutationFn: (id: number) => api.post(`/api/uploads/${id}/reprocess`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['uploads'] })
      queryClient.invalidateQueries({ queryKey: ['upload', uploadId] })
    },
  })

  const doneUploads = (uploadsQuery.data?.uploads ?? []).filter((u) => u.status === 'done')
  const detail = detailQuery.data
  const entries = detail?.entries ?? []

  const grouped = entries.reduce<Record<string, Entry[]>>((acc, entry) => {
    const d = entry.date
    if (!acc[d]) acc[d] = []
    acc[d].push(entry)
    return acc
  }, {})

  const showSplitView = uploadId && detail?.status === 'done'

  const confCounts = entries.reduce(
    (acc, e) => {
      const c = e.confidence ?? 'high'
      acc[c] = (acc[c] ?? 0) + 1
      return acc
    },
    {} as Record<string, number>,
  )
  const lowCount = confCounts.low ?? 0
  const flagStr = lowCount > 0 ? `${lowCount} FLAG` : '0 FLAGS'

  const currentUpload = detail ? doneUploads.find((u) => u.id === uploadId) : null

  return (
    <div
      className="flex flex-col"
      style={{
        // TopBar (~49px) + pb-20 on outlet wrapper (80px) = ~129px; buffer to 140px
        height: 'calc(100dvh - 140px)',
      }}
    >
      <div className="shrink-0">
        <PageHead
          kicker="AUDIT · PARSE vs SOURCE"
          title={
            <>
              Audit<span style={{ color: BR.amber, fontStyle: 'italic' }}>.</span>
            </>
          }
          meta={[
            currentUpload?.filename ?? (uploadId ? `UPLOAD #${uploadId}` : 'SELECT UPLOAD'),
            `${entries.length} RECORDS`,
            flagStr,
          ]}
        />

        <div className="px-5">
          <div
            className="flex items-center gap-2"
            style={{
              padding: '10px 12px',
              border: `1px solid ${BR.line}`,
              background: BR.char,
            }}
          >
            <span
              style={{
                fontFamily: BR.mono,
                fontSize: 10,
                letterSpacing: 2,
                color: BR.amber,
              }}
            >
              SRC
            </span>
            <select
              value={uploadId ?? ''}
              onChange={(e) => {
                const val = e.target.value
                navigate({
                  to: '/review',
                  search: val ? { uploadId: Number(val) } : {},
                })
              }}
              className="flex-1"
              style={{
                fontFamily: BR.mono,
                fontSize: 12,
                color: BR.text,
                background: 'transparent',
                border: 'none',
                padding: 0,
                letterSpacing: 0.5,
              }}
            >
              <option value="">— select an upload —</option>
              {doneUploads.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.filename} ({u.entry_count ?? 0})
                </option>
              ))}
            </select>
          </div>
          {uploadId && detail && (detail.status === 'done' || detail.status === 'failed') && (
            <div className="flex gap-2 mt-2">
              <button
                disabled={rescanMutation.isPending || wipeMutation.isPending}
                onClick={() => {
                  if (confirm('Re-scan this image? Existing entries will be deleted and regenerated.')) {
                    rescanMutation.mutate(uploadId)
                  }
                }}
                className="flex-1 uppercase"
                style={{
                  fontFamily: BR.mono,
                  fontSize: 10,
                  letterSpacing: 2,
                  padding: '8px 10px',
                  minHeight: 36,
                  color: BR.amber,
                  border: `1px solid ${BR.amber}`,
                  background: 'rgba(255,179,71,0.08)',
                  opacity: rescanMutation.isPending || wipeMutation.isPending ? 0.5 : 1,
                }}
              >
                ↻ RESCAN
              </button>
              <button
                disabled={rescanMutation.isPending || wipeMutation.isPending}
                onClick={() => {
                  if (
                    confirm(
                      'Wipe this upload? The image and all its entries will be permanently deleted.',
                    )
                  ) {
                    wipeMutation.mutate(uploadId)
                  }
                }}
                className="flex-1 uppercase"
                style={{
                  fontFamily: BR.mono,
                  fontSize: 10,
                  letterSpacing: 2,
                  padding: '8px 10px',
                  minHeight: 36,
                  color: BR.blood,
                  border: `1px solid ${BR.blood}`,
                  background: 'rgba(255,77,77,0.08)',
                  opacity: rescanMutation.isPending || wipeMutation.isPending ? 0.5 : 1,
                }}
              >
                ✕ WIPE
              </button>
            </div>
          )}
        </div>
      </div>

      {!uploadId && (
        <div className="flex-1 min-h-0 flex items-center justify-center">
          <p
            className="uppercase"
            style={{ fontFamily: BR.mono, fontSize: 10, letterSpacing: 2, color: BR.dim }}
          >
            Select an upload to review
          </p>
        </div>
      )}

      {uploadId && detail?.status === 'processing' && (
        <div className="flex-1 min-h-0 flex items-center justify-center">
          <p
            className="uppercase"
            style={{
              fontFamily: BR.mono,
              fontSize: 11,
              letterSpacing: 2.5,
              color: BR.cyan,
              textShadow: `0 0 8px ${BR.cyanGlow}`,
            }}
          >
            ▓▓▓▓░░░ SCANNING…
          </p>
        </div>
      )}

      {uploadId && detail?.status === 'pending' && (
        <div className="flex-1 min-h-0 flex items-center justify-center">
          <p
            className="uppercase"
            style={{ fontFamily: BR.mono, fontSize: 10, letterSpacing: 2, color: BR.dim }}
          >
            ░░░ QUEUED
          </p>
        </div>
      )}

      {uploadId && detail?.status === 'failed' && (
        <div className="flex-1 min-h-0 flex items-center justify-center px-5">
          <p
            className="text-center uppercase"
            style={{
              fontFamily: BR.mono,
              fontSize: 11,
              letterSpacing: 1.5,
              color: BR.blood,
            }}
          >
            [ERR] {detail.error_message}
          </p>
        </div>
      )}

      {showSplitView && (
        <>
          {/* Image source caption */}
          <div
            className="shrink-0 px-5 mt-2 flex justify-between items-center uppercase"
            style={{
              fontFamily: BR.mono,
              fontSize: 9,
              letterSpacing: 1.8,
              color: BR.dim,
            }}
          >
            <span>SOURCE · {currentUpload?.filename ?? `#${uploadId}`}</span>
            <span style={{ color: BR.amber }}>[ pinch · zoom ]</span>
          </div>

          {/* Image pane — independently scrollable / zoomable */}
          <PinchZoomImage
            src={`${BASE_PATH}/api/uploads/${uploadId}/image`}
            alt="Uploaded log"
            className="flex-1 min-h-0 mx-5 mt-1.5"
          />

          {/* Divider label — sits between the two scroll panes */}
          <div className="shrink-0">
            <Rule label={`EXTRACTED · ${entries.length}`} />
          </div>

          {/* Entries pane — independently scrollable */}
          <div className="flex-1 min-h-0 overflow-y-auto">
            {/* Confidence strip */}
            <div className="px-5 flex gap-2.5 mb-2">
              {(['high', 'medium', 'low'] as const).map((c) => {
                const color = CONFIDENCE_COLOR[c]
                const count = confCounts[c] ?? 0
                return (
                  <div
                    key={c}
                    className="flex-1 flex justify-between uppercase"
                    style={{
                      fontFamily: BR.mono,
                      fontSize: 10,
                      letterSpacing: 1.5,
                      color,
                      padding: '8px 10px',
                      border: `1px solid ${color}`,
                      boxShadow: c === 'low' && count > 0 ? `0 0 12px ${color}45` : 'none',
                    }}
                  >
                    <span>{c.toUpperCase().slice(0, 4)}</span>
                    <span>{count}</span>
                  </div>
                )
              })}
            </div>

            <div className="px-5">
              <div style={{ border: `1px solid ${BR.line}`, background: BR.char }}>
                {Object.entries(grouped).map(([date, dayEntries]) => (
                  <div key={date}>
                    <div
                      className="uppercase"
                      style={{
                        padding: '8px 14px',
                        fontFamily: BR.mono,
                        fontSize: 9,
                        letterSpacing: 2.5,
                        color: BR.dim,
                        borderBottom: `1px dashed ${BR.line}`,
                        background: 'rgba(255,179,71,0.04)',
                      }}
                    >
                      ░ {date}
                    </div>
                    {dayEntries.map((entry) => (
                      <EntryCard
                        key={entry.id}
                        entry={entry}
                        isEditing={editingId === entry.id}
                        onEdit={() => {
                          setEditingId(entry.id)
                          setIsAdding(false)
                        }}
                        onCancel={() => setEditingId(null)}
                        onSave={(data) => updateMutation.mutate({ id: entry.id, ...data })}
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
                ))}
                {entries.length === 0 && (
                  <p
                    className="text-center py-4 uppercase"
                    style={{ fontFamily: BR.mono, fontSize: 10, letterSpacing: 2, color: BR.dim }}
                  >
                    no entries
                  </p>
                )}
              </div>
            </div>

            {/* Add missing */}
            <div className="px-5 mt-3 pb-6">
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
                  className="w-full uppercase"
                  onClick={() => {
                    setIsAdding(true)
                    setEditingId(null)
                  }}
                  style={{
                    padding: '12px',
                    border: `1px dashed ${BR.amber}`,
                    color: BR.amber,
                    fontFamily: BR.mono,
                    fontSize: 11,
                    letterSpacing: 2,
                    background: 'rgba(255,179,71,0.02)',
                    minHeight: 44,
                  }}
                >
                  ＋ ADD MISSING ENTRY
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function formatLabel(entryType: string, subtype: string | null): string {
  if (entryType === 'feeding') {
    if (subtype === 'breast') return 'BREAST'
    if (subtype === 'formula') return 'FORMULA'
    return 'FEEDING'
  }
  if (entryType === 'diaper') {
    if (subtype === 'pee') return 'WET'
    if (subtype === 'poo') return 'SOILED'
    if (subtype === 'pee+poo') return 'WET+SOILED'
    if (subtype === 'dry') return 'DRY'
    return 'DIAPER'
  }
  if (entryType === 'weight') return 'MASS'
  if (entryType === 'pills') {
    if (subtype === 'vigantol') return 'VIGANTOL'
    return 'PILLS'
  }
  return entryType.toUpperCase()
}

function formatValue(entry: Entry): string {
  if (entry.value == null) return ''
  if (entry.entry_type === 'weight') return `${entry.value} g`
  if (entry.entry_type === 'feeding') return `${entry.value} ml`
  return String(entry.value)
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
  onSave: (data: {
    entry_type?: string
    subtype?: string | null
    occurred_at?: string
    value?: number | null
    notes?: string | null
  }) => void
  onConfirm: () => void
  onDelete: () => void
  isSaving: boolean
}) {
  const [editType, setEditType] = useState(entry.entry_type)
  const [editSubtype, setEditSubtype] = useState(entry.subtype ?? '')
  const [editTime, setEditTime] = useState(entry.occurred_at)
  const [editValue, setEditValue] = useState(entry.value?.toString() ?? '')
  const [editNotes, setEditNotes] = useState(entry.notes ?? '')

  const confColor = CONFIDENCE_COLOR[entry.confidence ?? 'high']
  const accent = entryAccent(entry.entry_type, entry.subtype)
  const time = entry.occurred_at.split(' ')[1]?.slice(0, 5) ?? ''
  const valueStr = formatValue(entry)

  const inputStyle: React.CSSProperties = {
    fontFamily: BR.mono,
    fontSize: 14,
    color: BR.text,
    background: BR.char,
    border: `1px solid ${BR.line}`,
    padding: '8px 10px',
    minHeight: 40,
    width: '100%',
  }

  if (isEditing) {
    return (
      <div
        style={{
          padding: 12,
          borderBottom: `1px dashed ${BR.line}`,
          background: 'rgba(255,179,71,0.04)',
          borderLeft: `2px solid ${BR.amber}`,
        }}
      >
        <div className="grid grid-cols-3 gap-2 mb-2">
          <select
            style={inputStyle}
            value={editType}
            onChange={(e) => {
              const newType = e.target.value as EntryType
              setEditType(newType)
              if (newType === 'feeding') setEditSubtype('formula')
              else if (newType === 'diaper') setEditSubtype('pee')
              else if (newType === 'pills') setEditSubtype('vigantol')
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
              style={inputStyle}
              value={editSubtype}
              onChange={(e) => setEditSubtype(e.target.value)}
            >
              {FEEDING_SUBTYPES.map((s) => (
                <option key={s} value={s}>
                  {s}
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
                  {s}
                </option>
              ))}
            </select>
          )}
          {editType === 'pills' && (
            <select
              style={inputStyle}
              value={editSubtype}
              onChange={(e) => setEditSubtype(e.target.value)}
            >
              {PILLS_SUBTYPES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          )}
          <input
            type="text"
            style={inputStyle}
            value={editTime}
            onChange={(e) => setEditTime(e.target.value)}
            placeholder="YYYY-MM-DD HH:MM"
          />
        </div>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <input
            type="number"
            style={inputStyle}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            placeholder="value"
          />
          <input
            type="text"
            style={inputStyle}
            value={editNotes}
            onChange={(e) => setEditNotes(e.target.value)}
            placeholder="notes"
          />
        </div>
        <div className="flex gap-2">
          <button
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
            className="uppercase"
            style={{
              fontFamily: BR.mono,
              fontSize: 10,
              letterSpacing: 2,
              padding: '6px 12px',
              color: BR.amber,
              border: `1px solid ${BR.amber}`,
              background: 'rgba(255,179,71,0.1)',
            }}
          >
            SAVE
          </button>
          <button
            onClick={onCancel}
            className="uppercase"
            style={{
              fontFamily: BR.mono,
              fontSize: 10,
              letterSpacing: 2,
              padding: '6px 12px',
              color: BR.dim,
              border: `1px solid ${BR.line}`,
            }}
          >
            CANCEL
          </button>
        </div>
      </div>
    )
  }

  const conf = entry.confidence ?? 'high'
  let rowStyle: React.CSSProperties
  if (entry.confirmed) {
    rowStyle = {
      borderLeft: `2px solid ${APPROVED_COLOR}`,
      background: APPROVED_BG,
      boxShadow: 'inset 0 0 22px rgba(127,224,164,0.08)',
    }
  } else if (conf === 'low') {
    rowStyle = {
      borderLeft: `2px solid ${BR.blood}`,
      background: 'rgba(255,77,77,0.08)',
      boxShadow: 'inset 0 0 20px rgba(255,77,77,0.06)',
    }
  } else if (conf === 'medium') {
    rowStyle = {
      borderLeft: '2px solid #d7a85c',
      background: 'rgba(215,168,92,0.07)',
      boxShadow: 'none',
    }
  } else {
    rowStyle = {
      borderLeft: '2px solid transparent',
      background: 'transparent',
      boxShadow: 'none',
    }
  }

  return (
    <div
      className="grid items-center"
      style={{
        gridTemplateColumns: '48px 22px 1fr auto',
        gap: 10,
        padding: '10px 14px',
        borderBottom: `1px dashed ${BR.line}`,
        ...rowStyle,
      }}
    >
      <div
        style={{
          fontFamily: BR.mono,
          fontSize: 11,
          color: BR.text,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {time}
      </div>
      <GlyphDot entryType={entry.entry_type} subtype={entry.subtype} size={18} />
      <div className="min-w-0">
        <div
          className="uppercase"
          style={{
            fontFamily: BR.mono,
            fontSize: 9,
            letterSpacing: 1.8,
            color: accent,
          }}
        >
          {formatLabel(entry.entry_type, entry.subtype)}
        </div>
        {valueStr && (
          <div
            style={{
              fontFamily: BR.display,
              fontSize: 13,
              color: BR.text,
              marginTop: 1,
            }}
          >
            {valueStr}
          </div>
        )}
        {entry.notes && (
          <div
            className="truncate"
            title={entry.notes}
            style={{
              fontFamily: BR.serif,
              fontStyle: 'italic',
              fontSize: 12,
              color: BR.dim,
              marginTop: 1,
            }}
          >
            «{entry.notes}»
          </div>
        )}
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {entry.confirmed ? (
          <span
            className="uppercase"
            style={{
              fontFamily: BR.mono,
              fontSize: 8,
              letterSpacing: 1.5,
              color: APPROVED_COLOR,
              padding: '2px 6px',
              border: `1px solid ${APPROVED_COLOR}`,
              background: APPROVED_BG,
              textShadow: `0 0 6px ${APPROVED_GLOW}`,
            }}
          >
            ✓ OK
          </span>
        ) : conf === 'low' || conf === 'medium' ? (
          <span
            className="uppercase"
            style={{
              fontFamily: BR.mono,
              fontSize: 8,
              letterSpacing: 1.5,
              color: confColor,
              padding: '2px 6px',
              border: `1px solid ${confColor}`,
            }}
          >
            {conf.slice(0, 3)}
          </span>
        ) : null}
        <button
          onClick={onConfirm}
          className="uppercase"
          title={entry.confirmed ? 'Unconfirm' : 'Confirm'}
          style={{
            fontFamily: BR.mono,
            fontSize: 9,
            letterSpacing: 1.5,
            padding: '3px 6px',
            color: entry.confirmed ? BR.amber : BR.dim,
            border: `1px solid ${entry.confirmed ? BR.amber : BR.line}`,
            textShadow: entry.confirmed ? `0 0 6px ${BR.amberGlow}` : 'none',
          }}
        >
          ✓
        </button>
        <button
          onClick={onEdit}
          className="uppercase"
          style={{
            fontFamily: BR.mono,
            fontSize: 9,
            letterSpacing: 1.5,
            padding: '3px 6px',
            color: BR.dim,
            border: `1px solid ${BR.line}`,
          }}
        >
          EDIT
        </button>
        <button
          onClick={onDelete}
          className="uppercase"
          style={{
            fontFamily: BR.mono,
            fontSize: 9,
            letterSpacing: 1.5,
            padding: '3px 6px',
            color: BR.blood,
            border: `1px solid ${BR.blood}`,
          }}
        >
          DEL
        </button>
      </div>
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
  onSave: (data: {
    entry_type: string
    subtype?: string | null
    occurred_at: string
    value?: number | null
    notes?: string | null
    upload_id: number
  }) => void
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

  const inputStyle: React.CSSProperties = {
    fontFamily: BR.mono,
    fontSize: 14,
    color: BR.text,
    background: BR.char,
    border: `1px solid ${BR.line}`,
    padding: '10px 12px',
    minHeight: 44,
    width: '100%',
  }

  return (
    <div
      style={{
        padding: 14,
        border: `1px dashed ${BR.amber}`,
        background: 'rgba(255,179,71,0.04)',
      }}
    >
      <div
        className="mb-2 uppercase"
        style={{
          fontFamily: BR.mono,
          fontSize: 10,
          letterSpacing: 2.5,
          color: BR.amber,
          textShadow: `0 0 8px ${BR.amberGlow}`,
        }}
      >
        [ NEW ENTRY ]
      </div>
      <div className="grid grid-cols-2 gap-2 mb-2">
        <select
          style={inputStyle}
          value={type}
          onChange={(e) => {
            const newType = e.target.value as EntryType
            setType(newType)
            if (newType === 'feeding') setSubtype('formula')
            else if (newType === 'diaper') setSubtype('pee')
            else if (newType === 'pills') setSubtype('vigantol')
            else setSubtype('')
          }}
        >
          {Object.entries(TYPE_LABELS).map(([val, label]) => (
            <option key={val} value={val}>
              {label}
            </option>
          ))}
        </select>
        {type === 'feeding' && (
          <select style={inputStyle} value={subtype} onChange={(e) => setSubtype(e.target.value)}>
            {FEEDING_SUBTYPES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        )}
        {type === 'diaper' && (
          <select style={inputStyle} value={subtype} onChange={(e) => setSubtype(e.target.value)}>
            {DIAPER_SUBTYPES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        )}
        {type === 'pills' && (
          <select style={inputStyle} value={subtype} onChange={(e) => setSubtype(e.target.value)}>
            {PILLS_SUBTYPES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2 mb-2">
        <input
          type="date"
          style={inputStyle}
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <input
          ref={timeRef}
          type="time"
          style={inputStyle}
          value={time}
          onChange={(e) => setTime(e.target.value)}
          autoFocus
        />
      </div>
      <div className="grid grid-cols-2 gap-2 mb-2">
        <input
          type="number"
          style={inputStyle}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="value"
        />
        <input
          type="text"
          style={inputStyle}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="notes"
        />
      </div>
      <div className="flex gap-2">
        <button
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
          className="uppercase"
          style={{
            fontFamily: BR.mono,
            fontSize: 11,
            letterSpacing: 2,
            padding: '10px 12px',
            color: BR.amber,
            border: `1px solid ${BR.amber}`,
            background: 'rgba(255,179,71,0.12)',
            textShadow: `0 0 10px ${BR.amberGlow}`,
            minHeight: 44,
            opacity: !occurredAt || isSaving ? 0.5 : 1,
          }}
        >
          [ ADD ]
        </button>
        <button
          onClick={onCancel}
          className="uppercase"
          style={{
            fontFamily: BR.mono,
            fontSize: 11,
            letterSpacing: 2,
            padding: '10px 12px',
            color: BR.dim,
            border: `1px solid ${BR.line}`,
            minHeight: 44,
          }}
        >
          CANCEL
        </button>
      </div>
    </div>
  )
}

function PinchZoomImage({
  src,
  alt,
  className = '',
}: {
  src: string
  alt: string
  className?: string
}) {
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

  const clampTranslate = useCallback((tx: number, ty: number, s: number) => {
    if (s <= 1) return { x: 0, y: 0 }
    const el = containerRef.current
    if (!el) return { x: tx, y: ty }
    const maxX = (el.scrollWidth * (s - 1)) / 2
    const maxY = (el.scrollHeight * (s - 1)) / 2
    return {
      x: Math.max(-maxX, Math.min(maxX, tx)),
      y: Math.max(-maxY, Math.min(maxY, ty)),
    }
  }, [])

  const getDistance = (t1: React.Touch, t2: React.Touch) =>
    Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY)

  const getMid = (t1: React.Touch, t2: React.Touch) => ({
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
      className={`relative ${scale > 1 ? 'overflow-hidden' : 'overflow-auto'} ${className}`}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      style={{
        touchAction: scale > 1 ? 'none' : 'pan-y',
        border: `1px solid ${BR.line}`,
        background: BR.char2,
        padding: 4,
      }}
    >
      <img
        src={src}
        alt={alt}
        className="w-full"
        draggable={false}
        style={{
          transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
          transformOrigin: 'center center',
          transition: gestureRef.current ? 'none' : 'transform 0.2s ease-out',
          filter: 'brightness(0.92) contrast(1.05)',
        }}
      />
      {scale > 1 && (
        <button
          className="absolute top-2 right-2 uppercase"
          onClick={resetZoom}
          style={{
            fontFamily: BR.mono,
            fontSize: 10,
            letterSpacing: 2,
            color: BR.amber,
            padding: '4px 8px',
            border: `1px solid ${BR.amber}`,
            background: 'rgba(6,8,10,0.7)',
          }}
        >
          RESET
        </button>
      )}
    </div>
  )
}
