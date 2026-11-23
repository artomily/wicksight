import type {
  OrderFillView,
  OrderPreviewView,
  PositionView,
  StateResponse,
  VoiceResponse,
} from '../shared/types'

export const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? 'http://localhost:8787'

const APP_TOKEN = typeof __SG_API_TOKEN__ === 'string' ? __SG_API_TOKEN__ : ''
const orderAuth = (): Record<string, string> =>
  APP_TOKEN ? { Authorization: `Bearer ${APP_TOKEN}` } : {}

export class ApiError extends Error {
  readonly code: string
  readonly pausedUntil?: number

  constructor(message: string, code = 'HTTP', pausedUntil?: number) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.pausedUntil = pausedUntil
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    signal: AbortSignal.timeout(init.body instanceof Uint8Array ? 30_000 : 8_000),
  })
  const text = await res.text()
  let json: unknown = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    throw new Error(`Bad response from API (${res.status})`)
  }
  if (!res.ok) {
    const body = json as { message?: string; error?: string; meta?: { pausedUntil?: number } } | null
    throw new ApiError(
      body?.message || `API error ${res.status}`,
      body?.error || 'HTTP',
      body?.meta?.pausedUntil ?? undefined,
    )
  }
  return json as T
}

export const api = {
  state: () => request<StateResponse>('/api/state'),

  setAlert: (price: number) =>
    request<{ alert: { price: number; direction: 'above' | 'below' } }>('/api/alert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ price }),
    }),

  clearAlert: () => request<{ ok: boolean }>('/api/alert', { method: 'DELETE' }),

  intent: (text: string) =>
    request<VoiceResponse>('/api/intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    }),

  voice: (pcm: Uint8Array) =>
    request<VoiceResponse>('/api/voice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: pcm as unknown as BodyInit,
    }),

  previewCloseHalf: () =>
    request<{ preview: OrderPreviewView }>('/api/orders/preview', {
      method: 'POST',
      headers: orderAuth(),
    }),

  executeCloseHalf: (id: string) =>
    request<{ fill: OrderFillView; position: PositionView; preview: OrderPreviewView }>(
      '/api/orders/execute',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...orderAuth() },
        body: JSON.stringify({ id }),
      },
    ),
}
