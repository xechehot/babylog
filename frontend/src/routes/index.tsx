import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRef } from 'react'
import { api } from '../api/client'
import type { Upload } from '../types'

export const Route = createFileRoute('/')({
  component: UploadPage,
})

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  processing: 'bg-blue-100 text-blue-800',
  done: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
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
      const formData = new FormData()
      formData.append('file', file)
      return api.upload<Upload>('/api/uploads', formData)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['uploads'] })
      if (fileInputRef.current) fileInputRef.current.value = ''
    },
  })

  const reprocessMutation = useMutation({
    mutationFn: (id: number) => api.post<Upload>(`/api/uploads/${id}/reprocess`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['uploads'] })
    },
  })

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) uploadMutation.mutate(file)
  }

  const uploads = uploadsQuery.data?.uploads ?? []

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">babylog</h1>

      {/* Upload area */}
      <label className="block border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-400 transition-colors">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileChange}
          disabled={uploadMutation.isPending}
        />
        {uploadMutation.isPending ? (
          <p className="text-blue-600">Uploading...</p>
        ) : (
          <>
            <p className="text-gray-600 text-lg mb-1">Tap to upload photo</p>
            <p className="text-gray-400 text-sm">or take a photo of a handwritten log</p>
          </>
        )}
      </label>

      {uploadMutation.isError && (
        <p className="mt-2 text-red-600 text-sm">
          Upload failed: {uploadMutation.error.message}
        </p>
      )}

      {/* Upload list */}
      {uploads.length > 0 && (
        <div className="mt-6 space-y-3">
          <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide">
            Recent uploads
          </h2>
          {uploads.map((upload) => (
            <div
              key={upload.id}
              className="bg-white rounded-lg border border-gray-200 p-3 flex items-center justify-between"
            >
              <div
                className="flex-1 min-w-0 cursor-pointer"
                onClick={() => {
                  if (upload.status === 'done') {
                    navigate({ to: '/review', search: { uploadId: upload.id } })
                  }
                }}
              >
                <p className="text-sm font-medium truncate">{upload.filename}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span
                    className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[upload.status] ?? 'bg-gray-100 text-gray-800'}`}
                  >
                    {upload.status}
                  </span>
                  {upload.status === 'done' && (
                    <span className="text-xs text-gray-500">
                      {upload.entry_count} entries
                    </span>
                  )}
                  {upload.status === 'failed' && upload.error_message && (
                    <span className="text-xs text-red-500 truncate max-w-[200px]">
                      {upload.error_message}
                    </span>
                  )}
                </div>
              </div>
              {upload.status === 'failed' && (
                <button
                  onClick={() => reprocessMutation.mutate(upload.id)}
                  disabled={reprocessMutation.isPending}
                  className="ml-2 px-3 py-1 text-xs bg-red-50 text-red-700 rounded hover:bg-red-100"
                >
                  Retry
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
