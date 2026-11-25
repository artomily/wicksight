import { computeLiqEta, MarkHistory, type LiqEta } from '../../server/eta.ts'
import { applyMark } from '../../server/recompute.ts'
import { buildCloseReceipt, type CloseReceipt } from '../../server/receipt.ts'
import { floorToStep } from '../../server/exchange/types.ts'
import type { OrderFill, OrderPreview, PositionSnapshot, Side } from '../../server/exchange/types.ts'

export type Scenario = 'calm' | 'dump' | 'wick' | 'recovery'
export type Speed = 1 | 5 | 20

export interface SimPositionInput {
  side: Side
  size: number
  leverage: number
  entry: number
}

export interface SimConfig extends SimPositionInput {
  symbol?: string
  maintenanceMarginRate?: number
  seed?: number
}

export interface SimSnapshot {
  markPrice: number
  position: PositionSnapshot
  eta: LiqEta | null
  scenario: Scenario
  speed: Speed
  running: boolean
  samples: number
}

export interface SimFill {
  preview: OrderPreview
  fill: OrderFill
  before: PositionSnapshot
  after: PositionSnapshot
  receipt: CloseReceipt | null
}

const TICK_MS = 1_000
const DEFAULT_MMR = 0.005

/** Binance-style isolated liquidation line for the position's absolute margin. */
export function liquidationPrice(
  side: Side,
  entry: number,
  qty: number,
  margin: number,
  maintenanceMarginRate = DEFAULT_MMR,
): number {
  if (!(entry > 0) || !(qty > 0) || !(margin > 0)) return 0
  const maintenance = qty * entry * maintenanceMarginRate
  const buffer = (margin - maintenance) / qty
  return side === 'LONG' ? entry - buffer : entry + buffer
}

export function initialMargin(entry: number, qty: number, leverage: number): number {
  return entry > 0 && qty > 0 && leverage > 0 ? (entry * qty) / leverage : 0
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296
  }
}

/**
 * Browser-only synthetic market. It never calls the exchange; every number is
 * derived from the seeded walk and the same isolated-margin/ETA/receipt code
 * the real app uses.
 */
export class MarketSimulator {
  readonly symbol: string
  readonly maintenanceMarginRate: number
  private rng: () => number
  private config: SimPositionInput
  private qty: number
  private margin: number
  private entry: number
  private side: Side
  private mark = 0
  private liq = 0
  private history = new MarkHistory()
  private simNow = 0
  private lastTick = 0
  private nextSample = 0
  private scenario: Scenario = 'calm'
  private speed: Speed = 1
  private running = false
  private scenarioStart = 0
  private position: PositionSnapshot | null = null

  constructor(config: SimConfig = { side: 'LONG', size: 0.01, leverage: 20, entry: 61_492.9 }) {
    this.symbol = config.symbol ?? 'BTCUSDT'
    this.maintenanceMarginRate = config.maintenanceMarginRate ?? DEFAULT_MMR
    this.rng = mulberry32(config.seed ?? 0x5eed)
    this.config = { side: config.side, size: config.size, leverage: config.leverage, entry: config.entry }
    this.entry = config.entry
    this.side = config.side
    this.qty = config.size
    this.margin = initialMargin(this.entry, this.qty, config.leverage)
    this.reset()
  }

  get isRunning(): boolean {
    return this.running
  }

  get currentScenario(): Scenario {
    return this.scenario
  }

  get currentSpeed(): Speed {
    return this.speed
  }

  reset(overrides: Partial<SimPositionInput> = {}): void {
    this.config = { ...this.config, ...overrides }
    this.entry = this.config.entry
    this.side = this.config.side
    this.qty = this.config.size
    this.margin = initialMargin(this.entry, this.qty, this.config.leverage)
    this.mark = this.entry
    this.liq = liquidationPrice(this.side, this.entry, this.qty, this.margin, this.maintenanceMarginRate)
    this.simNow = Date.now()
    this.lastTick = this.simNow
    this.nextSample = this.simNow + TICK_MS
    this.history = new MarkHistory()
    this.history.push(this.mark, this.simNow)
    this.scenarioStart = this.simNow
    this.position = this.snapshotAt(this.mark)
    this.running = false
  }

  setScenario(scenario: Scenario): void {
    this.scenario = scenario
    this.scenarioStart = this.simNow
  }

  setSpeed(speed: Speed): void {
    this.speed = speed
  }

  start(): void {
    this.running = true
  }

  pause(): void {
    this.running = false
  }

  toggle(): void {
    this.running = !this.running
  }

  setPosition(input: Partial<SimPositionInput>): void {
    const next = { ...this.config, ...input }
    this.reset(next)
  }

  /** Advance by real elapsed milliseconds, generating one synthetic tick per simulated second. */
  tick(realDtMs: number): void {
    if (!this.running) return
    const simDt = Math.max(0, realDtMs) * this.speed
    this.simNow += simDt
    while (this.simNow >= this.nextSample) {
      const at = this.nextSample
      const dtSec = (at - this.lastTick) / 1_000
      const price = this.nextPrice(at, dtSec)
      this.history.push(price, at)
      this.mark = price
      this.lastTick = at
      this.nextSample += TICK_MS
    }
    if (this.mark <= 0) return
    this.liq = this.position ? (this.position.liqPrice ?? this.liq) : this.liq
    const base = this.baseSnapshot()
    this.position = applyMark(base, this.mark)
    this.liq = this.position.liqPrice ?? 0
  }

  snapshot(): SimSnapshot {
    const position = this.position ?? this.snapshotAt(this.mark)
    const eta = computeLiqEta(this.history.snapshot(this.simNow), position, this.simNow)
    return {
      markPrice: this.mark,
      position,
      eta,
      scenario: this.scenario,
      speed: this.speed,
      running: this.running,
      samples: this.history.size,
    }
  }

  /** Close half at the current mark; the remaining isolated margin keeps the realized PnL. */
  closeHalf(): SimFill {
    const before = this.position ?? this.snapshotAt(this.mark)
    const closed = floorToStep(before.qty / 2, '0.001')
    const fillPrice = this.mark
    const realized = before.side === 'LONG' ? (fillPrice - before.entryPrice) * closed : (before.entryPrice - fillPrice) * closed
    this.qty = Math.max(0, before.qty - closed)
    this.margin = Math.max(0, before.margin + realized)
    this.liq = liquidationPrice(this.side, this.entry, this.qty, this.margin, this.maintenanceMarginRate)
    const after = applyMark(this.baseSnapshot(), this.mark)
    this.position = after
    const fill: OrderFill = {
      orderId: `sim-${Math.round(this.simNow)}`,
      symbol: this.symbol,
      side: this.side,
      executedQty: closed,
      avgPrice: fillPrice,
      qtyDecimals: 3,
      at: this.simNow,
    }
    const preview: OrderPreview = {
      id: `sim-preview-${Math.round(this.simNow)}`,
      symbol: this.symbol,
      side: this.side,
      qty: closed,
      remaining: Math.max(0, before.qty - closed),
      qtyDecimals: 3,
      createdAt: this.simNow,
    }
    const receipt = buildCloseReceipt(before, after, fill)
    return { preview, fill, before, after, receipt }
  }

  previewCloseHalf(): OrderPreview {
    const position = this.position ?? this.snapshotAt(this.mark)
    const half = floorToStep(position.qty / 2, '0.001')
    return {
      id: `sim-preview-${Math.round(this.simNow)}`,
      symbol: this.symbol,
      side: position.side ?? this.side,
      qty: half,
      remaining: Math.max(0, position.qty - half),
      qtyDecimals: 3,
      createdAt: this.simNow,
    }
  }

  private nextPrice(at: number, dtSec: number): number {
    const age = (at - this.scenarioStart) / 1_000
    // Scenarios are expressed as a fraction of the entry price so a 152 USDT
    // SOL book and a 63,000 USDT BTC book move at the same pace.
    const unit = this.entry || this.mark
    let drift = 0
    let vol = unit * 0.000025
    switch (this.scenario) {
      case 'calm':
        drift = 0
        break
      case 'dump':
        drift = -unit * 0.0002
        vol = unit * 0.000032
        break
      case 'recovery':
        drift = unit * 0.0002
        vol = unit * 0.000032
        break
      case 'wick':
        drift = age < 10 ? -unit * 0.001 : age < 20 ? unit * 0.001 : 0
        vol = unit * 0.00006
        break
    }
    const noise = (this.rng() * 2 - 1) * vol
    return Math.max(1, this.mark + drift * dtSec + noise * Math.sqrt(dtSec))
  }

  private baseSnapshot(): PositionSnapshot {
    return {
      hasPosition: this.qty > 0,
      symbol: this.symbol,
      side: this.side,
      qty: this.qty,
      entryPrice: this.entry,
      markPrice: this.mark,
      liqPrice: this.liq || null,
      leverage: this.config.leverage,
      margin: this.margin,
      unrealizedPnl: 0,
      roePct: 0,
      distanceToLiqPct: null,
      priceDecimals: 1,
      qtyDecimals: 3,
      mode: 'simulation',
      exchange: 'simulator',
      updatedAt: this.simNow,
    }
  }

  private snapshotAt(mark: number): PositionSnapshot {
    const liq = liquidationPrice(this.side, this.entry, this.qty, this.margin, this.maintenanceMarginRate)
    this.liq = liq
    return applyMark({ ...this.baseSnapshot(), markPrice: mark, liqPrice: liq || null }, mark)
  }
}
