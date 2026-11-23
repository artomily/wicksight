import { createHmac, randomUUID } from 'node:crypto'
import { assertNonProductionHost } from '../config.ts'
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
const TESTNET_HINTS = ['testnet.binancefuture.com']

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
  private rules = new Map<string, { value: SymbolRules; at: number }>()

  constructor(
    private readonly apiKey: string,
    private readonly apiSecret: string,
    baseUrl: string = BASE,
  ) {
    assertNonProductionHost(baseUrl, TESTNET_HINTS)
    if (!apiKey || !apiSecret) {
      throw new ExchangeError('BINANCE_API_KEY / BINANCE_API_SECRET are missing in .env', 500, 'NO_KEYS')
    }
    this.baseUrl = baseUrl.replace(/\/$/, '')
  }

  private readonly baseUrl: string

  private sign(query: string): string {
    return createHmac('sha256', this.apiSecret).update(query).digest('hex')
  }

  private async signed<T>(method: 'GET' | 'POST', path: string, params: Record<string, string> = {}): Promise<T> {
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

  private async call(url: string, method: 'GET' | 'POST'): Promise<Response> {
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
      throw new ExchangeError(friendlyBinanceError(code, msg), res.status, String(code ?? 'ERROR'))
    }
    return body as T
  }

  private async symbolRules(symbol: string): Promise<SymbolRules> {
    const cached = this.rules.get(symbol)
    if (cached && Date.now() - cached.at < 10 * 60_000) return cached.value

    const info = await this.public<{
      symbols: Array<{
        symbol: string
        filters: Array<Record<string, string>>
        pricePrecision: number
        quantityPrecision: number
      }>
    }>('/fapi/v1/exchangeInfo')

    const row = info.symbols.find((s) => s.symbol === symbol)
    if (!row) throw new ExchangeError(`Symbol ${symbol} is not listed on Binance Futures testnet`, 400, 'NO_SYMBOL')

    const lot = row.filters.find((f) => f.filterType === 'LOT_SIZE')
    const price = row.filters.find((f) => f.filterType === 'PRICE_FILTER')
    const value: SymbolRules = {
      stepSize: lot?.stepSize ?? '0.001',
      tickSize: price?.tickSize ?? '0.10',
      minQty: Number(lot?.minQty ?? '0'),
      priceDecimals: Math.min(decimalsOf(price?.tickSize ?? '0.01'), 6),
      qtyDecimals: Math.min(decimalsOf(lot?.stepSize ?? '0.001'), 8),
    }
    this.rules.set(symbol, { value, at: Date.now() })
    return value
  }

  async getPosition(symbol: string): Promise<PositionSnapshot> {
    const [rows, premium, rules] = await Promise.all([
      this.signed<PositionRiskRow[]>('GET', '/fapi/v2/positionRisk', { symbol }),
      this.public<{ markPrice: string }>('/fapi/v1/premiumIndex', { symbol }),
      this.symbolRules(symbol),
    ])

    // Hedge mode returns one row per side; pick the side that actually holds size.
    const row = [...rows].sort(
      (a, b) => Math.abs(Number(b.positionAmt)) - Math.abs(Number(a.positionAmt)),
    )[0]
    const signedAmt = Number(row?.positionAmt ?? 0)
    const qty = Math.abs(signedAmt)
    const markPrice = Number(row?.markPrice) || Number(premium.markPrice) || 0
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
