import { config } from './config.ts'
import { createAdapter } from './exchange/index.ts'
import { AlertStore, PreviewStore } from './store.ts'
import { createFeed, feedViews } from './feed.ts'
import { buildApp } from './app.ts'
import { warmAsr } from './asr.ts'
import { computeLiqEta, MarkBook } from './eta.ts'
import { BinanceTestnetAdapter } from './exchange/binance.ts'
import { RiskAlerter, TelegramBot } from './telegram.ts'

const adapter = createAdapter()
const keySafety = adapter instanceof BinanceTestnetAdapter ? await adapter.keySafety() : null
const alerts = new AlertStore()
const previews = new PreviewStore()
const marks = new MarkBook()
const feed = createFeed(adapter, config.symbol, {
  onMark: (mark, symbol) => {
    marks.push(symbol, mark)
    alerts.check(mark, symbol)
  },
})

const telegram = new TelegramBot({
  token: config.telegram.token,
  chatFile: config.telegram.chatFile,
  thresholds: config.telegram.thresholds,
  disabled: config.telegram.disabled,
})
await telegram.start()
const alerter = new RiskAlerter(
  (text, kind) => telegram.send(text, kind),
  config.telegram.thresholds,
  (symbol) => `${config.telegram.deepLinkBase}?symbol=${encodeURIComponent(symbol)}`,
)
alerts.onTrigger = (alert) => alerter.priceAlert(alert)
const riskTimer = setInterval(() => {
  const entries = feedViews(feed).map((position) => ({
    position,
    eta: computeLiqEta(marks.snapshot(position.symbol), position),
  }))
  alerter.evaluate(entries)
}, 2_000)
riskTimer.unref?.()

const app = buildApp({
  adapter,
  feed,
  alerts,
  previews,
  marks,
  symbol: config.symbol,
  apiToken: config.apiToken,
  corsOrigins: config.corsOrigins,
  asr: config.asrProvider,
  keys:
    config.exchange === 'binance'
      ? config.hasBinanceKeys
      : config.exchange === 'okx'
        ? config.hasOkxKeys
        : null,
  allowMainnet: config.allowMainnet,
  keySafety,
  telegram,
})

await feed.start()
await app.listen({ port: config.port, host: config.host })

const keyState =
  config.exchange === 'binance'
    ? config.hasBinanceKeys
      ? 'keys loaded'
      : 'KEYS MISSING'
    : config.exchange === 'okx'
      ? config.hasOkxKeys
        ? 'keys loaded'
        : 'KEYS MISSING'
      : 'paper data, no keys'

console.log('')
console.log('  WickSight API')
console.log(`  mode      ${adapter.mode}  (${keyState})`)
console.log(`  symbol    ${config.symbol}`)
console.log(`  asr       ${config.asrProvider}`)
console.log(`  feed      ${feed.meta().transport}${feed.meta().pausedUntil ? ` (paused until ${new Date(feed.meta().pausedUntil!).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })})` : ''}`)
console.log(`  keys      ${keySafety ? (keySafety.verified ? 'withdrawals refused · futures trade on' : `unverified — ${keySafety.warning ?? 'check manually'}`) : 'no exchange key check'}`)
console.log(`  listening http://localhost:${config.port}`)
console.log(`  auth      order routes require the app token (${config.apiToken === 'dev-local-token' ? 'DEV DEFAULT — set API_TOKEN' : 'custom'})`)
console.log(`  cors      ${config.corsOrigins.join(', ')}`)
console.log(
  adapter.mode === 'binance-mainnet'
    ? '  MAINNET OPT-IN — real funds; withdrawal permission was refused at boot'
    : '  testnet only — production hosts are rejected at boot',
)
console.log(`  telegram  ${telegram.status().mode}${telegram.status().paired ? ' · paired' : ''}`)
console.log('')

if (config.allowMainnet) {
  console.warn('  WARNING   ALLOW_MAINNET=1 — this process can send real reduce-only orders')
}

if (config.warmAsr) void warmAsr()

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    feed.stop()
    telegram.stop()
    clearInterval(riskTimer)
    void app.close().then(() => process.exit(0))
  })
}
