import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { api } from '../api/client'
import type { Upload } from '../types'
import { formatDateRu } from '../components/dashboard/utils'
import { BR } from '../components/br/theme'
import { PageHead } from '../components/br/PageHead'
import { Rule } from '../components/br/Rule'

export const Route = createFileRoute('/')({
  component: UploadPage,
})

const UPLOAD_PENDING_KEY = 'babylog_upload_pending'

const STATUS_PALETTE: Record<string, { color: string; label: string }> = {
  done: { color: BR.amber, label: 'PARSED' },
  processing: { color: BR.cyan, label: 'SCANNING' },
  pending: { color: BR.dim, label: 'QUEUED' },
  failed: { color: BR.blood, label: 'REJECTED' },
}

function formatDateCounts(dateCounts: Record<string, number>): string {
  const entries = Object.entries(dateCounts)
  const MAX_DATES = 3
  const parts = entries
    .slice(0, MAX_DATES)
    .map(([date, count]) => `${formatDateRu(date)}: ${count}`)
  let result = parts.join(' | ')
  if (entries.length > MAX_DATES) {
    result += ' ...'
  }
  return result
}

function UploadPage() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const uploadsQuery = useQuery({
    queryKey: ['uploads'],
    queryFn: () => api.get<{ uploads: Upload[] }>('/api/uploads'),
    refetchInterval: (query) => {
      const data = query.state.data
      const hasActive = data?.uploads.some(
        (u) => u.status === 'pending' || u.status === 'processing',
      )
      return hasActive ? 2000 : false
    },
  })

  const uploadMutation = useMutation({
    mutationFn: (file: File) => {
      sessionStorage.setItem(UPLOAD_PENDING_KEY, '1')
      const formData = new FormData()
      formData.append('file', file)
      return api.upload<Upload>('/api/uploads', formData)
    },
    onSuccess: () => {
      sessionStorage.removeItem(UPLOAD_PENDING_KEY)
      queryClient.invalidateQueries({ queryKey: ['uploads'] })
      if (fileInputRef.current) fileInputRef.current.value = ''
    },
    onError: () => {
      sessionStorage.removeItem(UPLOAD_PENDING_KEY)
    },
  })

  useEffect(() => {
    const recoverIfNeeded = () => {
      if (sessionStorage.getItem(UPLOAD_PENDING_KEY)) {
        sessionStorage.removeItem(UPLOAD_PENDING_KEY)
        queryClient.invalidateQueries({ queryKey: ['uploads'] })
      }
    }

    recoverIfNeeded()

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        recoverIfNeeded()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [queryClient])

  const reprocessMutation = useMutation({
    mutationFn: (id: number) => api.post<Upload>(`/api/uploads/${id}/reprocess`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['uploads'] })
    },
  })

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      uploadMutation.mutate(file)
    }
  }

  const uploads = uploadsQuery.data?.uploads ?? []
  const activeCount = uploads.filter(
    (u) => u.status === 'pending' || u.status === 'processing',
  ).length

  return (
    <>
      <PageHead
        kicker="INGEST · HANDWRITING → STRUCT"
        title={
          <>
            Сканиро<span style={{ color: BR.amber }}>вание</span>
          </>
        }
        meta={[
          'LLM · VISION',
          'RU → JSON',
          activeCount > 0 ? `QUEUE ${activeCount}/${uploads.length || activeCount}` : 'IDLE',
        ]}
      />

      <div className="px-5 pb-28">
        {/* Scan target */}
        <label
          className="relative flex flex-col items-center justify-center gap-2 overflow-hidden cursor-pointer"
          style={{
            height: 260,
            border: `1px solid ${BR.amber}`,
            background: `radial-gradient(circle at 50% 30%, rgba(255,179,71,0.10), transparent 60%), ${BR.char}`,
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
            disabled={uploadMutation.isPending}
          />
          {/* grid background */}
          <div
            className="absolute inset-0"
            style={{
              opacity: 0.35,
              backgroundImage: `linear-gradient(${BR.line} 1px, transparent 1px), linear-gradient(90deg, ${BR.line} 1px, transparent 1px)`,
              backgroundSize: '24px 24px',
            }}
          />
          {/* reticle */}
          <svg
            width="84"
            height="84"
            viewBox="0 0 84 84"
            fill="none"
            style={{ position: 'relative' }}
            aria-hidden
          >
            <path
              d="M4 20V4h16M64 4h16v16M80 64v16H64M20 80H4V64"
              stroke={BR.amber}
              strokeWidth="1.5"
            />
            <circle cx="42" cy="42" r="14" stroke={BR.amber} strokeWidth="1" opacity="0.6" />
            <circle cx="42" cy="42" r="3" fill={BR.amber} />
            <path d="M42 28v6M42 50v6M28 42h6M50 42h6" stroke={BR.amber} strokeWidth="1" />
          </svg>
          <div
            className="relative uppercase"
            style={{
              fontFamily: BR.mono,
              fontSize: 11,
              letterSpacing: 3,
              color: BR.amber,
              textShadow: `0 0 10px ${BR.amberGlow}`,
            }}
          >
            {uploadMutation.isPending ? 'UPLOADING…' : 'TAP TO CAPTURE'}
          </div>
          <div
            className="relative text-center max-w-[280px]"
            style={{
              fontFamily: BR.serif,
              fontStyle: 'italic',
              fontSize: 15,
              color: BR.body,
              lineHeight: 1.3,
            }}
          >
            «Нажмите, чтобы загрузить страницу из блокнота»
          </div>
          {/* bracket corners */}
          {(['tl', 'tr', 'bl', 'br'] as const).map((k) => (
            <span
              key={k}
              className="absolute"
              style={{
                top: k.includes('t') ? 8 : undefined,
                bottom: k.includes('b') ? 8 : undefined,
                left: k.includes('l') ? 8 : undefined,
                right: k.includes('r') ? 8 : undefined,
                width: 16,
                height: 16,
                borderTop: k.includes('t') ? `2px solid ${BR.amber}` : 'none',
                borderBottom: k.includes('b') ? `2px solid ${BR.amber}` : 'none',
                borderLeft: k.includes('l') ? `2px solid ${BR.amber}` : 'none',
                borderRight: k.includes('r') ? `2px solid ${BR.amber}` : 'none',
              }}
            />
          ))}
          {/* scan line */}
          <div
            aria-hidden
            className="absolute left-0 right-0"
            style={{
              top: '40%',
              height: 1,
              background: `linear-gradient(to right, transparent, ${BR.amber}, transparent)`,
              boxShadow: `0 0 14px ${BR.amberGlow}`,
              animation: 'brScan2 3.2s infinite ease-in-out',
            }}
          />
        </label>

        {uploadMutation.isError && (
          <div
            className="mt-2 px-3 py-2 uppercase"
            style={{
              border: `1px solid ${BR.blood}`,
              fontFamily: BR.mono,
              fontSize: 10,
              letterSpacing: 1.5,
              color: BR.blood,
            }}
          >
            [ERR] upload failed · {uploadMutation.error.message}
          </div>
        )}

        <Rule label="QUEUE · RECENT INGEST" />

        <div className="flex flex-col gap-2">
          {uploads.length === 0 && (
            <div
              className="px-3 py-4 text-center uppercase"
              style={{
                border: `1px dashed ${BR.line}`,
                fontFamily: BR.mono,
                fontSize: 10,
                letterSpacing: 2,
                color: BR.dim,
              }}
            >
              — no uploads yet —
            </div>
          )}
          {uploads.map((upload) => {
            const palette = STATUS_PALETTE[upload.status] ?? STATUS_PALETTE.pending
            const ts = upload.date_counts
              ? formatDateCounts(upload.date_counts)
              : `${upload.entry_count ?? 0} entries`
            return (
              <div
                key={upload.id}
                className="grid items-center gap-3"
                style={{
                  gridTemplateColumns: '38px 1fr auto',
                  padding: '12px 12px',
                  border: `1px solid ${BR.line}`,
                  borderLeft: `2px solid ${palette.color}`,
                  background: 'rgba(255,179,71,0.02)',
                }}
              >
                <button
                  className="relative overflow-hidden"
                  onClick={() => {
                    if (upload.status === 'done') {
                      navigate({ to: '/review', search: { uploadId: upload.id } })
                    }
                  }}
                  style={{
                    width: 38,
                    height: 48,
                    background: BR.char2,
                    border: `1px solid ${BR.line}`,
                  }}
                  aria-label="Открыть"
                >
                  <div
                    className="absolute"
                    style={{
                      inset: 4,
                      backgroundImage:
                        'repeating-linear-gradient(to bottom, rgba(255,179,71,0.25) 0 1px, transparent 1px 3px)',
                    }}
                  />
                  {upload.status === 'processing' && (
                    <div
                      className="absolute"
                      style={{
                        left: 2,
                        right: 2,
                        top: '50%',
                        height: 1,
                        background: BR.cyan,
                        boxShadow: `0 0 8px ${BR.cyan}`,
                        animation: 'brScan 1.8s infinite linear',
                      }}
                    />
                  )}
                </button>
                <button
                  className="min-w-0 text-left"
                  onClick={() => {
                    if (upload.status === 'done') {
                      navigate({ to: '/review', search: { uploadId: upload.id } })
                    }
                  }}
                >
                  <div
                    className="truncate"
                    style={{
                      fontFamily: BR.mono,
                      fontSize: 12,
                      color: BR.text,
                      letterSpacing: 0.5,
                    }}
                  >
                    {upload.filename}
                  </div>
                  <div
                    className="uppercase mt-0.5"
                    style={{
                      fontFamily: BR.mono,
                      fontSize: 9,
                      letterSpacing: 1.8,
                      color: BR.dim,
                    }}
                  >
                    {upload.status === 'done' && (
                      <>
                        <span>{ts}</span>
                      </>
                    )}
                    {upload.status === 'processing' && (
                      <span style={{ color: BR.cyan }}>scanning…</span>
                    )}
                    {upload.status === 'pending' && <span>queued</span>}
                    {upload.status === 'failed' && upload.error_message && (
                      <span style={{ color: BR.blood }}>· {upload.error_message}</span>
                    )}
                  </div>
                </button>
                {upload.status === 'failed' ? (
                  <button
                    onClick={() => reprocessMutation.mutate(upload.id)}
                    disabled={reprocessMutation.isPending}
                    className="uppercase"
                    style={{
                      fontFamily: BR.mono,
                      fontSize: 9,
                      letterSpacing: 2,
                      color: BR.blood,
                      padding: '4px 8px',
                      border: `1px solid ${BR.blood}`,
                      textShadow: `0 0 6px ${BR.blood}55`,
                    }}
                  >
                    RETRY
                  </button>
                ) : (
                  <div
                    className="uppercase"
                    style={{
                      fontFamily: BR.mono,
                      fontSize: 9,
                      letterSpacing: 2,
                      color: palette.color,
                      padding: '4px 8px',
                      border: `1px solid ${palette.color}`,
                      textShadow: `0 0 6px ${palette.color}55`,
                    }}
                  >
                    {palette.label}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* console footer */}
        <div
          className="mt-4"
          style={{
            border: `1px solid ${BR.line}`,
            background: BR.char,
            padding: 12,
            fontFamily: BR.mono,
            fontSize: 10,
            color: BR.dim,
            letterSpacing: 0.5,
            lineHeight: 1.6,
          }}
        >
          <div>
            <span style={{ color: BR.amber }}>›</span> model: claude vision · handwritten ru
          </div>
          <div>
            <span style={{ color: BR.amber }}>›</span> ingest: {uploads.length} total ·{' '}
            {activeCount} active
          </div>
          {activeCount > 0 && (
            <div>
              <span style={{ color: BR.cyan }}>›</span> parsing queue{' '}
              <span style={{ color: BR.cyan }}>▓▓▓▓░░░</span>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
