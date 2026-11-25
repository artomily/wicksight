export type Side = 'LONG' | 'SHORT'

export interface PositionSnapshot {
  hasPosition: boolean
  symbol: string
  side: Side | null
  qty: number
  entryPrice: number
  markPrice: number
  liqPrice: number | null
  leverage: number
  margin: number
  unrealizedPnl: number
  roePct: number
  distanceToLiqPct: number | null
  priceDecimals: number
  qtyDecimals: number
  mode: string
  exchange: string
  updatedAt: number
}

export interface OrderPreview {
  id: string
  symbol: string
  side: Side
  qty: number
  remaining: number
  qtyDecimals: number
  createdAt: number
}

export interface OrderFill {
  orderId: string
  symbol: string
  side: Side
  executedQty: number
  avgPrice: number
  qtyDecimals: number
  at: number
}

export interface ExchangeAdapter {
  readonly mode: string
  readonly exchange: string
  getPosition(symbol: string): Promise<PositionSnapshot>
  previewCloseHalf(symbol: string): Promise<OrderPreview>
  executeCloseHalf(symbol: string, qty: number): Promise<OrderFill>
  /** Epoch ms until which REST calls must be suppressed (exchange ban/demo limit). */
  getPausedUntil?(): number
}

export class ExchangeError extends Error {
  readonly status: number
  readonly code?: string

  constructor(message: string, status = 502, code?: string) {
    super(message)
    this.name = 'ExchangeError'
    this.status = status
    this.code = code
  }
}

/** Floor `value` to an exchange step expressed as a decimal string (e.g. "0.001"). */
export function floorToStep(value: number, step: string): number {
  const decimals = (step.split('.')[1] ?? '').replace(/0+$/, '').length
  const scale = 10 ** decimals
  const stepInt = Math.round(Number(step) * scale)
  if (!stepInt || !Number.isFinite(value)) return 0
  return (Math.floor(value * scale + 1e-6) / stepInt) * stepInt / scale
}

export function decimalsOf(step: string): number {
  return (step.split('.')[1] ?? '').replace(/0+$/, '').length
}
