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
  symbol: string
  price: number
  direction: 'above' | 'below'
  createdAt: number
  triggeredAt: number | null
}

export interface LiqEtaView {
  minutes: number
  speedPerMin: number
  bufferPct: number
  samples: number
  confidence: number
}

export interface PositionEntryView {
  position: PositionView
  eta: LiqEtaView | null
}

export interface StateResponse {
  /** The riskiest open position (same as `positions[0]`). */
  position: PositionView
  alert: AlertView | null
  /** Time-to-liquidation estimate, or null when the tape is flat/noisy/away. */
  eta: LiqEtaView | null
  /** Every open position, riskiest first (shortest ETA, then smallest buffer). */
  positions: PositionEntryView[]
  /** "3 positions · riskiest SOL ~6m" */
  header: string
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

export interface CloseReceiptView {
  symbol: string
  side: Side
  closedQty: number
  avgPrice: number
  leftQty: number
  liqBefore: number | null
  liqAfter: number | null
  bufferBeforePct: number | null
  bufferAfterPct: number | null
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
