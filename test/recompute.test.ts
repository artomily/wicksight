import { test } from 'node:test'
import assert from 'node:assert/strict'
import { applyMark, parseBanUntil, parseRetryAfter } from '../server/recompute.ts'
import type { PositionSnapshot } from '../server/exchange/types.ts'

function position(overrides: Partial<PositionSnapshot> = {}): PositionSnapshot {
  return {
    hasPosition: true,
    symbol: 'BTCUSDT',
    side: 'LONG',
    qty: 0.01,
    entryPrice: 63_000,
    markPrice: 63_000,
    liqPrice: 60_000,
    leverage: 20,
    margin: 31.5,
    unrealizedPnl: 0,
    roePct: 0,
    distanceToLiqPct: 4.762,
    priceDecimals: 1,
    qtyDecimals: 3,
    mode: 'binance-testnet',
    exchange: 'binance',
    updatedAt: 0,
    ...overrides,
  }
}

test('mark tick recomputes long PnL, ROE and liquidation distance', () => {
  const next = applyMark(position(), 64_000)
  assert.equal(next.markPrice, 64_000)
  assert.ok(Math.abs(next.unrealizedPnl - 10) < 1e-9)
  assert.ok(Math.abs(next.roePct - 31.746) < 0.01)
  assert.ok(Math.abs((next.distanceToLiqPct ?? 0) - 6.25) < 1e-9)
})

test('short PnL moves the other way', () => {
  const next = applyMark(position({ side: 'SHORT', qty: 0.01, entryPrice: 63_000 }), 62_000)
  assert.ok(Math.abs(next.unrealizedPnl - 10) < 1e-9)
})

test('no position produces no fabricated PnL', () => {
  const next = applyMark(position({ hasPosition: false, side: null, qty: 0, liqPrice: null }), 64_000)
  assert.equal(next.unrealizedPnl, 0)
  assert.equal(next.roePct, 0)
  assert.equal(next.distanceToLiqPct, null)
})

test('ban resume time is parsed from the Binance message', () => {
  const msg =
    'Way too many requests; IP(130.176.187.77) banned until 1795416955023. Please use the websocket for live updates to avoid bans.'
  assert.equal(parseBanUntil(msg), 1795416955023)
  assert.equal(parseBanUntil('no ban here'), null)
})

test('Retry-After accepts seconds and HTTP dates', () => {
  const now = 1_700_000_000_000
  assert.equal(parseRetryAfter('30', now), now + 30_000)
  assert.equal(parseRetryAfter(null, now), null)
  assert.equal(
    parseRetryAfter('Wed, 21 Oct 2015 07:28:00 GMT', now),
    Date.parse('Wed, 21 Oct 2015 07:28:00 GMT'),
  )
})
