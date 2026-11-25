import type {
  CloseReceiptView,
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

export interface SecurityView {
  mode: string
  testnetOnly: boolean
  mainnetOptIn: boolean
  keySafety: {
    verified: boolean
    withdrawals: boolean | null
    futures: boolean | null
    ipRestrict: boolean | null
    margin: boolean | null
    mainnet: boolean
    warning?: string
  } | null
  telegram: {
    mode: 'telegram' | 'mock' | 'off'
    paired: boolean
    chatIdMasked: string | null
    thresholds: { minutes: number; bufferPct: number; cooldownMs: number }
    recent: Array<{ at: number; kind: string; text: string }>
  } | null
}

export const api = {
  state: () => request<StateResponse>('/api/state'),

  security: () => request<SecurityView>('/api/security'),

  telegramTest: () => request<{ ok: boolean }>('/api/telegram/test', { method: 'POST' }),

  setAlert: (price: number, symbol?: string) =>
    request<{ alert: { symbol: string; price: number; direction: 'above' | 'below' } }>('/api/alert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ price, symbol }),
    }),

  clearAlert: () => request<{ ok: boolean }>('/api/alert', { method: 'DELETE' }),

  intent: (text: string, symbol?: string) =>
    request<VoiceResponse>('/api/intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, symbol }),
    }),

  voice: (pcm: Uint8Array, symbol?: string) =>
    request<VoiceResponse>(`/api/voice${symbol ? `?symbol=${encodeURIComponent(symbol)}` : ''}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: pcm as unknown as BodyInit,
    }),

  previewCloseHalf: (symbol?: string) =>
    request<{ preview: OrderPreviewView }>('/api/orders/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...orderAuth() },
      body: JSON.stringify({ symbol }),
    }),

  executeCloseHalf: (id: string) =>
    request<{
      fill: OrderFillView
      position: PositionView
      preview: OrderPreviewView
      receipt: CloseReceiptView | null
    }>('/api/orders/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...orderAuth() },
      body: JSON.stringify({ id }),
    }),
}
