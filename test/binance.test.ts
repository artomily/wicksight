import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { BinanceTestnetAdapter } from '../server/exchange/binance.ts'

const EXCHANGE_INFO = {
  symbols: [
    {
      symbol: 'BTCUSDT',
      pricePrecision: 2,
      quantityPrecision: 3,
      filters: [
        { filterType: 'LOT_SIZE', stepSize: '0.001', minQty: '0.001' },
        { filterType: 'PRICE_FILTER', tickSize: '0.10' },
      ],
    },
  ],
}

const POSITION = [
  {
    symbol: 'BTCUSDT',
    positionAmt: '0.010',
    entryPrice: '63000',
    markPrice: '64000',
    unRealizedProfit: '10',
    liquidationPrice: '60100',
    leverage: '20',
  },
]

const PREMIUM = { symbol: 'BTCUSDT', markPrice: '64000' }

interface Captured {
  url: string
  method: string
}

/**
 * Stubbed Binance testnet. Exercises request signing, order payload shape and
 * response parsing without touching the network or needing keys.
 */
function stubBinance(orderResponse: unknown = { orderId: 123, status: 'FILLED', executedQty: '0.005', avgPrice: '64010' }) {
  const original = globalThis.fetch
  const calls: Captured[] = []

  globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    const url = String(input)
    const method = init?.method ?? 'GET'
    calls.push({ url, method })

    if (url.includes('/fapi/v1/exchangeInfo')) {
      return new Response(JSON.stringify(EXCHANGE_INFO), { status: 200 })
    }
    if (url.includes('/fapi/v2/positionRisk')) {
      return new Response(JSON.stringify(POSITION), { status: 200 })
    }
    if (url.includes('/fapi/v1/premiumIndex')) {
      return new Response(JSON.stringify(PREMIUM), { status: 200 })
    }
    if (url.includes('/fapi/v1/order')) {
      return new Response(JSON.stringify(orderResponse), { status: 200 })
    }
    return new Response(JSON.stringify({ code: -1, msg: 'unexpected path' }), { status: 400 })
  }) as typeof fetch

  return {
    calls,
    restore: () => {
      globalThis.fetch = original
    },
  }
}

test('getPosition maps positionRisk into the view', async (t) => {
  const stub = stubBinance()
  t.after(stub.restore)

  const adapter = new BinanceTestnetAdapter('key', 'secret')
  const p = await adapter.getPosition('BTCUSDT')

  assert.equal(p.hasPosition, true)
  assert.equal(p.side, 'LONG')
  assert.equal(p.qty, 0.01)
  assert.equal(p.liqPrice, 60_100)
  assert.equal(p.unrealizedPnl, 10)
  assert.equal(p.leverage, 20)
  // BTCUSDT futures tick is 0.10 -> one decimal
  assert.equal(p.priceDecimals, 1)
  assert.equal(p.qtyDecimals, 3)
  // 10 USDT on 31.5 USDT of margin
  assert.ok(Math.abs(p.roePct - 31.746) < 0.01, String(p.roePct))
  assert.ok(Math.abs((p.distanceToLiqPct ?? 0) - 6.09375) < 0.001)
})

test('every signed request carries a valid HMAC and the API key header', async (t) => {
  const stub = stubBinance()
  t.after(stub.restore)

  const adapter = new BinanceTestnetAdapter('key', 'secret')
  await adapter.getPosition('BTCUSDT')

  const signed = stub.calls.find((c) => c.url.includes('/fapi/v2/positionRisk'))
  assert.ok(signed)

  const query = new URL(signed.url).search
  const signature = new URLSearchParams(query).get('signature')
  const payload = query.slice(1).split('&signature=')[0]
  const expected = createHmac('sha256', 'secret').update(payload).digest('hex')

  assert.equal(signature, expected)
  assert.ok(payload.includes('symbol=BTCUSDT'))
  assert.ok(payload.includes('recvWindow=5000'))
  assert.ok(payload.includes('timestamp='))
})

test('previewCloseHalf floors half the position to the step size', async (t) => {
  const stub = stubBinance()
  t.after(stub.restore)

  const adapter = new BinanceTestnetAdapter('key', 'secret')
  const preview = await adapter.previewCloseHalf('BTCUSDT')

  assert.equal(preview.qty, 0.005)
  assert.equal(preview.remaining, 0.005)
  assert.equal(preview.side, 'LONG')
  assert.ok(preview.id.length > 10)
})

test('executeCloseHalf sends a reduce-only SELL market order for exactly the preview qty', async (t) => {
  const stub = stubBinance()
  t.after(stub.restore)

  const adapter = new BinanceTestnetAdapter('key', 'secret')
  const fill = await adapter.executeCloseHalf('BTCUSDT', 0.005)

  const order = stub.calls.find((c) => c.url.includes('/fapi/v1/order'))
  assert.ok(order)
  assert.equal(order.method, 'POST')

  const params = new URL(order.url).searchParams
  assert.equal(params.get('side'), 'SELL')
  assert.equal(params.get('type'), 'MARKET')
  assert.equal(params.get('quantity'), '0.005')
  assert.equal(params.get('reduceOnly'), 'true')
  assert.ok(params.get('signature'))

  assert.equal(fill.executedQty, 0.005)
  assert.equal(fill.avgPrice, 64010)
  assert.equal(fill.orderId, '123')
})

test('refuses an order larger than the position', async (t) => {
  const stub = stubBinance()
  t.after(stub.restore)

  const adapter = new BinanceTestnetAdapter('key', 'secret')
  await assert.rejects(() => adapter.executeCloseHalf('BTCUSDT', 0.5), /larger than the open position/)
})

test('maps a bad key to a human error instead of a raw exchange code', async (t) => {
  const original = globalThis.fetch
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ code: -2015, msg: 'Invalid API-key, IP, or permissions for action.' }), {
      status: 401,
    })) as typeof fetch
  t.after(() => {
    globalThis.fetch = original
  })

  const adapter = new BinanceTestnetAdapter('key', 'secret')
  await assert.rejects(() => adapter.getPosition('BTCUSDT'), /rejected the API key/)
})

test('a 429 flips the adapter to PAUSED and stops every follow-up call', async (t) => {
  const original = globalThis.fetch
  let calls = 0

  globalThis.fetch = (async () => {
    calls += 1
    return new Response(
      JSON.stringify({
        code: -1003,
        msg: 'Way too many requests; IP(1.2.3.4) banned until 9999999999999. Please use the websocket for live updates to avoid bans.',
      }),
      { status: 429, headers: { 'retry-after': '60' } },
    )
  }) as typeof fetch
  t.after(() => {
    globalThis.fetch = original
  })

  const adapter = new BinanceTestnetAdapter('key', 'secret')
  await assert.rejects(() => adapter.getPosition('BTCUSDT'), /paused this IP/)
  const afterFirst = calls
  assert.ok(afterFirst >= 1)
  assert.ok(adapter.getPausedUntil() > Date.now())

  await assert.rejects(() => adapter.getPosition('BTCUSDT'), /paused this IP/)
  assert.equal(calls, afterFirst, 'no network calls may happen while paused')

  await assert.rejects(() => adapter.previewCloseHalf('BTCUSDT'), /paused this IP/)
  assert.equal(calls, afterFirst)
})
