import { test } from 'node:test'
import assert from 'node:assert/strict'
import { assertNonProductionHost } from '../server/config.ts'
import { BinanceTestnetAdapter } from '../server/exchange/binance.ts'
import { floorToStep } from '../server/exchange/types.ts'
import { AlertStore, PreviewStore } from '../server/store.ts'
import { OkxDemoAdapter } from '../server/exchange/okx.ts'

test('binance adapter refuses a production host at construction', () => {
  assert.throws(
    () => new BinanceTestnetAdapter('key', 'secret', 'https://fapi.binance.com'),
    /Refusing to use/,
  )
})

test('mainnet is refused unless it is explicitly allowed', () => {
  assert.throws(
    () => new BinanceTestnetAdapter('key', 'secret', 'https://fapi.binance.com', 'wss://fstream.binance.com'),
    /Refusing to use/,
  )
})

test('host gate only accepts the testnet host', () => {
  assert.doesNotThrow(() => assertNonProductionHost('https://testnet.binancefuture.com', ['testnet.binancefuture.com']))
  assert.throws(() => assertNonProductionHost('https://fapi.binance.com', ['testnet.binancefuture.com']))
  assert.throws(() => assertNonProductionHost('https://testnet.binancefuture.com.evil.dev', ['testnet.binancefuture.com']))
})

test('quantity is floored to the exchange step, never rounded up', () => {
  assert.equal(floorToStep(0.0109, '0.001'), 0.01)
  assert.equal(floorToStep(0.0109, '0.01'), 0.01)
  assert.equal(floorToStep(0.0009, '0.001'), 0)
  assert.equal(floorToStep(0.5, '1'), 0)
  assert.equal(floorToStep(12.3456, '0.1'), 12.3)
})

test('confirm token is single use', () => {
  const store = new PreviewStore()
  const preview = {
    id: 'p1',
    symbol: 'BTCUSDT',
    side: 'LONG' as const,
    qty: 0.005,
    remaining: 0.005,
    qtyDecimals: 3,
    createdAt: Date.now(),
  }
  store.create(preview)
  assert.equal(store.take('p1').qty, 0.005)
  assert.throws(() => store.take('p1'), /already used/)
})

test('alert arms on the correct side and fires once', () => {
  const alerts = new AlertStore()
  const armed = alerts.set(62_000, 64_000)
  assert.equal(armed.direction, 'below')
  assert.equal(alerts.check(63_000)?.triggeredAt, null)
  const fired = alerts.check(61_900)
  assert.ok(fired?.triggeredAt)
  const again = alerts.check(61_800)
  assert.equal(again?.triggeredAt, fired?.triggeredAt)
})

test('alert above the market fires when price rises', () => {
  const alerts = new AlertStore()
  alerts.set(65_000, 64_000)
  assert.equal(alerts.check(64_500)?.triggeredAt, null)
  assert.ok(alerts.check(65_100)?.triggeredAt)
})

test('OKX adapter refuses to exist without demo mode', () => {
  assert.throws(
    () => new OkxDemoAdapter('key', 'secret', 'pass', 'https://www.okx.com', false),
    /demo mode/,
  )
})
