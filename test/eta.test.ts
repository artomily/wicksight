import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeLiqEta, MarkHistory, type MarkSample } from '../server/eta.ts'
import type { PositionSnapshot } from '../server/exchange/types.ts'
import { formatEta } from '../src/format.ts'

const NOW = 1_700_000_000_000

function position(overrides: Partial<PositionSnapshot> = {}): PositionSnapshot {
  return {
    hasPosition: true,
    symbol: 'BTCUSDT',
    side: 'LONG',
    qty: 0.01,
    entryPrice: 61_500,
    markPrice: 61_000,
    liqPrice: 59_000,
    leverage: 20,
    margin: 30.75,
    unrealizedPnl: -5,
    roePct: -16.26,
    distanceToLiqPct: 3.2787,
    priceDecimals: 1,
    qtyDecimals: 3,
    mode: 'binance-testnet',
    exchange: 'binance',
    updatedAt: NOW,
    ...overrides,
  }
}

function trend(from: number, to: number, count = 181): MarkSample[] {
  return Array.from({ length: count }, (_, i) => ({
    at: NOW - 180_000 + i * 1_000,
    price: from + ((to - from) * i) / (count - 1),
  }))
}

test('long: a clean fall toward liq yields a minutes estimate', () => {
  const eta = computeLiqEta(trend(61_600, 61_000), position(), NOW)
  assert.ok(eta)
  assert.ok(Math.abs(eta.minutes - 10) < 0.01, `minutes ${eta.minutes}`)
  assert.ok(Math.abs(eta.speedPerMin - 200) < 0.01)
  assert.ok(Math.abs(eta.bufferPct - (2_000 / 61_000) * 100) < 1e-9)
  assert.equal(eta.samples, 181)
  assert.ok(eta.confidence > 0.999)
})

test('short: a clean rise toward liq yields a minutes estimate', () => {
  const eta = computeLiqEta(
    trend(61_000, 61_600),
    position({ side: 'SHORT', markPrice: 61_600, liqPrice: 63_000, distanceToLiqPct: 2.2727 }),
    NOW,
  )
  assert.ok(eta)
  assert.ok(Math.abs(eta.minutes - 7) < 0.01, `minutes ${eta.minutes}`)
  assert.ok(Math.abs(eta.speedPerMin - 200) < 0.01)
})

test('moving away is hidden, not shown as a fake ETA', () => {
  assert.equal(computeLiqEta(trend(61_000, 61_600), position(), NOW), null)
})

test('a flat or noisy tape is hidden', () => {
  const flat = Array.from({ length: 181 }, (_, i) => ({
    at: NOW - 180_000 + i * 1_000,
    price: 61_000 + (i % 2 === 0 ? 40 : -40),
  }))
  assert.equal(computeLiqEta(flat, position({ markPrice: 61_040 }), NOW), null)
})

test('too few samples or too short a window is hidden', () => {
  assert.equal(computeLiqEta(trend(61_600, 61_000, 20), position(), NOW), null)
  const shortWindow = Array.from({ length: 20 }, (_, i) => ({
    at: NOW - 20_000 + i * 1_000,
    price: 61_600 - i * 10,
  }))
  assert.equal(computeLiqEta(shortWindow, position({ markPrice: 61_410 }), NOW), null)
})

test('an ETA beyond four hours is not a glanceable warning', () => {
  assert.equal(
    computeLiqEta(trend(61_600, 61_000), position({ markPrice: 61_000, liqPrice: 1_000 }), NOW),
    null,
  )
})

test('MarkHistory keeps five minutes and ignores invalid prices', () => {
  const history = new MarkHistory()
  history.push(60_000, NOW - 6 * 60_000)
  history.push(61_000, NOW - 60_000)
  history.push(Number.NaN, NOW)
  history.push(-1, NOW)
  history.push(61_100, NOW)
  const snapshot = history.snapshot(NOW)
  assert.equal(snapshot.length, 2)
  assert.equal(snapshot[0].price, 61_000)
  assert.equal(snapshot[1].price, 61_100)
})

test('formatEta rounds to minutes and hours', () => {
  assert.equal(formatEta(0.5), '<1m')
  assert.equal(formatEta(4.2), '~4m')
  assert.equal(formatEta(4.6), '~5m')
  assert.equal(formatEta(75), '~1.3h')
})

test('a mark already past the liq line is hidden', () => {
  assert.equal(
    computeLiqEta(trend(59_000, 58_500), position({ markPrice: 58_500, liqPrice: 59_000 }), NOW),
    null,
  )
})
