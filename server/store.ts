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

/**
 * A preview is the confirmation token: it carries the exact quantity the user
 * approved, can be consumed once, and expires quickly. A double tap cannot
 * send the same order twice.
 */
export class PreviewStore {
  private previews = new Map<string, StoredPreview>()

  create(preview: StoredPreview): StoredPreview {
    this.prune()
    this.previews.set(preview.id, preview)
    return preview
  }

  take(id: string): StoredPreview {
    this.prune()
    const preview = this.previews.get(id)
    if (!preview) throw new Error('This confirmation expired. Hold to speak again.')
    this.previews.delete(id)
    return preview
  }

  private prune() {
    const cutoff = Date.now() - PREVIEW_TTL_MS
    for (const [id, preview] of this.previews) {
      if (preview.createdAt < cutoff) this.previews.delete(id)
    }
  }
}
