import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify'
import cors from '@fastify/cors'
import { timingSafeEqual } from 'node:crypto'
import type { ExchangeAdapter } from './exchange/types.ts'
import { ExchangeError } from './exchange/types.ts'
import { MockAdapter } from './exchange/mock.ts'
import { feedViews, type PositionFeed } from './feed.ts'
import type { AlertStore, PreviewStore } from './store.ts'
import { parseIntent } from './intents.ts'
import { transcribePcm } from './asr.ts'
import { computeLiqEta, type LiqEta, type MarkBook } from './eta.ts'
import type { PositionSnapshot } from './exchange/types.ts'
import { rankByRisk, riskHeader } from '../shared/risk.ts'
import { buildCloseReceipt } from './receipt.ts'
import type { KeySafety } from './exchange/binance.ts'
import type { TelegramBot } from './telegram.ts'

export interface AppDeps {
  adapter: ExchangeAdapter
  feed: PositionFeed
  alerts: AlertStore
  previews: PreviewStore
  marks: MarkBook
  symbol: string
  apiToken: string
  corsOrigins: string[]
  asr: string
  keys: boolean | null
  allowMainnet?: boolean
  keySafety?: KeySafety | null
  telegram?: TelegramBot | null
}

/**
 * The HTTP surface, separable from the listening process so route behaviour
 * (auth, single-use tokens, CORS) can be tested with `app.inject()`.
 */
export function buildApp(deps: AppDeps): FastifyInstance {
  const app = Fastify({ logger: false, bodyLimit: 2 * 1024 * 1024 })
  const { adapter, feed, alerts, previews, symbol } = deps
  const testnetOnly = adapter.mode !== 'binance-mainnet'

  let orderInFlight = false

  /** Every known position with its own ETA, riskiest first. */
  const ranked = (): Array<{ position: PositionSnapshot; eta: LiqEta | null }> =>
    rankByRisk(
      feedViews(feed).map((position) => ({
        position,
        eta: computeLiqEta(deps.marks.snapshot(position.symbol), position),
      })),
    )

  const openPosition = (symbol: string): PositionSnapshot | null =>
    feedViews(feed).find((p) => p.symbol === symbol && p.hasPosition) ?? null

  /** An explicit symbol, else the riskiest open position, else the configured one. */
  const targetSymbol = (requested: unknown): string => {
    if (typeof requested === 'string' && requested.trim()) return requested.trim().toUpperCase()
    const top = ranked().find((entry) => entry.position.hasPosition)
    return top?.position.symbol ?? symbol
  }

  const markFor = (requested: unknown): number | undefined => {
    const want = targetSymbol(requested)
    return feedViews(feed).find((p) => p.symbol === want)?.markPrice ?? feed.view()?.markPrice
  }

  const expectedToken = Buffer.from(deps.apiToken)

  const requireAuth = async (req: FastifyRequest, reply: FastifyReply) => {
    const header = req.headers.authorization
    const provided = header?.startsWith('Bearer ') ? header.slice(7) : ''
    const got = Buffer.from(provided)
    if (got.length !== expectedToken.length || !timingSafeEqual(got, expectedToken)) {
      return reply.status(401).send({
        error: 'UNAUTHORIZED',
        message: 'Order routes need the app token (Authorization: Bearer …).',
      })
    }
  }

  void app.register(cors, {
    origin(origin, cb) {
      if (!origin) return cb(null, true) // native WebView / same-origin tooling
      if (deps.corsOrigins.includes(origin)) return cb(null, true)
      console.warn('[cors] rejected origin:', origin)
      cb(null, false)
    },
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86_400,
  })

  app.addContentTypeParser(
    'application/octet-stream',
    { parseAs: 'buffer' },
    (_req, body, done) => done(null, body),
  )

  app.addHook('onResponse', (req, reply, done) => {
    console.log(
      `${new Date().toISOString()} ${req.method} ${req.url} ${reply.statusCode} ${reply.elapsedTime.toFixed(0)}ms`,
    )
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
    name: 'WickSight API',
    mode: adapter.mode,
    symbol,
    testnetOnly,
  }))

  app.get('/api/health', async () => ({
    ok: true,
    mode: adapter.mode,
    symbol,
    asr: deps.asr,
    keys: deps.keys,
    feed: feed.meta(),
    uptimeSec: Math.round(process.uptime()),
  }))

  app.get('/api/security', async () => ({
    mode: adapter.mode,
    testnetOnly,
    mainnetOptIn: Boolean(deps.allowMainnet),
    keySafety: deps.keySafety ?? null,
    telegram: deps.telegram?.status() ?? null,
  }))

  app.get('/api/telegram', async () => deps.telegram?.status() ?? null)

  app.post('/api/telegram/test', async (_req, reply) => {
    if (!deps.telegram) return reply.status(404).send({ error: 'TELEGRAM_OFF', message: 'Telegram is disabled' })
    if (deps.telegram.mode !== 'mock') {
      return reply.status(401).send({
        error: 'TELEGRAM_REAL',
        message: 'Send /test from the paired Telegram chat; the HTTP demo route is mock-only.',
      })
    }
    const sent = await deps.telegram.sendDemo()
    return { ok: sent }
  })

  app.get('/api/state', async (_req, reply) => {
    const entries = ranked()
    const position = entries[0]?.position ?? null
    const meta = feed.meta()

    if (!position) {
      return reply.status(503).send({
        error: meta.pausedUntil ? 'PAUSED' : 'NO_DATA',
        message: meta.pausedUntil
          ? `Binance paused this IP until ${new Date(meta.pausedUntil).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}.`
          : 'Waiting for the first position snapshot.',
        meta,
      })
    }

    const current = alerts.get()
    const alertMark = current ? feedViews(feed).find((p) => p.symbol === current.symbol)?.markPrice : undefined
    const alert = alertMark ? alerts.check(alertMark, current!.symbol) : current
    reply.header('Cache-Control', 'no-store')
    return {
      position,
      alert,
      eta: entries[0]?.eta ?? null,
      positions: entries.filter((entry) => entry.position.hasPosition || entries.length === 1),
      header: riskHeader(entries),
      meta: {
        testnetOnly,
        mode: position.mode,
        exchange: position.exchange,
        symbol,
        serverTime: Date.now(),
        transport: meta.transport,
        connected: meta.connected,
        stale: meta.stale,
        pausedUntil: meta.pausedUntil,
      },
    }
  })

  app.post<{ Body: { price?: unknown; symbol?: unknown } }>('/api/alert', async (req, reply) => {
    const price = Number(req.body?.price)
    if (!Number.isFinite(price) || price <= 0) {
      return reply.status(400).send({ error: 'BAD_PRICE', message: 'Price must be a positive number' })
    }
    const want = targetSymbol(req.body?.symbol)
    const position = feedViews(feed).find((p) => p.symbol === want) ?? null
    if (!position || position.markPrice <= 0) {
      return reply.status(503).send({ error: 'NO_DATA', message: 'No live mark price yet' })
    }
    if (price < position.markPrice * 0.2 || price > position.markPrice * 5) {
      return reply.status(400).send({ error: 'PRICE_RANGE', message: 'Price is too far from the market' })
    }
    return { alert: alerts.set(price, position.markPrice, position.symbol) }
  })

  app.delete('/api/alert', async () => {
    alerts.clear()
    return { ok: true }
  })

  app.post<{ Body: { symbol?: unknown } | undefined }>('/api/orders/preview', { preHandler: requireAuth }, async (req, reply) => {
    const want = targetSymbol(req.body?.symbol)
    if (!openPosition(want) && feedViews(feed).some((p) => p.hasPosition)) {
      return reply.status(409).send({ error: 'NO_POSITION', message: `No open ${want} position to close` })
    }
    const preview = await adapter.previewCloseHalf(want)
    previews.create(preview)
    return { preview }
  })

  app.post<{ Body: { id?: string } }>(
    '/api/orders/execute',
    { preHandler: requireAuth },
    async (req, reply) => {
      const id = String(req.body?.id ?? '')
      if (!id) return reply.status(400).send({ error: 'NO_PREVIEW', message: 'Missing confirmation token' })

      // The single-use preview token is the replay guard; this only stops
      // two executions from racing each other.
      if (orderInFlight) {
        return reply.status(429).send({ error: 'BUSY', message: 'An order is already being sent' })
      }

      const preview = previews.take(id)
      const before = openPosition(preview.symbol)
      if (!before || before.side !== preview.side) {
        return reply
          .status(409)
          .send({ error: 'SYMBOL_MISMATCH', message: 'Confirmation does not match an open position' })
      }

      orderInFlight = true
      try {
        const fill = await adapter.executeCloseHalf(preview.symbol, preview.qty)
        await feed.refresh()
        const position =
          feedViews(feed).find((p) => p.symbol === preview.symbol) ??
          (await adapter.getPosition(preview.symbol))
        if (!position) throw new ExchangeError('Order filled but the position refresh failed', 502, 'NO_REFRESH')
        const receipt = buildCloseReceipt(before, position, fill)
        return { fill, position, preview, receipt }
      } finally {
        orderInFlight = false
      }
    },
  )

  app.post<{ Body: { text?: string; symbol?: string } }>('/api/intent', async (req, reply) => {
    const text = String(req.body?.text ?? '').trim()
    if (!text) return reply.status(400).send({ error: 'NO_TEXT', message: 'Send { "text": "…" }' })

    return {
      text,
      intent: parseIntent(text, markFor(req.body?.symbol)),
      provider: 'text',
      latencyMs: 0,
    }
  })

  app.post<{ Querystring: { symbol?: string } }>('/api/voice', async (req, reply) => {
    const pcm = req.body as Buffer
    if (!Buffer.isBuffer(pcm) || pcm.length < 3_200) {
      return reply.status(400).send({ error: 'NO_AUDIO', message: 'Send raw 16 kHz PCM16 mono audio' })
    }

    const transcript = await transcribePcm(pcm)
    const markPrice = markFor(req.query?.symbol)

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

  return app
}
