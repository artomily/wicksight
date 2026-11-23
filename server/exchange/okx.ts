import { createHmac, randomUUID } from 'node:crypto'
import { assertNonProductionHost } from '../config.ts'
import {
  ExchangeError,
  type ExchangeAdapter,
  type OrderFill,
  type OrderPreview,
  type PositionSnapshot,
  type Side,
} from './types.ts'

/** OKX demo trading is selected with this header — never removed. */
const DEMO_HEADER = { 'x-simulated-trading': '1' } as const

interface OkxInstrument {
  ctVal: number
  tickSz: string
  lotSz: string
}

export class OkxDemoAdapter implements ExchangeAdapter {
  readonly mode = 'okx-demo'
  readonly exchange = 'okx'
  private instruments = new Map<string, { value: OkxInstrument; at: number }>()

  constructor(
    private readonly apiKey: string,
    private readonly apiSecret: string,
    private readonly passphrase: string,
    baseUrl = 'https://www.okx.com',
    demo = true,
  ) {
    // OKX has no separate demo host: the guard is the request header, so the
    // adapter refuses to exist unless demo mode is explicitly on.
    if (!demo) {
      throw new ExchangeError(
        'OKX adapter refuses to run without demo mode. Set OKX_DEMO=1; there is no live OKX path in this build.',
        500,
        'NOT_DEMO',
      )
    }
    assertNonProductionHost(baseUrl, ['www.okx.com', 'okx.com'])
    if (!apiKey || !apiSecret || !passphrase) {
      throw new ExchangeError('OKX_API_KEY / OKX_API_SECRET / OKX_PASSPHRASE are missing in .env', 500, 'NO_KEYS')
    }
    this.baseUrl = baseUrl.replace(/\/$/, '')
  }

  private readonly baseUrl: string

  /** Binance-style BTCUSDT -> OKX BTC-USDT-SWAP. */
  static instrument(symbol: string): string {
    if (symbol.includes('-')) return symbol
    for (const quote of ['USDT', 'USDC', 'USD']) {
      if (symbol.endsWith(quote)) return `${symbol.slice(0, -quote.length)}-${quote}-SWAP`
    }
    return `${symbol}-SWAP`
  }

  private async request<T>(
    method: 'GET' | 'POST',
    path: string,
    body?: Record<string, unknown>,
  ): Promise<T> {
    const timestamp = new Date().toISOString()
    const payload = body ? JSON.stringify(body) : ''
    const prehash = timestamp + method + path + payload
    const signature = createHmac('sha256', this.apiSecret).update(prehash).digest('base64')

    let res: Response
    try {
      res = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          ...DEMO_HEADER,
          'OK-ACCESS-KEY': this.apiKey,
          'OK-ACCESS-SIGN': signature,
          'OK-ACCESS-TIMESTAMP': timestamp,
          'OK-ACCESS-PASSPHRASE': this.passphrase,
          'Content-Type': 'application/json',
        },
        body: body ? payload : undefined,
        signal: AbortSignal.timeout(8000),
      })
    } catch (err) {
      throw new ExchangeError(`OKX unreachable: ${(err as Error).message}`, 504, 'NETWORK')
    }

    const json = (await res.json()) as { code?: string; msg?: string; data?: unknown }
    if (!res.ok || (json.code && json.code !== '0')) {
      throw new ExchangeError(`OKX: ${json.msg || 'request failed'} (${json.code ?? res.status})`, 502, json.code)
    }
    return json.data as T
  }

  private async instrument(instId: string): Promise<OkxInstrument> {
    const cached = this.instruments.get(instId)
    if (cached && Date.now() - cached.at < 10 * 60_000) return cached.value
    const rows = await this.request<Array<{ ctVal: string; tickSz: string; lotSz: string; state: string }>>(
      'GET',
      `/api/v5/public/instruments?instType=SWAP&instId=${encodeURIComponent(instId)}`,
    )
    const row = rows?.[0]
    if (!row) throw new ExchangeError(`OKX instrument ${instId} not found`, 400, 'NO_SYMBOL')
    if (row.state !== 'live') throw new ExchangeError(`OKX instrument ${instId} is not live`, 400, 'NOT_LIVE')
    const value = { ctVal: Number(row.ctVal) || 1, tickSz: row.tickSz, lotSz: row.lotSz }
    this.instruments.set(instId, { value, at: Date.now() })
    return value
  }

  async getPosition(symbol: string): Promise<PositionSnapshot> {
    const instId = OkxDemoAdapter.instrument(symbol)
    const [positions, markRows, inst] = await Promise.all([
      this.request<Array<Record<string, string>>>('GET', `/api/v5/account/positions?instId=${encodeURIComponent(instId)}`),
      this.request<Array<{ markPx: string }>>('GET', `/api/v5/public/mark-price?instId=${encodeURIComponent(instId)}`),
      this.instrument(instId),
    ])

    const row = (positions ?? []).find((p) => Math.abs(Number(p.pos ?? 0)) > 0) ?? positions?.[0]
    const contracts = Math.abs(Number(row?.pos ?? 0))
    const qty = contracts * inst.ctVal
    const entryPrice = Number(row?.avgPx ?? 0)
    const markPrice = Number(row?.markPx ?? markRows?.[0]?.markPx ?? 0)
    const liq = Number(row?.liqPx ?? 0)
    const leverage = Number(row?.lever ?? 1)
    const pnl = Number(row?.upl ?? 0)
    const margin = entryPrice > 0 ? (entryPrice * qty) / leverage : 0
    const rawSide = (row?.posSide ?? 'net').toLowerCase()
    const side: Side | null =
      qty > 0 ? (rawSide === 'short' || (rawSide === 'net' && Number(row?.pos ?? 0) < 0) ? 'SHORT' : 'LONG') : null

    return {
      hasPosition: qty > 0,
      symbol,
      side,
      qty,
      entryPrice,
      markPrice,
      liqPrice: liq > 0 ? liq : null,
      leverage,
      margin,
      unrealizedPnl: pnl,
      roePct: margin > 0 ? (pnl / margin) * 100 : 0,
      distanceToLiqPct: liq > 0 && markPrice > 0 ? (Math.abs(markPrice - liq) / markPrice) * 100 : null,
      priceDecimals: (inst.tickSz.split('.')[1] ?? '').length,
      qtyDecimals: 4,
      mode: this.mode,
      exchange: this.exchange,
      updatedAt: Date.now(),
    }
  }

  async previewCloseHalf(symbol: string): Promise<OrderPreview> {
    const instId = OkxDemoAdapter.instrument(symbol)
    const [position, inst] = await Promise.all([this.getPosition(symbol), this.instrument(instId)])
    if (!position.hasPosition || !position.side) {
      throw new ExchangeError('No open position to close', 409, 'NO_POSITION')
    }
    const contracts = position.qty / inst.ctVal
    const halfContracts = Math.floor((contracts / 2) * 100) / 100
    if (halfContracts <= 0) {
      throw new ExchangeError('Position is too small to halve on OKX demo', 409, 'TOO_SMALL')
    }
    return {
      id: randomUUID(),
      symbol,
      side: position.side,
      qty: halfContracts * inst.ctVal,
      remaining: (contracts - halfContracts) * inst.ctVal,
      qtyDecimals: 4,
      createdAt: Date.now(),
    }
  }

  async executeCloseHalf(symbol: string, qty: number): Promise<OrderFill> {
    const instId = OkxDemoAdapter.instrument(symbol)
    const [position, inst] = await Promise.all([this.getPosition(symbol), this.instrument(instId)])
    if (!position.hasPosition || !position.side) {
      throw new ExchangeError('Position disappeared before the order was sent', 409, 'NO_POSITION')
    }
    const contracts = qty / inst.ctVal
    if (contracts <= 0) throw new ExchangeError('Order size resolves to zero contracts', 409, 'QTY_GUARD')

    const rows = await this.request<Array<{ ordId: string; sCode: string; sMsg: string }>>('POST', '/api/v5/trade/order', {
      instId,
      tdMode: 'isolated',
      side: position.side === 'LONG' ? 'sell' : 'buy',
      posSide: position.side === 'LONG' ? 'long' : 'short',
      ordType: 'market',
      sz: String(Number(contracts.toFixed(2))),
      reduceOnly: 'true',
    })
    const row = rows?.[0]
    if (!row || row.sCode !== '0') {
      throw new ExchangeError(`OKX rejected the order: ${row?.sMsg || 'unknown'} (${row?.sCode || '?'})`, 502, row?.sCode)
    }
    return {
      orderId: row.ordId,
      symbol,
      side: position.side,
      executedQty: qty,
      avgPrice: position.markPrice,
      qtyDecimals: 4,
      at: Date.now(),
    }
  }
}
