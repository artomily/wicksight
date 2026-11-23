import { ExchangeError } from './exchange/types.ts'

export type AlertDirection = 'above' | 'below'

export interface AlertSnapshot {
  price: number
  direction: AlertDirection
  createdAt: number
  triggeredAt: number | null
}

/**
 * One price alert at a time, checked on every position poll. Alerts only fire
 * while the app is polling — the G2 cannot show anything in the background, so
 * the UI is explicit about this.
 */
export class AlertStore {
  private alert: AlertSnapshot | null = null

  set(price: number, markPrice: number): AlertSnapshot {
    const direction: AlertDirection = price >= markPrice ? 'above' : 'below'
    this.alert = { price, direction, createdAt: Date.now(), triggeredAt: null }
    return this.alert
  }

  check(markPrice: number): AlertSnapshot | null {
    if (!this.alert || this.alert.triggeredAt) return this.alert
    const hit =
      this.alert.direction === 'above' ? markPrice >= this.alert.price : markPrice <= this.alert.price
    if (hit) this.alert.triggeredAt = Date.now()
    return this.alert
  }

  get(): AlertSnapshot | null {
    return this.alert
  }

  clear(): void {
    this.alert = null
  }
}

export interface StoredPreview {
  id: string
  symbol: string
  side: 'LONG' | 'SHORT'
  qty: number
  remaining: number
  qtyDecimals: number
  createdAt: number
}

const PREVIEW_TTL_MS = 45_000
const PREVIEW_KEEP_MS = 15 * 60_000
const USED_TTL_MS = 10 * 60_000

/**
 * A preview is the confirmation token: it carries the exact quantity the user
 * approved, can be consumed once, and expires quickly. A double tap cannot
 * send the same order twice, and a stale/consumed token gets a clean 4xx.
 */
export class PreviewStore {
  private previews = new Map<string, StoredPreview>()
  private used = new Map<string, number>()

  constructor(private readonly ttlMs = PREVIEW_TTL_MS) {}

  create(preview: StoredPreview): StoredPreview {
    this.prune()
    this.previews.set(preview.id, preview)
    return preview
  }

  take(id: string): StoredPreview {
    this.prune()

    if (this.used.has(id)) {
      throw new ExchangeError('This confirmation was already used. Hold to speak again.', 409, 'PREVIEW_USED')
    }

    const preview = this.previews.get(id)
    if (!preview) {
      throw new ExchangeError('Unknown confirmation. Hold to speak again.', 404, 'PREVIEW_UNKNOWN')
    }

    this.previews.delete(id)
    this.used.set(id, Date.now())

    if (Date.now() - preview.createdAt > this.ttlMs) {
      throw new ExchangeError('This confirmation expired. Hold to speak again.', 410, 'PREVIEW_EXPIRED')
    }

    return preview
  }

  private prune() {
    const now = Date.now()
    for (const [id, at] of this.used) {
      if (now - at > USED_TTL_MS) this.used.delete(id)
    }
    for (const [id, preview] of this.previews) {
      if (now - preview.createdAt > PREVIEW_KEEP_MS) this.previews.delete(id)
    }
  }
}
