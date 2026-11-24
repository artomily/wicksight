import type { PositionSnapshot } from './exchange/types.ts'

export interface MarkSample {
  at: number
  price: number
}

export interface LiqEta {
  /** Minutes to the liquidation price at the current pace. */
  minutes: number
  /** USDT per minute moving toward the liquidation price. */
  speedPerMin: number
  /** Current distance to liquidation, in percent of mark price. */
  bufferPct: number
  /** Number of mark ticks used by the fit. */
  samples: number
  /** Coefficient of determination (R²) of the linear fit, 0..1. */
  confidence: number
}

/** Keep five minutes so a three-minute fit always has a full window. */
const MAX_SAMPLE_AGE_MS = 5 * 60_000
/** Fit the pace over the last three minutes of 1 s mark ticks. */
const WINDOW_MS = 3 * 60_000
/** Below this many ticks the fit is not worth showing. */
const MIN_SAMPLES = 30
/** And it must cover at least 45 seconds. */
const MIN_SPAN_MS = 45_000
/** Ignore a pace that is basically flat. */
const MIN_TOWARD_PER_MIN = 0.5
/** A position more than four hours away is not a glanceable emergency. */
const MAX_ETA_MIN = 240
/** A low R² means the tape is too noisy to call a pace. */
const MIN_R2 = 0.2

/** Bounded in-memory ring of mark-price ticks, newest last. */
export class MarkHistory {
  private samples: MarkSample[] = []

  push(price: number, at = Date.now()): void {
    if (!Number.isFinite(price) || price <= 0) return
    this.samples.push({ at, price })
    const cutoff = at - MAX_SAMPLE_AGE_MS
    let drop = 0
    while (drop < this.samples.length && this.samples[drop].at < cutoff) drop++
    if (drop > 0) this.samples.splice(0, drop)
  }

  snapshot(now = Date.now()): MarkSample[] {
    const cutoff = now - MAX_SAMPLE_AGE_MS
    return this.samples.filter((sample) => sample.at >= cutoff && sample.at <= now)
  }

  clear(): void {
    this.samples = []
  }

  get size(): number {
    return this.samples.length
  }
}

/**
 * Estimate time-to-liquidation from a short mark-price history.
 *
 * Returns null when there is nothing honest to show: flat or moving away,
 * too few ticks, too short a window, a noisy fit, or an ETA beyond four hours.
 * The regression is a simple least-squares fit of price (USDT) against time
 * (minutes); R² is used as the noise gate.
 */
export function computeLiqEta(
  samples: MarkSample[],
  position: PositionSnapshot,
  now = Date.now(),
): LiqEta | null {
  if (!position.hasPosition || !position.side) return null
  if (!position.liqPrice || position.liqPrice <= 0) return null
  if (!Number.isFinite(position.markPrice) || position.markPrice <= 0) return null
  // If price is already past the line the position is not a going concern;
  // do not show a countdown for a liquidation that should already have fired.
  if (position.side === 'LONG' && position.markPrice <= position.liqPrice) return null
  if (position.side === 'SHORT' && position.markPrice >= position.liqPrice) return null

  const window = samples
    .filter(
      (sample) =>
        sample.at >= now - WINDOW_MS &&
        sample.at <= now &&
        Number.isFinite(sample.price) &&
        sample.price > 0,
    )
    .sort((a, b) => a.at - b.at)
  if (window.length < MIN_SAMPLES) return null
  if (window[window.length - 1].at - window[0].at < MIN_SPAN_MS) return null

  const t0 = window[0].at
  const xs = window.map((sample) => (sample.at - t0) / 60_000)
  const ys = window.map((sample) => sample.price)
  const n = xs.length
  const meanX = xs.reduce((sum, x) => sum + x, 0) / n
  const meanY = ys.reduce((sum, y) => sum + y, 0) / n

  let sxx = 0
  let sxy = 0
  let syy = 0
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX
    const dy = ys[i] - meanY
    sxx += dx * dx
    sxy += dx * dy
    syy += dy * dy
  }
  if (sxx <= 0 || syy <= 0) return null

  const slope = sxy / sxx
  const r2 = (sxy * sxy) / (sxx * syy)
  const toward = position.side === 'LONG' ? -slope : slope
  if (toward <= MIN_TOWARD_PER_MIN) return null
  if (r2 < MIN_R2) return null

  const distance = Math.abs(position.markPrice - position.liqPrice)
  if (distance <= 0) return null
  const minutes = distance / toward
  if (minutes > MAX_ETA_MIN) return null

  return {
    minutes: Math.max(0.5, minutes),
    speedPerMin: toward,
    bufferPct: (distance / position.markPrice) * 100,
    samples: n,
    confidence: r2,
  }
}
