import { randomUUID } from 'node:crypto'
import {
  ExchangeError,
  floorToStep,
  type ExchangeAdapter,
  type OrderFill,
  type OrderPreview,
  type PositionSnapshot,
  type Side,
} from './types.ts'

/**
 * Deterministic paper position used for local development and for the
 * simulator walkthrough when no testnet keys are present. Clearly labelled
 * "MOCK" in the HUD — never presented as a real exchange.
 */
export class MockAdapter implements ExchangeAdapter {
  readonly mode = 'mock'
  readonly exchange = 'mock'
  private readonly stepSize = '0.001'
  private readonly priceDecimals = 2
  private readonly qtyDecimals = 3
  private readonly startedAt = Date.now()

  private position = {
    symbol: 'BTCUSDT',
    side: 'LONG' as Side,
    qty: 0.01,
    entryPrice: 63_120,
    leverage: 20,
  }

  private mark(): number {
    const t = (Date.now() - this.startedAt) / 1000
    return 64_180 + 260 * Math.sin(t / 40) + 55 * Math.sin(t / 3.3)
  }

  async getPosition(symbol: string): Promise<PositionSnapshot> {
    const markPrice = this.mark()
    const { qty, entryPrice, leverage, side } = this.position
    const pnl = (markPrice - entryPrice) * qty
    const margin = (entryPrice * qty) / leverage
    const liqPrice = entryPrice * (1 - 1 / leverage + 0.005)

    return {
      hasPosition: qty > 0,
      symbol,
      side: qty > 0 ? side : null,
      qty,
      entryPrice,
      markPrice,
      liqPrice: qty > 0 ? liqPrice : null,
      leverage,
      margin,
      unrealizedPnl: pnl,
      roePct: margin > 0 ? (pnl / margin) * 100 : 0,
      distanceToLiqPct: qty > 0 ? (Math.abs(markPrice - liqPrice) / markPrice) * 100 : null,
      priceDecimals: this.priceDecimals,
      qtyDecimals: this.qtyDecimals,
      mode: this.mode,
      exchange: this.exchange,
      updatedAt: Date.now(),
    }
  }

  async previewCloseHalf(symbol: string): Promise<OrderPreview> {
    const position = await this.getPosition(symbol)
    if (!position.hasPosition || !position.side) {
      throw new ExchangeError('No open position to close', 409, 'NO_POSITION')
    }
    const half = floorToStep(position.qty / 2, this.stepSize)
    if (half <= 0) throw new ExchangeError('Position is too small to halve', 409, 'TOO_SMALL')
    return {
      id: randomUUID(),
      symbol,
      side: position.side,
      qty: half,
      remaining: position.qty - half,
      qtyDecimals: this.qtyDecimals,
      createdAt: Date.now(),
    }
  }

  async executeCloseHalf(symbol: string, qty: number): Promise<OrderFill> {
    const position = await this.getPosition(symbol)
    if (!position.hasPosition || !position.side) {
      throw new ExchangeError('No open position to close', 409, 'NO_POSITION')
    }
    if (qty <= 0 || qty > position.qty + 1e-9) {
      throw new ExchangeError('Refusing to send an order larger than the open position', 409, 'QTY_GUARD')
    }
    this.position.qty = Math.max(0, Number((position.qty - qty).toFixed(this.qtyDecimals)))
    return {
      orderId: `mock-${Date.now()}`,
      symbol,
      side: position.side,
      executedQty: qty,
      avgPrice: position.markPrice,
      qtyDecimals: this.qtyDecimals,
      at: Date.now(),
    }
  }

  /** Dev convenience: put the demo position back exactly where it started. */
  reset() {
    this.position.qty = 0.01
  }
}
