export type Side = 'LONG' | 'SHORT'

export interface PositionView {
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

export interface AlertView {
  price: number
  direction: 'above' | 'below'
  createdAt: number
  triggeredAt: number | null
}

export interface StateResponse {
  position: PositionView
  alert: AlertView | null
  meta: {
    testnetOnly: boolean
    mode: string
    exchange: string
    symbol: string
    serverTime: number
    transport?: 'ws' | 'poll' | 'mock'
    connected?: boolean
    stale?: boolean
    pausedUntil?: number | null
  }
}

export interface OrderPreviewView {
  id: string
  symbol: string
  side: Side
  qty: number
  remaining: number
  qtyDecimals: number
  createdAt: number
}

export interface OrderFillView {
  orderId: string
  symbol: string
  side: Side
  executedQty: number
  avgPrice: number
  qtyDecimals: number
  at: number
}

export type VoiceIntentView =
  | { type: 'alert'; price: number }
  | { type: 'close_half' }
  | { type: 'cancel_alert' }
  | { type: 'none'; reason: string; hint: string }

export interface VoiceResponse {
  text: string
  intent: VoiceIntentView
  provider: string
  latencyMs: number
}
