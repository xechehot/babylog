const BASE_PATH = import.meta.env.BASE_URL.replace(/\/$/, '')

interface RequestOptions {
  method?: string
  body?: unknown
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body } = options

  const headers: Record<string, string> = {}
  if (body) {
    headers['Content-Type'] = 'application/json'
  }

  const response = await fetch(`${BASE_PATH}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }))
    const message = error.detail ?? `Request failed: ${response.status}`
    console.error(`[api] ${method} ${path} failed:`, response.status, message)
    throw new Error(message)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return response.json() as Promise<T>
}

async function uploadRequest<T>(path: string, formData: FormData): Promise<T> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 120_000)

  console.log('[upload] Starting upload to', path)

  try {
    const response = await fetch(`${BASE_PATH}${path}`, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    })

    clearTimeout(timeout)

    console.log('[upload] Response status:', response.status)

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }))
      const message = error.detail ?? `Upload failed: ${response.status}`
      console.error('[upload] Server error:', message)
      throw new Error(message)
    }

    const data = (await response.json()) as T
    console.log('[upload] Upload complete:', data)
    return data
  } catch (e) {
    clearTimeout(timeout)
    if (e instanceof DOMException && e.name === 'AbortError') {
      throw new Error('Upload timed out — please check your connection and try again')
    }
    throw e
  }
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) => request<T>(path, { method: 'POST', body }),
  patch: <T>(path: string, body: unknown) => request<T>(path, { method: 'PATCH', body }),
  del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  upload: <T>(path: string, formData: FormData) => uploadRequest<T>(path, formData),
}
