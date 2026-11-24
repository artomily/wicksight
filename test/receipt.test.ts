import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildCloseReceipt } from '../server/receipt.ts'
import type { OrderFill, PositionSnapshot } from '../server/exchange/types.ts'

function position(overrides: Partial<PositionSnapshot> = {}): PositionSnapshot {
  return {
    hasPosition: true,
    symbol: 'BTCUSDT',
    side: 'LONG',
    qty: 0.01,
    entryPrice: 61_492.88,
    markPrice: 61_502.9,
    liqPrice: 58_684.4,
    leverage: 20,
    margin: 30.74644,
    unrealizedPnl: 0.1,
    roePct: 0.33,
    distanceToLiqPct: 4.58,
    priceDecimals: 1,
    qtyDecimals: 3,
    mode: 'binance-testnet',
    exchange: 'binance',
    updatedAt: 0,
    ...overrides,
  }
}

const fill: OrderFill = {
  orderId: '1',
  symbol: 'BTCUSDT',
  side: 'LONG',
  executedQty: 0.005,
  avgPrice: 61_502.9,
  qtyDecimals: 3,
  at: 0,
}

test('receipt records the liq line and buffer before and after close half', () => {
  const receipt = buildCloseReceipt(
    position(),
    position({ qty: 0.005, liqPrice: 55_590.6, distanceToLiqPct: 9.61 }),
    fill,
  )
  assert.ok(receipt)
  assert.equal(receipt.closedQty, 0.005)
  assert.equal(receipt.leftQty, 0.005)
  assert.equal(receipt.avgPrice, 61_502.9)
  assert.equal(receipt.liqBefore, 58_684.4)
  assert.equal(receipt.liqAfter, 55_590.6)
  assert.equal(receipt.bufferBeforePct, 4.58)
  assert.equal(receipt.bufferAfterPct, 9.61)
  assert.equal(receipt.side, 'LONG')
})

test('no before snapshot means no receipt rather than a fabricated one', () => {
  assert.equal(buildCloseReceipt(null, position({ qty: 0.005 }), fill), null)
  assert.equal(
    buildCloseReceipt(position({ hasPosition: false, side: null, qty: 0 }), position(), fill),
    null,
  )
})

test('missing liq prices stay null and the buffer falls back to mark/liq math', () => {
  const receipt = buildCloseReceipt(
    position({ liqPrice: null, distanceToLiqPct: null, markPrice: 61_000 }),
    position({ qty: 0.005, liqPrice: null, distanceToLiqPct: null, markPrice: 61_000 }),
    fill,
  )
  assert.ok(receipt)
  assert.equal(receipt.liqBefore, null)
  assert.equal(receipt.liqAfter, null)
  assert.equal(receipt.bufferBeforePct, null)
  assert.equal(receipt.bufferAfterPct, null)
})

test('buffer can be derived when the exchange did not send distanceToLiqPct', () => {
  const receipt = buildCloseReceipt(
    position({ distanceToLiqPct: null, markPrice: 60_000, liqPrice: 57_000 }),
    position({ qty: 0.005, distanceToLiqPct: null, markPrice: 60_000, liqPrice: 54_000 }),
    fill,
  )
  assert.ok(receipt)
  assert.ok(Math.abs((receipt.bufferBeforePct ?? 0) - 5) < 1e-9)
  assert.ok(Math.abs((receipt.bufferAfterPct ?? 0) - 10) < 1e-9)
})
