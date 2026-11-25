import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { PositionSnapshot } from '../server/exchange/types.ts'
import { checkKeyRestrictions } from '../server/exchange/binance.ts'
import { RiskAlerter, TelegramBot, type TelegramMessage } from '../server/telegram.ts'

const THRESHOLDS = { minutes: 10, bufferPct: 5, cooldownMs: 60_000 }
const LINK = (symbol: string) => `wicksight://close-half?symbol=${symbol}`

function position(overrides: Partial<PositionSnapshot> = {}): PositionSnapshot {
  return {
    hasPosition: true,
    symbol: 'SOLUSDT',
    side: 'LONG',
    qty: 4,
    entryPrice: 152,
    markPrice: 153.2,
    liqPrice: 146.85,
    leverage: 25,
    margin: 24.32,
    unrealizedPnl: 4.8,
    roePct: 19.7,
    distanceToLiqPct: 4.1,
    priceDecimals: 2,
    qtyDecimals: 2,
    mode: 'mock',
    exchange: 'mock',
    updatedAt: Date.now(),
    ...overrides,
  }
}

test('risk alerter sends once per crossing and respects the cooldown', () => {
  let now = 1_000_000
  const sent: TelegramMessage[] = []
  const alerter = new RiskAlerter(
    (text, kind) => sent.push({ at: now, kind, text }),
    THRESHOLDS,
    LINK,
    () => now,
  )
  const entry = { position: position({ distanceToLiqPct: 8 }), eta: { minutes: 9, speedPerMin: 1, bufferPct: 4.1, samples: 180, confidence: 0.9 } }

  alerter.evaluate([entry])
  alerter.evaluate([entry])
  assert.equal(sent.length, 1)
  assert.equal(sent[0]?.kind, 'eta')
  assert.match(sent[0]!.text, /LIQ IN ~9m/)
  assert.match(sent[0]!.text, /wicksight:\/\/close-half\?symbol=SOLUSDT/)

  // Leaving the danger zone and re-entering after the cooldown sends again.
  alerter.evaluate([{ ...entry, eta: { ...entry.eta, minutes: 60 } }])
  now += THRESHOLDS.cooldownMs + 1
  alerter.evaluate([entry])
  assert.equal(sent.length, 2)
})

test('buffer alert fires independently of an ETA', () => {
  const sent: string[] = []
  const alerter = new RiskAlerter(
    (text) => sent.push(text),
    THRESHOLDS,
    LINK,
    () => 1_000_000,
  )
  alerter.evaluate([{ position: position({ distanceToLiqPct: 3.2 }), eta: null }])
  assert.equal(sent.length, 1)
  assert.match(sent[0]!, /buffer alert/)
  assert.match(sent[0]!, /3.2% from liquidation/)
})

test('price alerts dedupe by alert identity', () => {
  const sent: string[] = []
  const alerter = new RiskAlerter(
    (text) => sent.push(text),
    THRESHOLDS,
    LINK,
    () => 1_000_000,
  )
  const alert = {
    symbol: 'SOLUSDT',
    price: 150,
    direction: 'below' as const,
    createdAt: 42,
    triggeredAt: 43,
  }
  alerter.priceAlert(alert)
  alerter.priceAlert(alert)
  assert.equal(sent.length, 1)
  assert.match(sent[0]!, /SOLUSDT ≤ 150.00/)
})

test('telegram mock mode keeps an outbox and pairs to a local file', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'wicksight-telegram-'))
  const bot = new TelegramBot({ chatFile: join(dir, 'chat.json'), thresholds: THRESHOLDS })
  assert.equal(bot.mode, 'mock')

  await bot.sendDemo()
  assert.equal(bot.status().recent.length, 1)
  assert.equal(bot.status().paired, false)

  // Pairing is the same write path the real /start handler uses.
  await bot.pair('123456789')
  const raw = JSON.parse(await readFile(join(dir, 'chat.json'), 'utf8')) as { chatId: string }
  assert.equal(raw.chatId, '123456789')
  assert.equal(bot.status().chatIdMasked, '••••6789')
})

test('api key restrictions refuse withdrawal and require futures', () => {
  assert.throws(
    () => checkKeyRestrictions({ enableWithdrawals: true, enableFutures: true }, false),
    /withdrawal permission is enabled/,
  )
  assert.throws(
    () => checkKeyRestrictions({ enableWithdrawals: false, enableFutures: false }, false),
    /futures trading is not enabled/,
  )
  const safe = checkKeyRestrictions(
    { enableWithdrawals: false, enableFutures: true, ipRestrict: true },
    true,
  )
  assert.deepEqual(
    { verified: safe.verified, withdrawals: safe.withdrawals, futures: safe.futures, ip: safe.ipRestrict },
    { verified: true, withdrawals: false, futures: true, ip: true },
  )
})
