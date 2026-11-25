import { test } from 'node:test'
import assert from 'node:assert/strict'
import { initialMargin, liquidationPrice, MarketSimulator } from '../src/sim/engine.ts'

const ENTRY = 61_492.9
const MMR = 0.005

test('isolated liquidation formula: long and short', () => {
  const qty = 0.01
  const margin = initialMargin(ENTRY, qty, 20)
  const long = liquidationPrice('LONG', ENTRY, qty, margin, MMR)
  const short = liquidationPrice('SHORT', ENTRY, qty, margin, MMR)

  assert.ok(Math.abs(long - ENTRY * (1 - 1 / 20 + MMR)) < 1e-6)
  assert.ok(Math.abs(short - ENTRY * (1 + 1 / 20 - MMR)) < 1e-6)
  assert.ok(long < ENTRY && short > ENTRY)
  assert.equal(liquidationPrice('LONG', ENTRY, 0, margin, MMR), 0)
})

test('close half keeps the remaining isolated margin and moves liq away', () => {
  const sim = new MarketSimulator({ side: 'LONG', size: 0.01, leverage: 20, entry: ENTRY, seed: 7 })
  const before = sim.snapshot().position
  sim.setScenario('dump')
  sim.setSpeed(20)
  sim.start()
  for (let i = 0; i < 20; i++) sim.tick(100)

  const result = sim.closeHalf()
  assert.equal(result.fill.executedQty, 0.005)
  assert.equal(result.after.qty, 0.005)
  assert.ok(result.after.liqPrice !== null)
  assert.ok(before.liqPrice !== null)
  assert.ok(result.after.liqPrice! < before.liqPrice!, 'a long close half must lower the liq line')
  assert.ok(result.receipt)
  assert.ok(result.receipt!.bufferAfterPct! > result.receipt!.bufferBeforePct!)
})

test('a dump produces an ETA after a three-minute window, a flat tape does not', () => {
  const dump = new MarketSimulator({ side: 'LONG', size: 0.01, leverage: 20, entry: ENTRY, seed: 11 })
  dump.setScenario('dump')
  dump.setSpeed(20)
  dump.start()
  for (let i = 0; i < 30; i++) dump.tick(100) // 60 simulated seconds
  const eta = dump.snapshot().eta
  assert.ok(eta, 'a trending dump should produce an ETA')
  assert.ok(eta!.minutes > 0 && eta!.minutes <= 240)
  assert.ok(eta!.bufferPct > 0)

  const calm = new MarketSimulator({ side: 'LONG', size: 0.01, leverage: 20, entry: ENTRY, seed: 12 })
  calm.setScenario('calm')
  calm.start()
  for (let i = 0; i < 30; i++) calm.tick(100)
  assert.equal(calm.snapshot().eta, null, 'a calm/flat tape must hide the ETA')
})

test('speed controls simulated time, reset restores the entered position', () => {
  const sim = new MarketSimulator({ side: 'SHORT', size: 0.02, leverage: 10, entry: 60_000, seed: 3 })
  sim.setSpeed(20)
  sim.start()
  sim.tick(1_000)
  assert.ok(sim.snapshot().samples >= 20, '20x should generate ~20 ticks per real second')

  sim.pause()
  const samples = sim.snapshot().samples
  sim.tick(1_000)
  assert.equal(sim.snapshot().samples, samples, 'paused engine does not advance')

  sim.reset({ size: 0.005, leverage: 5, entry: 59_000 })
  const state = sim.snapshot()
  assert.equal(state.position.qty, 0.005)
  assert.equal(state.position.leverage, 5)
  assert.equal(state.markPrice, 59_000)
  assert.equal(state.running, false)
})
