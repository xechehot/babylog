import { describe, it, expect, vi, beforeEach } from 'vitest'
import { api } from './client'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

beforeEach(() => {
  mockFetch.mockReset()
})

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('api.get', () => {
  it('sends GET request and returns JSON', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ entries: [] }))

    const result = await api.get<{ entries: unknown[] }>('/api/entries')

    expect(result).toEqual({ entries: [] })
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/entries'),
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('throws on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ detail: 'Not found' }), { status: 404 }),
    )

    await expect(api.get('/api/entries/999')).rejects.toThrow('Not found')
  })
})

describe('api.post', () => {
  it('sends POST with JSON body', async () => {
    const entry = { entry_type: 'feeding', occurred_at: '2026-03-10T08:00:00' }
    mockFetch.mockResolvedValueOnce(jsonResponse({ id: 1, ...entry }, 201))

    const result = await api.post<{ id: number }>('/api/entries', entry)

    expect(result.id).toBe(1)
    const [, opts] = mockFetch.mock.calls[0]
    expect(opts.method).toBe('POST')
    expect(opts.headers['Content-Type']).toBe('application/json')
    expect(JSON.parse(opts.body)).toEqual(entry)
  })
})

describe('api.patch', () => {
  it('sends PATCH with JSON body', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ id: 1, value: 150 }))

    const result = await api.patch<{ value: number }>('/api/entries/1', { value: 150 })

    expect(result.value).toBe(150)
    const [, opts] = mockFetch.mock.calls[0]
    expect(opts.method).toBe('PATCH')
  })
})

describe('api.del', () => {
  it('sends DELETE and handles 204', async () => {
    mockFetch.mockResolvedValueOnce(new Response(null, { status: 204 }))

    const result = await api.del('/api/entries/1')

    expect(result).toBeUndefined()
    const [, opts] = mockFetch.mock.calls[0]
    expect(opts.method).toBe('DELETE')
  })
})
