import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
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
  pee: 'Pee',
  poo: 'Poo',
  weight: 'Weight',
  diaper_dry: 'Dry diaper',
}

const TYPE_ICONS: Record<EntryType, string> = {
  feeding: '\u{1F37C}',
  pee: '\u{1F4A7}',
  poo: '\u{1F4A9}',
  weight: '\u{2696}\u{FE0F}',
  diaper_dry: '\u{2705}',
}

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
    mutationFn: ({ id, ...data }: { id: number; entry_type?: string; occurred_at?: string; value?: number | null; notes?: string | null }) =>
      api.patch<Entry>(`/api/entries/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['upload', uploadId] })
      setEditingId(null)
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

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">Review</h1>

      {/* Upload selector */}
      <select
        className="w-full p-2 border border-gray-300 rounded-lg mb-4 bg-white"
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

      {/* Uploaded image */}
      {uploadId && detail?.status === 'done' && (
        <>
          <div className="mb-4">
            <img
              src={`${BASE_PATH}/api/uploads/${uploadId}/image`}
              alt="Uploaded log"
              className="w-full rounded-lg border border-gray-200"
            />
          </div>

          {/* Confidence legend */}
          <div className="flex gap-4 mb-4 text-xs text-gray-500">
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
                    onEdit={() => setEditingId(entry.id)}
                    onCancel={() => setEditingId(null)}
                    onSave={(data) =>
                      updateMutation.mutate({ id: entry.id, ...data })
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
  onDelete,
  isSaving,
}: {
  entry: Entry
  isEditing: boolean
  onEdit: () => void
  onCancel: () => void
  onSave: (data: { entry_type?: string; occurred_at?: string; value?: number | null; notes?: string | null }) => void
  onDelete: () => void
  isSaving: boolean
}) {
  const [editType, setEditType] = useState(entry.entry_type)
  const [editTime, setEditTime] = useState(entry.occurred_at)
  const [editValue, setEditValue] = useState(entry.value?.toString() ?? '')
  const [editNotes, setEditNotes] = useState(entry.notes ?? '')

  const confidenceStyle =
    CONFIDENCE_STYLES[entry.confidence ?? 'high'] ?? CONFIDENCE_STYLES.high

  if (isEditing) {
    return (
      <div className={`bg-white rounded-lg border border-blue-300 p-3 ${confidenceStyle}`}>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <select
            className="p-1 border rounded text-sm"
            value={editType}
            onChange={(e) => setEditType(e.target.value as EntryType)}
          >
            {Object.entries(TYPE_LABELS).map(([val, label]) => (
              <option key={val} value={val}>
                {label}
              </option>
            ))}
          </select>
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
  const icon = TYPE_ICONS[entry.entry_type] ?? ''

  return (
    <div className={`bg-white rounded-lg border border-gray-200 p-3 ${confidenceStyle}`}>
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
