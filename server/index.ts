import { config } from './config.ts'
import { createAdapter } from './exchange/index.ts'
import { AlertStore, PreviewStore } from './store.ts'
import { createFeed } from './feed.ts'
import { buildApp } from './app.ts'
import { warmAsr } from './asr.ts'
import { MarkBook } from './eta.ts'

const adapter = createAdapter()
const alerts = new AlertStore()
const previews = new PreviewStore()
const marks = new MarkBook()
const feed = createFeed(adapter, config.symbol, {
  onMark: (mark, symbol) => {
    marks.push(symbol, mark)
    alerts.check(mark, symbol)
  },
})

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
console.log(`  listening http://localhost:${config.port}`)
console.log(`  auth      order routes require the app token (${config.apiToken === 'dev-local-token' ? 'DEV DEFAULT — set API_TOKEN' : 'custom'})`)
console.log(`  cors      ${config.corsOrigins.join(', ')}`)
console.log('  testnet only — production hosts are rejected at boot')
console.log('')

if (config.warmAsr) void warmAsr()

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    feed.stop()
    void app.close().then(() => process.exit(0))
  })
}
