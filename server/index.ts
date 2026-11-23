import Fastify from 'fastify'
import cors from '@fastify/cors'
import { config } from './config.ts'
import { createAdapter } from './exchange/index.ts'
import { ExchangeError } from './exchange/types.ts'
import { AlertStore, PreviewStore } from './store.ts'
import { parseIntent } from './intents.ts'
import { transcribePcm, warmAsr } from './asr.ts'
import { MockAdapter } from './exchange/mock.ts'

const adapter = createAdapter()
const alerts = new AlertStore()
const previews = new PreviewStore()
let orderInFlight = false
let lastExecuteAt = 0

const app = Fastify({ logger: false, bodyLimit: 2 * 1024 * 1024 })

await app.register(cors, {
  origin: true,
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
  maxAge: 86_400,
})

app.addContentTypeParser(
  'application/octet-stream',
  { parseAs: 'buffer' },
  (_req, body, done) => done(null, body),
)

app.addHook('onResponse', (req, reply, done) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.url} ${reply.statusCode} ${reply.elapsedTime.toFixed(0)}ms`)
  done()
})

app.setErrorHandler((err, _req, reply) => {
  if (err instanceof ExchangeError) {
    return reply.status(err.status >= 400 && err.status < 600 ? err.status : 502).send({
      error: err.code ?? 'EXCHANGE',
      message: err.message,
    })
  }
  const status = (err as { statusCode?: number }).statusCode ?? 500
  const message = (err as Error).message
  if (status >= 500) console.error('[api]', message)
  return reply.status(status).send({ error: 'INTERNAL', message })
})

app.get('/', async () => ({
  name: 'Session Guard API',
  mode: adapter.mode,
  symbol: config.symbol,
  testnetOnly: true,
}))

app.get('/api/health', async () => ({
  ok: true,
  mode: adapter.mode,
  symbol: config.symbol,
  asr: config.asrProvider,
  keys: config.exchange === 'binance' ? config.hasBinanceKeys : config.exchange === 'okx' ? config.hasOkxKeys : null,
  uptimeSec: Math.round(process.uptime()),
}))

app.get('/api/state', async (_req, reply) => {
  const position = await adapter.getPosition(config.symbol)
  const alert = alerts.check(position.markPrice)
  reply.header('Cache-Control', 'no-store')
  return {
    position,
    alert,
    meta: {
      testnetOnly: true,
      mode: position.mode,
      exchange: position.exchange,
      symbol: config.symbol,
      serverTime: Date.now(),
    },
  }
})

app.post<{ Body: { price?: unknown } }>('/api/alert', async (req, reply) => {
  const price = Number(req.body?.price)
  if (!Number.isFinite(price) || price <= 0) {
    return reply.status(400).send({ error: 'BAD_PRICE', message: 'Price must be a positive number' })
  }
  const position = await adapter.getPosition(config.symbol)
  if (price < position.markPrice * 0.2 || price > position.markPrice * 5) {
    return reply.status(400).send({ error: 'PRICE_RANGE', message: 'Price is too far from the market' })
  }
  return { alert: alerts.set(price, position.markPrice) }
})

app.delete('/api/alert', async () => {
  alerts.clear()
  return { ok: true }
})

app.post('/api/orders/preview', async () => {
  const preview = await adapter.previewCloseHalf(config.symbol)
  previews.create(preview)
  return { preview }
})

app.post<{ Body: { id?: string } }>('/api/orders/execute', async (req, reply) => {
  const id = String(req.body?.id ?? '')
  if (!id) return reply.status(400).send({ error: 'NO_PREVIEW', message: 'Missing confirmation token' })

  if (orderInFlight || Date.now() - lastExecuteAt < 1_500) {
    return reply.status(429).send({ error: 'BUSY', message: 'An order is already being sent' })
  }

  const preview = previews.take(id)
  if (preview.symbol !== config.symbol) {
    return reply.status(409).send({ error: 'SYMBOL_MISMATCH', message: 'Confirmation does not match this position' })
  }

  orderInFlight = true
  lastExecuteAt = Date.now()
  try {
    const fill = await adapter.executeCloseHalf(config.symbol, preview.qty)
    const position = await adapter.getPosition(config.symbol)
    return { fill, position, preview }
  } finally {
    orderInFlight = false
  }
})

app.post<{ Body: { text?: string } }>('/api/intent', async (req, reply) => {
  const text = String(req.body?.text ?? '').trim()
  if (!text) return reply.status(400).send({ error: 'NO_TEXT', message: 'Send { "text": "…" }' })

  let markPrice: number | undefined
  try {
    markPrice = (await adapter.getPosition(config.symbol)).markPrice
  } catch {
    markPrice = undefined
  }

  return {
    text,
    intent: parseIntent(text, markPrice),
    provider: 'text',
    latencyMs: 0,
  }
})

app.post('/api/voice', async (req, reply) => {
  const pcm = req.body as Buffer
  if (!Buffer.isBuffer(pcm) || pcm.length < 3_200) {
    return reply.status(400).send({ error: 'NO_AUDIO', message: 'Send raw 16 kHz PCM16 mono audio' })
  }

  const transcript = await transcribePcm(pcm)
  let markPrice: number | undefined
  try {
    markPrice = (await adapter.getPosition(config.symbol)).markPrice
  } catch {
    markPrice = undefined
  }

  const intent = transcript.text
    ? parseIntent(transcript.text, markPrice)
    : { type: 'none' as const, reason: 'no_speech', hint: 'Hold the temple and speak.' }

  return {
    text: transcript.text,
    intent,
    provider: transcript.provider,
    latencyMs: transcript.latencyMs,
  }
})

app.post('/api/dev/reset', async (_req, reply) => {
  if (!(adapter instanceof MockAdapter)) {
    return reply.status(404).send({ error: 'NOT_MOCK', message: 'Only available in mock mode' })
  }
  adapter.reset()
  alerts.clear()
  return { ok: true }
})

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
console.log('  Session Guard API')
console.log(`  mode      ${adapter.mode}  (${keyState})`)
console.log(`  symbol    ${config.symbol}`)
console.log(`  asr       ${config.asrProvider}`)
console.log(`  listening http://localhost:${config.port}`)
console.log('  testnet only — production hosts are rejected at boot')
console.log('')

if (config.warmAsr) void warmAsr()

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    void app.close().then(() => process.exit(0))
  })
}
