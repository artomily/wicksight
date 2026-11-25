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

interface MockBook {
  symbol: string
  side: Side
  startQty: number
  qty: number
  entryPrice: number
  leverage: number
  stepSize: string
  priceDecimals: number
  qtyDecimals: number
  /** Mark price as a function of seconds since the adapter started. */
  mark: (t: number) => number
}

/**
 * SOL walks down a slow saw-tooth toward its liquidation line and bounces
 * before touching it: 0.6 USDT/min for nine minutes, then a one-minute
 * recovery. That makes it the riskiest position with a live ETA (roughly
 * 12m → 3m) on a loop, so the multi-position HUD and the Telegram watcher
 * have something real to react to in mock mode.
 */
function solSaw(t: number): number {
  const cycle = 600
  const phase = t % cycle
  const top = 153.6
  const fall = 0.6 / 60 // USDT per second
  const wobble = 0.03 * Math.sin(t / 2.1)
  if (phase < 540) return top - fall * phase + wobble
  const bottom = top - fall * 540
  return bottom + ((top - bottom) * (phase - 540)) / 60 + wobble
}

function defaultBooks(): MockBook[] {
  return [
    {
      symbol: 'BTCUSDT',
      side: 'LONG',
      startQty: 0.01,
      qty: 0.01,
      entryPrice: 63_120,
      leverage: 20,
      stepSize: '0.001',
      priceDecimals: 2,
      qtyDecimals: 3,
      mark: (t) => 64_180 + 260 * Math.sin(t / 40) + 55 * Math.sin(t / 3.3),
    },
    {
      symbol: 'ETHUSDT',
      side: 'LONG',
      startQty: 0.2,
      qty: 0.2,
      entryPrice: 3_150,
      leverage: 10,
      stepSize: '0.001',
      priceDecimals: 2,
      qtyDecimals: 3,
      mark: (t) => 3_205 + 18 * Math.sin(t / 55) + 3 * Math.sin(t / 4.1),
    },
    {
      symbol: 'SOLUSDT',
      side: 'LONG',
      startQty: 4,
      qty: 4,
      entryPrice: 152,
      leverage: 25,
      stepSize: '0.01',
      priceDecimals: 3,
      qtyDecimals: 2,
      mark: solSaw,
    },
  ]
}

/**
 * Deterministic paper account used for local development and for the
 * simulator walkthrough when no testnet keys are present. Clearly labelled
 * "MOCK" in the HUD — never presented as a real exchange. Holds three open
 * positions so the multi-position flow can be shown without keys.
 */
export class MockAdapter implements ExchangeAdapter {
  readonly mode = 'mock'
  readonly exchange = 'mock'
  private readonly startedAt = Date.now()
  private books: MockBook[]

  constructor(options: { symbols?: string[] } = {}) {
    const all = defaultBooks()
    this.books = options.symbols ? all.filter((book) => options.symbols!.includes(book.symbol)) : all
  }

  private seconds(): number {
    return (Date.now() - this.startedAt) / 1000
  }

  private snapshot(book: MockBook): PositionSnapshot {
    const markPrice = book.mark(this.seconds())
    const { qty, entryPrice, leverage, side } = book
    const pnl = (side === 'LONG' ? markPrice - entryPrice : entryPrice - markPrice) * qty
    const margin = (entryPrice * qty) / leverage
    const liqPrice =
      side === 'LONG' ? entryPrice * (1 - 1 / leverage + 0.005) : entryPrice * (1 + 1 / leverage - 0.005)
    const open = qty > 0
    return {
      hasPosition: open,
      symbol: book.symbol,
      side: open ? side : null,
      qty,
      entryPrice,
      markPrice,
      liqPrice: open ? liqPrice : null,
      leverage,
      margin,
      unrealizedPnl: pnl,
      roePct: margin > 0 ? (pnl / margin) * 100 : 0,
      distanceToLiqPct: open ? (Math.abs(markPrice - liqPrice) / markPrice) * 100 : null,
      priceDecimals: book.priceDecimals,
      qtyDecimals: book.qtyDecimals,
      mode: this.mode,
      exchange: this.exchange,
      updatedAt: Date.now(),
    }
  }

  private flat(symbol: string): PositionSnapshot {
    return {
      hasPosition: false,
      symbol,
      side: null,
      qty: 0,
      entryPrice: 0,
      markPrice: 0,
      liqPrice: null,
      leverage: 1,
      margin: 0,
      unrealizedPnl: 0,
      roePct: 0,
      distanceToLiqPct: null,
      priceDecimals: 2,
      qtyDecimals: 3,
      mode: this.mode,
      exchange: this.exchange,
      updatedAt: Date.now(),
    }
  }

  private book(symbol: string): MockBook | undefined {
    return this.books.find((book) => book.symbol === symbol)
  }

  async getPosition(symbol: string): Promise<PositionSnapshot> {
    const book = this.book(symbol)
    return book ? this.snapshot(book) : this.flat(symbol)
  }

  async getPositions(fallbackSymbol: string): Promise<PositionSnapshot[]> {
    const open = this.books.filter((book) => book.qty > 0).map((book) => this.snapshot(book))
    return open.length > 0 ? open : [await this.getPosition(fallbackSymbol)]
  }

  async previewCloseHalf(symbol: string): Promise<OrderPreview> {
    const book = this.book(symbol)
    const position = await this.getPosition(symbol)
    if (!book || !position.hasPosition || !position.side) {
      throw new ExchangeError('No open position to close', 409, 'NO_POSITION')
    }
    const half = floorToStep(position.qty / 2, book.stepSize)
    if (half <= 0) throw new ExchangeError('Position is too small to halve', 409, 'TOO_SMALL')
    return {
      id: randomUUID(),
      symbol,
      side: position.side,
      qty: half,
      remaining: Number((position.qty - half).toFixed(book.qtyDecimals)),
      qtyDecimals: book.qtyDecimals,
      createdAt: Date.now(),
    }
  }

  async executeCloseHalf(symbol: string, qty: number): Promise<OrderFill> {
    const book = this.book(symbol)
    const position = await this.getPosition(symbol)
    if (!book || !position.hasPosition || !position.side) {
      throw new ExchangeError('No open position to close', 409, 'NO_POSITION')
    }
    if (qty <= 0 || qty > position.qty + 1e-9) {
      throw new ExchangeError('Refusing to send an order larger than the open position', 409, 'QTY_GUARD')
    }
    book.qty = Math.max(0, Number((position.qty - qty).toFixed(book.qtyDecimals)))
    return {
      orderId: `mock-${Date.now()}`,
      symbol,
      side: position.side,
      executedQty: qty,
      avgPrice: position.markPrice,
      qtyDecimals: book.qtyDecimals,
      at: Date.now(),
    }
  }

  /** Dev convenience: put every demo position back exactly where it started. */
  reset() {
    for (const book of this.books) book.qty = book.startQty
  }
}
