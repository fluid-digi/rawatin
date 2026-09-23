export class ApiError extends Error {
  status: number
  detail?: unknown
  constructor(status: number, message: string, detail?: unknown) {
    super(message)
    this.status = status
    this.detail = detail
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {}
  let payload: BodyInit | undefined
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
    payload = JSON.stringify(body)
  }
  const res = await fetch(`/api${path}`, { method, headers, body: payload, credentials: 'include' })
  const ct = res.headers.get('content-type') ?? ''
  const data = ct.includes('json') ? await res.json().catch(() => null) : await res.text()
  if (!res.ok) {
    const message = (data && typeof data === 'object' && 'error' in data ? String((data as { error: unknown }).error) : `HTTP ${res.status}`)
    throw new ApiError(res.status, message, data)
  }
  return data as T
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  del: <T>(path: string) => request<T>('DELETE', path),
}

/** Upload foto mentah (sudah terkompresi client-side). */
export async function uploadPhoto(orderId: string, blob: Blob, type: string, itemId?: string): Promise<{ id: string; url: string }> {
  const res = await fetch(`/api/t/${sessionStorage.getItem('slug')}/upload?orderId=${orderId}`, {
    method: 'POST',
    headers: {
      'Content-Type': blob.type || 'image/webp',
      'x-photo-type': type,
      ...(itemId ? { 'x-order-item-id': itemId } : {}),
    },
    body: blob,
    credentials: 'include',
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new ApiError(res.status, data?.error ?? 'Upload gagal', data)
  return data
}
