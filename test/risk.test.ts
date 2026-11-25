import { test } from 'node:test'
import assert from 'node:assert/strict'
import { baseAsset, rankByRisk, riskHeader, type RiskItem } from '../shared/risk.ts'

const item = (symbol: string, buffer: number | null, eta: number | null, open = true): RiskItem => ({
  position: { symbol, hasPosition: open, distanceToLiqPct: buffer },
  eta: eta === null ? null : { minutes: eta },
})

test('live ETA outranks buffer, shortest ETA first', () => {
  const ranked = rankByRisk([
    item('BTCUSDT', 2, null),
    item('ETHUSDT', 9, 40),
    item('SOLUSDT', 4, 6),
  ])
  assert.deepEqual(ranked.map((r) => r.position.symbol), ['SOLUSDT', 'ETHUSDT', 'BTCUSDT'])
})

test('without ETAs the smallest buffer wins; flat and unknown go last', () => {
  const ranked = rankByRisk([
    item('XRPUSDT', null, null, false),
    item('BTCUSDT', 7, null),
    item('DOGEUSDT', null, null),
    item('ETHUSDT', 3, null),
  ])
  assert.deepEqual(ranked.map((r) => r.position.symbol), ['ETHUSDT', 'BTCUSDT', 'DOGEUSDT', 'XRPUSDT'])
})

test('rankByRisk does not mutate its input', () => {
  const input = [item('A', 5, null), item('B', 1, null)]
  rankByRisk(input)
  assert.equal(input[0].position.symbol, 'A')
})

test('riskHeader names the count and the riskiest asset', () => {
  assert.equal(
    riskHeader(rankByRisk([item('BTCUSDT', 6, null), item('SOLUSDT', 4, 6.2), item('ETHUSDT', 8, null)])),
    '3 positions · riskiest SOL ~6m',
  )
  assert.equal(riskHeader([item('BTCUSDT', 4.25, null)]), '1 position · riskiest BTC 4.3%')
  assert.equal(riskHeader([item('BTCUSDT', null, null, false)]), 'No open positions')
  assert.equal(baseAsset('1000PEPEUSDT'), '1000PEPE')
})
