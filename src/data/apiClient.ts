const apiBase = (import.meta.env.VITE_API_BASE_URL ?? '/api').replace(/\/$/, '')

export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export function hasLocalSession() {
  return localStorage.getItem('bar-user') !== null
}

async function send(path: string, options: RequestInit) {
  return await fetch(`${apiBase}${path}`, {
    ...options,
    credentials: 'include',
  })
}

export async function apiBlobRequest(path: string) {
  let response = await send(path, { method: 'GET' })
  if (response.status === 401) {
    const refresh = await send('/auth/refresh', { method: 'POST' })
    if (refresh.ok) response = await send(path, { method: 'GET' })
  }
  if (!response.ok) {
    throw new ApiError(`Unable to download a synced item image (${response.status}).`, response.status)
  }
  const blob = await response.blob()
  const contentType = response.headers.get('Content-Type')?.split(';')[0] ?? ''
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(contentType)) {
    throw new ApiError('The server returned an unsupported item image format.', response.status)
  }
  return { blob, contentType }
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  authenticated = true,
): Promise<T> {
  const headers = new Headers(options.headers)
  if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  const requestOptions = { ...options, headers }
  let response: Response
  try {
    response = await send(path, requestOptions)
    if (response.status === 401 && authenticated && path !== '/auth/refresh') {
      const refresh = await send('/auth/refresh', { method: 'POST' })
      if (refresh.ok) response = await send(path, requestOptions)
    }
  } catch {
    throw new ApiError('The server could not be reached. Your changes remain saved on this device.', 0)
  }
  if (!response.ok) {
    let message = `Request failed (${response.status}).`
    try {
      const body = await response.json() as { error?: string }
      if (body.error) message = body.error
    } catch {
      // Use the HTTP status message when the API response has no JSON body.
    }
    throw new ApiError(message, response.status)
  }
  if (response.status === 204) return undefined as T
  return await response.json() as T
}

export async function clearServerSession() {
  await apiRequest<void>('/auth/logout', { method: 'POST' }, false)
}
