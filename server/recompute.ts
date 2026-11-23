import type { PositionSnapshot } from './exchange/types.ts'

/**
 * Recompute the derived fields after a mark-price tick, without touching REST.
 * Funding is not included (same as the HUD's previous REST-only view).
 */
export function applyMark(position: PositionSnapshot, markPrice: number): PositionSnapshot {
  const { qty, entryPrice, leverage, side, liqPrice } = position
  const live = qty > 0 && side !== null && Number.isFinite(markPrice)
  const pnl = live ? (side === 'LONG' ? markPrice - entryPrice : entryPrice - markPrice) * qty : 0
  const margin = entryPrice > 0 ? (entryPrice * qty) / (leverage || 1) : 0

  return {
    ...position,
    markPrice,
    unrealizedPnl: pnl,
    roePct: margin > 0 ? (pnl / margin) * 100 : 0,
    distanceToLiqPct:
      liqPrice && markPrice > 0 ? (Math.abs(markPrice - liqPrice) / markPrice) * 100 : null,
    updatedAt: Date.now(),
  }
}

/** "…banned until 1795416955023." -> 1795416955023 */
export function parseBanUntil(message: string): number | null {
  const match = message.match(/banned until (\d{13})/i)
  return match ? Number(match[1]) : null
}

/** Retry-After is either delta-seconds or an HTTP date. */
export function parseRetryAfter(value: string | null, now = Date.now()): number | null {
  if (!value) return null
  const seconds = Number(value)
  if (Number.isFinite(seconds) && seconds >= 0) return now + seconds * 1000
  const date = Date.parse(value)
  return Number.isNaN(date) ? null : date
}

export function formatClock(ts: number): string {
  return new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}
