import { createHmac, randomUUID } from 'node:crypto'
import { assertNonProductionHost } from '../config.ts'
import { formatClock, parseBanUntil, parseRetryAfter } from '../recompute.ts'
import {
  decimalsOf,
  ExchangeError,
  floorToStep,
  type ExchangeAdapter,
  type OrderFill,
  type OrderPreview,
  type PositionSnapshot,
  type Side,
} from './types.ts'

const BASE = 'https://testnet.binancefuture.com'
const WS_BASE = 'wss://stream.binancefuture.com'
const TESTNET_HOSTS = ['testnet.binancefuture.com']
const TESTNET_WS_HOSTS = ['stream.binancefuture.com']

interface SymbolRules {
  stepSize: string
  tickSize: string
  minQty: number
  priceDecimals: number
  qtyDecimals: number
}

interface PositionRiskRow {
  symbol: string
  positionAmt: string
  entryPrice: string
  markPrice: string
  unRealizedProfit: string
  liquidationPrice: string
  leverage: string
  positionSide?: string
}

export class BinanceTestnetAdapter implements ExchangeAdapter {
  readonly mode = 'binance-testnet'
  readonly exchange = 'binance'
  readonly wsBaseUrl: string
  private pauseUntil = 0

  constructor(
    private readonly apiKey: string,
    private readonly apiSecret: string,
    baseUrl: string = BASE,
    wsBaseUrl: string = WS_BASE,
  ) {
    assertNonProductionHost(baseUrl, TESTNET_HOSTS)
    assertNonProductionHost(wsBaseUrl, TESTNET_WS_HOSTS)
    if (!apiKey || !apiSecret) {
      throw new ExchangeError('BINANCE_API_KEY / BINANCE_API_SECRET are missing in .env', 500, 'NO_KEYS')
    }
    this.baseUrl = baseUrl.replace(/\/$/, '')
    this.wsBaseUrl = wsBaseUrl.replace(/\/$/, '')
  }

  private readonly baseUrl: string

  /** Epoch ms until which no REST call may be made. */
  getPausedUntil(): number {
    return this.pauseUntil
  }

  markPriceStreamUrl(symbol: string): string {
    return `${this.wsBaseUrl}/ws/${symbol.toLowerCase()}@markPrice@1s`
  }

  /** Every symbol's mark price in one frame per second; no request weight. */
  allMarkPricesStreamUrl(): string {
    return `${this.wsBaseUrl}/ws/!markPrice@arr@1s`
  }

  userStreamUrl(listenKey: string): string {
    return `${this.wsBaseUrl}/ws/${listenKey}`
  }

  private sign(query: string): string {
    return createHmac('sha256', this.apiSecret).update(query).digest('hex')
  }

  private async signed<T>(method: 'GET' | 'POST' | 'PUT', path: string, params: Record<string, string> = {}): Promise<T> {
    const query = new URLSearchParams({
      ...params,
      recvWindow: '5000',
      timestamp: String(Date.now()),
    }).toString()
    const url = `${this.baseUrl}${path}?${query}&signature=${this.sign(query)}`
    return this.parse<T>(await this.call(url, method))
  }

  private async public<T>(path: string, params: Record<string, string> = {}): Promise<T> {
    const query = new URLSearchParams(params).toString()
    const url = `${this.baseUrl}${path}${query ? `?${query}` : ''}`
    return this.parse<T>(await this.call(url, 'GET'))
  }

  private async call(url: string, method: 'GET' | 'POST' | 'PUT'): Promise<Response> {
    if (this.pauseUntil > Date.now()) {
      throw new ExchangeError(
        `Binance paused this IP until ${formatClock(this.pauseUntil)}. No requests will be sent until then.`,
        503,
        'PAUSED',
      )
    }
    try {
      return await fetch(url, {
        method,
        headers: { 'X-MBX-APIKEY': this.apiKey },
        signal: AbortSignal.timeout(8000),
      })
    } catch (err) {
      throw new ExchangeError(`Binance testnet unreachable: ${(err as Error).message}`, 504, 'NETWORK')
    }
  }

  private async parse<T>(res: Response): Promise<T> {
    const text = await res.text()
    let body: unknown
    try {
      body = JSON.parse(text)
    } catch {
      throw new ExchangeError(`Binance returned a non-JSON response (${res.status})`, 502, 'BAD_RESPONSE')
    }
    if (!res.ok) {
      const { code, msg } = body as { code?: number; msg?: string }

      // -1003 / 429 / 418: stop all REST calls until the ban expires.
      if (code === -1003 || res.status === 429 || res.status === 418) {
        const until =
          parseBanUntil(msg ?? '') ??
          parseRetryAfter(res.headers.get('retry-after')) ??
          Date.now() + 60_000
        this.pauseUntil = Math.max(this.pauseUntil, until + 1_000)
        throw new ExchangeError(
          `Binance paused this IP until ${formatClock(this.pauseUntil)}. No requests will be sent until then.`,
          503,
          'PAUSED',
        )
      }

      throw new ExchangeError(friendlyBinanceError(code, msg), res.status, String(code ?? 'ERROR'))
    }
    return body as T
  }

  private allRules: { value: Map<string, SymbolRules>; at: number } | null = null

  /** One cached exchangeInfo call covers every symbol (weight 1, ten-minute cache). */
  private async symbolRules(symbol: string): Promise<SymbolRules> {
    if (!this.allRules || Date.now() - this.allRules.at > 10 * 60_000) {
      const info = await this.public<{
        symbols: Array<{
          symbol: string
          filters: Array<Record<string, string>>
          pricePrecision: number
          quantityPrecision: number
        }>
      }>('/fapi/v1/exchangeInfo')

      const value = new Map<string, SymbolRules>()
      for (const row of info.symbols) {
        const lot = row.filters.find((f) => f.filterType === 'LOT_SIZE')
        const price = row.filters.find((f) => f.filterType === 'PRICE_FILTER')
        value.set(row.symbol, {
          stepSize: lot?.stepSize ?? '0.001',
          tickSize: price?.tickSize ?? '0.10',
          minQty: Number(lot?.minQty ?? '0'),
          priceDecimals: Math.min(decimalsOf(price?.tickSize ?? '0.01'), 6),
          qtyDecimals: Math.min(decimalsOf(lot?.stepSize ?? '0.001'), 8),
        })
      }
      this.allRules = { value, at: Date.now() }
    }
    const rules = this.allRules.value.get(symbol)
    if (!rules) throw new ExchangeError(`Symbol ${symbol} is not listed on Binance Futures testnet`, 400, 'NO_SYMBOL')
    return rules
  }

  async getPosition(symbol: string): Promise<PositionSnapshot> {
    // One signed call + cached symbol rules. Mark price comes along in
    // positionRisk; the WebSocket takes over from there.
    const [rows, rules] = await Promise.all([
      this.signed<PositionRiskRow[]>('GET', '/fapi/v2/positionRisk', { symbol }),
      this.symbolRules(symbol),
    ])
    return this.toSnapshot(symbol, rows, rules)
  }

  /**
   * All open positions in one signed call (positionRisk without a symbol,
   * weight 5). Returns the flat snapshot for `fallbackSymbol` when the
   * account has nothing open, so the HUD still has something to draw.
   */
  async getPositions(fallbackSymbol: string): Promise<PositionSnapshot[]> {
    const rows = await this.signed<PositionRiskRow[]>('GET', '/fapi/v2/positionRisk')
    const bySymbol = new Map<string, PositionRiskRow[]>()
    for (const row of rows) {
      if (Math.abs(Number(row.positionAmt)) <= 0) continue
      const list = bySymbol.get(row.symbol) ?? []
      list.push(row)
      bySymbol.set(row.symbol, list)
    }
    if (bySymbol.size === 0) {
      const rules = await this.symbolRules(fallbackSymbol)
      return [this.toSnapshot(fallbackSymbol, [], rules)]
    }
    const out: PositionSnapshot[] = []
    for (const [symbol, list] of bySymbol) {
      out.push(this.toSnapshot(symbol, list, await this.symbolRules(symbol)))
    }
    return out
  }

  private toSnapshot(symbol: string, rows: PositionRiskRow[], rules: SymbolRules): PositionSnapshot {
    // Hedge mode returns one row per side; pick the side that actually holds size.
    const row = [...rows].sort(
      (a, b) => Math.abs(Number(b.positionAmt)) - Math.abs(Number(a.positionAmt)),
    )[0]
    const signedAmt = Number(row?.positionAmt ?? 0)
    const qty = Math.abs(signedAmt)
    const markPrice = Number(row?.markPrice) || 0
    const entryPrice = Number(row?.entryPrice) || 0
    const leverage = Number(row?.leverage) || 1
    const liq = Number(row?.liquidationPrice) || 0
    const pnl = Number(row?.unRealizedProfit) || 0
    const margin = entryPrice > 0 ? (entryPrice * qty) / leverage : 0

    const side: Side | null = qty > 0 ? (signedAmt > 0 ? 'LONG' : 'SHORT') : null

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
      priceDecimals: rules.priceDecimals,
      qtyDecimals: rules.qtyDecimals,
      mode: this.mode,
      exchange: this.exchange,
      updatedAt: Date.now(),
    }
  }

  /** User data stream key. No signature; the API key header is enough. */
  async createListenKey(): Promise<string> {
    const res = await this.call(`${this.baseUrl}/fapi/v1/listenKey`, 'POST')
    const data = await this.parse<{ listenKey?: string }>(res)
    if (!data.listenKey) throw new ExchangeError('Binance did not return a listenKey', 502, 'NO_LISTEN_KEY')
    return data.listenKey
  }

  async keepAliveListenKey(): Promise<void> {
    const res = await this.call(`${this.baseUrl}/fapi/v1/listenKey`, 'PUT')
    await this.parse<Record<string, unknown>>(res)
  }

  async previewCloseHalf(symbol: string): Promise<OrderPreview> {
    const [position, rules] = await Promise.all([this.getPosition(symbol), this.symbolRules(symbol)])
    if (!position.hasPosition || !position.side) {
      throw new ExchangeError('No open position to close', 409, 'NO_POSITION')
    }
    const half = floorToStep(position.qty / 2, rules.stepSize)
    if (half <= 0) {
      throw new ExchangeError(
        `Position ${position.qty} is below the ${rules.stepSize} step; a half close would be zero.`,
        409,
        'TOO_SMALL',
      )
    }
    return {
      id: randomUUID(),
      symbol,
      side: position.side,
      qty: half,
      remaining: position.qty - half,
      qtyDecimals: rules.qtyDecimals,
      createdAt: Date.now(),
    }
  }

  async executeCloseHalf(symbol: string, qty: number): Promise<OrderFill> {
    const [position, rules] = await Promise.all([this.getPosition(symbol), this.symbolRules(symbol)])
    if (!position.hasPosition || !position.side) {
      throw new ExchangeError('Position disappeared before the order was sent', 409, 'NO_POSITION')
    }
    if (qty <= 0 || qty > position.qty + 1e-9) {
      throw new ExchangeError('Refusing to send an order larger than the open position', 409, 'QTY_GUARD')
    }

    const orderSide = position.side === 'LONG' ? 'SELL' : 'BUY'
    const order = await this.signed<{
      orderId: number
      status: string
      executedQty: string
      avgPrice: string
    }>('POST', '/fapi/v1/order', {
      symbol,
      side: orderSide,
      type: 'MARKET',
      quantity: qty.toFixed(rules.qtyDecimals),
      reduceOnly: 'true',
      newOrderRespType: 'RESULT',
    })

    return {
      orderId: String(order.orderId),
      symbol,
      side: position.side,
      executedQty: Number(order.executedQty) || qty,
      avgPrice: Number(order.avgPrice) || position.markPrice,
      qtyDecimals: rules.qtyDecimals,
      at: Date.now(),
    }
  }
}

function friendlyBinanceError(code?: number, msg?: string): string {
  switch (code) {
    case -2015:
      return 'Binance rejected the API key (permissions or IP restriction).'
    case -2014:
      return 'Binance rejected the signature. Check BINANCE_API_SECRET.'
    case -1022:
      return 'Bad signature. Check the system clock and the API secret.'
    case -2019:
      return 'Not enough testnet margin for this order.'
    case -4164:
      return 'Order notional is below the exchange minimum.'
    case -4131:
      return 'Order would immediately violate the reduce-only constraint.'
    case -1102:
      return 'A required order parameter is missing.'
    default:
      return msg ? `Binance: ${msg}${code ? ` (${code})` : ''}` : 'Binance request failed.'
  }
}
