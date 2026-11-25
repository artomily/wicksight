import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../server/app.ts'
import { MockAdapter } from '../server/exchange/mock.ts'
import { AlertStore, PreviewStore } from '../server/store.ts'
import type { PositionFeed } from '../server/feed.ts'
import type { PositionSnapshot } from '../server/exchange/types.ts'
import { MarkBook } from '../server/eta.ts'

const TOKEN = 'test-token'
const AUTH = { authorization: `Bearer ${TOKEN}` }
const APP_ORIGIN = 'http://localhost:5173'

interface Harness {
  app: FastifyInstance
  adapter: MockAdapter
  previews: PreviewStore
  marks: MarkBook
  position: () => PositionSnapshot | null
  positions: () => PositionSnapshot[]
}

async function harness(options: { ttlMs?: number; corsOrigins?: string[]; multi?: boolean } = {}): Promise<Harness> {
  const adapter = new MockAdapter()
  const alerts = new AlertStore()
  const previews = new PreviewStore(options.ttlMs)
  const marks = new MarkBook()
  let positions: PositionSnapshot[] = options.multi
    ? await adapter.getPositions!('BTCUSDT')
    : [await adapter.getPosition('BTCUSDT')]
  const view = () => positions.find((p) => p.symbol === 'BTCUSDT') ?? positions[0] ?? null

  const feed: PositionFeed = {
    start: async () => {},
    stop: () => {},
    view,
    views: () => positions,
    refresh: async () => {
      positions = options.multi
        ? await adapter.getPositions!('BTCUSDT')
        : [await adapter.getPosition('BTCUSDT')]
      return view()
    },
    meta: () => ({
      transport: 'mock',
      connected: true,
      stale: false,
      pausedUntil: null,
      lastUpdate: Date.now(),
    }),
  }

  const app = buildApp({
    adapter,
    feed,
    alerts,
    previews,
    marks,
    symbol: 'BTCUSDT',
    apiToken: TOKEN,
    corsOrigins: options.corsOrigins ?? [APP_ORIGIN],
    asr: 'local',
    keys: null,
  })

  return { app, adapter, previews, marks, position: view, positions: () => positions }
}

test('order routes reject requests without the app token', async () => {
  const { app } = await harness()
  try {
    const preview = await app.inject({ method: 'POST', url: '/api/orders/preview' })
    assert.equal(preview.statusCode, 401)
    assert.equal(preview.json().error, 'UNAUTHORIZED')

    const execute = await app.inject({
      method: 'POST',
      url: '/api/orders/execute',
      headers: { 'content-type': 'application/json' },
      payload: { id: 'whatever' },
    })
    assert.equal(execute.statusCode, 401)
  } finally {
    await app.close()
  }
})

test('preview then execute halves the position; replay is a clean 409', async () => {
  const { app, position } = await harness()
  try {
    const previewRes = await app.inject({
      method: 'POST',
      url: '/api/orders/preview',
      headers: AUTH,
    })
    assert.equal(previewRes.statusCode, 200)
    const preview = previewRes.json().preview
    assert.equal(preview.qty, 0.005)

    const executeRes = await app.inject({
      method: 'POST',
      url: '/api/orders/execute',
      headers: { ...AUTH, 'content-type': 'application/json' },
      payload: { id: preview.id },
    })
    assert.equal(executeRes.statusCode, 200)
    const body = executeRes.json()
    assert.equal(body.fill.executedQty, 0.005)
    assert.equal(body.position.qty, 0.005)
    assert.equal(position()?.qty, 0.005)
    assert.ok(body.receipt, 'execute returns an after-action receipt')
    assert.equal(body.receipt.closedQty, 0.005)
    assert.equal(body.receipt.leftQty, 0.005)
    assert.ok(body.receipt.liqBefore > 0)
    assert.ok(body.receipt.liqAfter > 0)
    assert.ok(body.receipt.bufferBeforePct > 0)
    assert.ok(body.receipt.bufferAfterPct > 0)

    const replay = await app.inject({
      method: 'POST',
      url: '/api/orders/execute',
      headers: { ...AUTH, 'content-type': 'application/json' },
      payload: { id: preview.id },
    })
    assert.equal(replay.statusCode, 409)
    assert.equal(replay.json().error, 'PREVIEW_USED')
    // The position did not move a second time.
    assert.equal(position()?.qty, 0.005)
  } finally {
    await app.close()
  }
})

test('unknown confirmation id is a 404, not an internal error', async () => {
  const { app } = await harness()
  try {
    const res = await app.inject({
      method: 'POST',
      url: '/api/orders/execute',
      headers: { ...AUTH, 'content-type': 'application/json' },
      payload: { id: 'does-not-exist' },
    })
    assert.equal(res.statusCode, 404)
    assert.equal(res.json().error, 'PREVIEW_UNKNOWN')
  } finally {
    await app.close()
  }
})

test('expired confirmation is a clean 410', async () => {
  const { app } = await harness({ ttlMs: 0 })
  try {
    const previewRes = await app.inject({ method: 'POST', url: '/api/orders/preview', headers: AUTH })
    const id = previewRes.json().preview.id as string
    await new Promise((resolve) => setTimeout(resolve, 10))

    const res = await app.inject({
      method: 'POST',
      url: '/api/orders/execute',
      headers: { ...AUTH, 'content-type': 'application/json' },
      payload: { id },
    })
    assert.equal(res.statusCode, 410)
    assert.equal(res.json().error, 'PREVIEW_EXPIRED')
  } finally {
    await app.close()
  }
})

test('a token issued for another symbol is refused', async () => {
  const { app, previews } = await harness()
  try {
    previews.create({
      id: 'other-symbol',
      symbol: 'ETHUSDT',
      side: 'LONG',
      qty: 0.001,
      remaining: 0.009,
      qtyDecimals: 3,
      createdAt: Date.now(),
    })

    const res = await app.inject({
      method: 'POST',
      url: '/api/orders/execute',
      headers: { ...AUTH, 'content-type': 'application/json' },
      payload: { id: 'other-symbol' },
    })
    assert.equal(res.statusCode, 409)
    assert.equal(res.json().error, 'SYMBOL_MISMATCH')
  } finally {
    await app.close()
  }
})

test('CORS allows the app origin and rejects others', async () => {
  const { app } = await harness()
  try {
    const allowed = await app.inject({
      method: 'GET',
      url: '/api/health',
      headers: { origin: APP_ORIGIN },
    })
    assert.equal(allowed.headers['access-control-allow-origin'], APP_ORIGIN)

    const denied = await app.inject({
      method: 'GET',
      url: '/api/health',
      headers: { origin: 'https://evil.example' },
    })
    assert.equal(denied.headers['access-control-allow-origin'], undefined)

    const preflight = await app.inject({
      method: 'OPTIONS',
      url: '/api/orders/preview',
      headers: {
        origin: APP_ORIGIN,
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'authorization',
      },
    })
    assert.equal(preflight.statusCode, 204)
    assert.match(String(preflight.headers['access-control-allow-headers']), /authorization/i)
  } finally {
    await app.close()
  }
})

test('state is served from the feed cache without touching the exchange', async () => {
  const { app, adapter } = await harness()
  try {
    let calls = 0
    const original = adapter.getPosition.bind(adapter)
    adapter.getPosition = async (symbol: string) => {
      calls += 1
      return original(symbol)
    }

    const res = await app.inject({ method: 'GET', url: '/api/state', headers: { origin: APP_ORIGIN } })
    assert.equal(res.statusCode, 200)
    assert.equal(res.json().position.qty, 0.01)
    assert.equal(calls, 0)
  } finally {
    await app.close()
  }
})

test('state includes an ETA when mark ticks trend toward liquidation', async () => {
  const { app, marks, position } = await harness()
  try {
    const now = Date.now()
    const mark = position()!.markPrice
    // 3 minutes of clean 1 s ticks, falling 700 USDT/min toward the long's liq.
    for (let i = 0; i < 181; i++) {
      marks.push('BTCUSDT', mark + 2100 - i * (2100 / 180), now - 180_000 + i * 1_000)
    }

    const res = await app.inject({ method: 'GET', url: '/api/state', headers: { origin: APP_ORIGIN } })
    assert.equal(res.statusCode, 200)
    const eta = res.json().eta
    assert.ok(eta, 'eta is present for a clean trend')
    assert.ok(eta.minutes > 4 && eta.minutes < 8, `minutes was ${eta.minutes}`)
    assert.ok(eta.bufferPct > 0)
    assert.ok(eta.confidence > 0.9)
  } finally {
    await app.close()
  }
})

test('state hides the ETA when price is moving away', async () => {
  const { app, marks, position } = await harness()
  try {
    const now = Date.now()
    const mark = position()!.markPrice
    // A long with price climbing away from the liq line.
    for (let i = 0; i < 181; i++) {
      marks.push('BTCUSDT', mark - 2100 + i * (2100 / 180), now - 180_000 + i * 1_000)
    }

    const res = await app.inject({ method: 'GET', url: '/api/state', headers: { origin: APP_ORIGIN } })
    assert.equal(res.statusCode, 200)
    assert.equal(res.json().eta, null)
  } finally {
    await app.close()
  }
})


test('state ranks every mock position riskiest first', async () => {
  const { app } = await harness({ multi: true })
  try {
    const res = await app.inject({ method: 'GET', url: '/api/state', headers: { origin: APP_ORIGIN } })
    assert.equal(res.statusCode, 200)
    const body = res.json()
    assert.equal(body.positions.length, 3)
    assert.equal(body.position.symbol, 'SOLUSDT')
    assert.equal(body.positions[0].position.symbol, 'SOLUSDT')
    assert.match(body.header, /^3 positions · riskiest SOL/)
    assert.ok(body.positions.every((entry: { position: PositionSnapshot }) => entry.position.hasPosition))
  } finally {
    await app.close()
  }
})

test('close half applies to the requested symbol only', async () => {
  const { app, positions } = await harness({ multi: true })
  try {
    const previewRes = await app.inject({
      method: 'POST',
      url: '/api/orders/preview',
      headers: { ...AUTH, 'content-type': 'application/json' },
      payload: { symbol: 'ETHUSDT' },
    })
    assert.equal(previewRes.statusCode, 200)
    const preview = previewRes.json().preview
    assert.equal(preview.symbol, 'ETHUSDT')
    assert.equal(preview.qty, 0.1)

    const executeRes = await app.inject({
      method: 'POST',
      url: '/api/orders/execute',
      headers: { ...AUTH, 'content-type': 'application/json' },
      payload: { id: preview.id },
    })
    assert.equal(executeRes.statusCode, 200)
    assert.equal(executeRes.json().position.symbol, 'ETHUSDT')
    assert.equal(executeRes.json().position.qty, 0.1)

    const eth = positions().find((p) => p.symbol === 'ETHUSDT')
    const sol = positions().find((p) => p.symbol === 'SOLUSDT')
    assert.equal(eth?.qty, 0.1)
    assert.equal(sol?.qty, 4)
  } finally {
    await app.close()
  }
})

test('price alerts carry the symbol they watch', async () => {
  const { app } = await harness({ multi: true })
  try {
    const arm = await app.inject({
      method: 'POST',
      url: '/api/alert',
      headers: { 'content-type': 'application/json' },
      payload: { price: 150, symbol: 'SOLUSDT' },
    })
    assert.equal(arm.statusCode, 200)
    assert.equal(arm.json().alert.symbol, 'SOLUSDT')

    const state = await app.inject({ method: 'GET', url: '/api/state', headers: { origin: APP_ORIGIN } })
    assert.equal(state.json().alert.symbol, 'SOLUSDT')
  } finally {
    await app.close()
  }
})


test('closing half on the mock account moves the liquidation line away', async () => {
  const adapter = new MockAdapter()
  const before = await adapter.getPosition('SOLUSDT')
  const preview = await adapter.previewCloseHalf('SOLUSDT')
  await adapter.executeCloseHalf('SOLUSDT', preview.qty)
  const after = await adapter.getPosition('SOLUSDT')
  assert.ok(before.liqPrice && after.liqPrice)
  assert.ok(after.liqPrice! < before.liqPrice!, 'a long close should lower the liq line')
  assert.ok(after.distanceToLiqPct! > before.distanceToLiqPct!, 'the buffer should improve')
})


test('security status is read-only and reports no key check in mock mode', async () => {
  const { app } = await harness()
  try {
    const res = await app.inject({ method: 'GET', url: '/api/security', headers: { origin: APP_ORIGIN } })
    assert.equal(res.statusCode, 200)
    const body = res.json()
    assert.equal(body.mode, 'mock')
    assert.equal(body.testnetOnly, true)
    assert.equal(body.mainnetOptIn, false)
    assert.equal(body.keySafety, null)
    assert.equal(body.telegram, null)

    const off = await app.inject({ method: 'POST', url: '/api/telegram/test' })
    assert.equal(off.statusCode, 404)
  } finally {
    await app.close()
  }
})
