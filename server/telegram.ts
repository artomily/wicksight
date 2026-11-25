import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { PositionSnapshot } from './exchange/types.ts'
import type { LiqEta } from './eta.ts'
import type { AlertSnapshot } from './store.ts'

export interface TelegramThresholds {
  /** Time-to-liquidation alert, in minutes. */
  minutes: number
  /** Buffer-to-liquidation alert, in percent of mark price. */
  bufferPct: number
  /** Minimum gap between repeated alerts for the same condition. */
  cooldownMs: number
}

export interface TelegramMessage {
  at: number
  kind: 'eta' | 'buffer' | 'price' | 'test' | 'pair'
  text: string
}

export interface TelegramStatus {
  mode: 'telegram' | 'mock' | 'off'
  paired: boolean
  chatIdMasked: string | null
  thresholds: TelegramThresholds
  recent: TelegramMessage[]
}

export interface TelegramUpdate {
  update_id: number
  message?: {
    chat?: { id?: number | string }
    text?: string
  }
}

export interface TelegramTransport {
  sendMessage(chatId: string, text: string): Promise<void>
  getUpdates(offset: number): Promise<TelegramUpdate[]>
}

export class HttpTelegramTransport implements TelegramTransport {
  constructor(private readonly token: string) {}

  async sendMessage(chatId: string, text: string): Promise<void> {
    const res = await fetch(`https://api.telegram.org/bot${this.token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
    })
    if (!res.ok) {
      // Never include the URL: it contains the bot token.
      throw new Error(`Telegram sendMessage failed (${res.status})`)
    }
  }

  async getUpdates(offset: number): Promise<TelegramUpdate[]> {
    const res = await fetch(
      `https://api.telegram.org/bot${this.token}/getUpdates?timeout=0&allowed_updates=%5B%22message%22%5D&offset=${offset}`,
    )
    if (!res.ok) throw new Error(`Telegram getUpdates failed (${res.status})`)
    const body = (await res.json()) as { ok?: boolean; result?: TelegramUpdate[] }
    return body.ok && Array.isArray(body.result) ? body.result : []
  }
}

interface BotOptions {
  token?: string
  chatFile: string
  thresholds: TelegramThresholds
  transport?: TelegramTransport
  now?: () => number
  disabled?: boolean
}

/**
 * Telegram delivery plus /start pairing. The token stays in the environment;
 * the paired chat id is the only thing written to disk (a local, gitignored
 * file). In mock mode the bot keeps an in-memory outbox so the demo works
 * without a real token.
 */
export class TelegramBot {
  readonly thresholds: TelegramThresholds
  private readonly token: string
  private readonly chatFile: string
  private readonly transport: TelegramTransport | null
  private readonly now: () => number
  private readonly disabled: boolean
  private chatId: string | null = null
  private updateOffset = 0
  private polling = false
  private timer: ReturnType<typeof setInterval> | null = null
  private recent: TelegramMessage[] = []
  private lastSentAt = 0

  constructor(options: BotOptions) {
    this.token = (options.token ?? '').trim()
    this.chatFile = options.chatFile
    this.thresholds = options.thresholds
    this.transport = options.transport ?? (this.token ? new HttpTelegramTransport(this.token) : null)
    this.now = options.now ?? Date.now
    this.disabled = Boolean(options.disabled)
  }

  get mode(): 'telegram' | 'mock' | 'off' {
    if (this.disabled) return 'off'
    return this.token ? 'telegram' : 'mock'
  }

  async start(): Promise<void> {
    if (this.mode === 'off') return
    await this.loadChat()
    if (this.mode === 'telegram') {
      void this.poll()
      this.timer = setInterval(() => void this.poll(), 3_000)
      this.timer.unref?.()
    }
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }

  status(): TelegramStatus {
    return {
      mode: this.mode,
      paired: Boolean(this.chatId),
      chatIdMasked: this.chatId ? maskChat(this.chatId) : null,
      thresholds: this.thresholds,
      recent: this.recent.slice(-10),
    }
  }

  /** Send a message to the paired chat. Mock mode records it instead. */
  async send(text: string, kind: TelegramMessage['kind'] = 'test'): Promise<boolean> {
    if (this.mode === 'off') return false
    const at = this.now()
    this.recent.push({ at, kind, text })
    if (this.recent.length > 20) this.recent = this.recent.slice(-20)
    if (this.mode === 'mock') {
      console.log(`[telegram:mock] ${text.replace(/\n/g, ' | ')}`)
      return true
    }
    if (!this.chatId || !this.transport) return false
    // A global floor on top of the per-condition cooldown.
    if (at - this.lastSentAt < 2_000) return false
    try {
      await this.transport.sendMessage(this.chatId, text)
      this.lastSentAt = this.now()
      return true
    } catch (err) {
      console.warn('[telegram]', (err as Error).message)
      return false
    }
  }

  async sendDemo(): Promise<boolean> {
    return this.send(sampleMessage(this.thresholds), 'test')
  }

  async pair(chatId: string): Promise<void> {
    this.chatId = chatId
    await mkdir(dirname(this.chatFile), { recursive: true })
    await writeFile(this.chatFile, JSON.stringify({ chatId, pairedAt: new Date().toISOString() }), 'utf8')
  }

  async unpair(): Promise<void> {
    this.chatId = null
    await mkdir(dirname(this.chatFile), { recursive: true })
    await writeFile(this.chatFile, JSON.stringify({ chatId: null }), 'utf8')
  }

  private async loadChat(): Promise<void> {
    try {
      const raw = JSON.parse(await readFile(this.chatFile, 'utf8')) as { chatId?: string | null }
      this.chatId = typeof raw.chatId === 'string' && raw.chatId ? raw.chatId : null
    } catch {
      this.chatId = null
    }
  }

  private async poll(): Promise<void> {
    if (this.polling || this.mode !== 'telegram' || !this.transport) return
    this.polling = true
    try {
      const updates = await this.transport.getUpdates(this.updateOffset)
      for (const update of updates) {
        this.updateOffset = Math.max(this.updateOffset, update.update_id + 1)
        const chatId = update.message?.chat?.id
        const text = update.message?.text?.trim() ?? ''
        if (chatId === undefined || !text) continue
        if (text === '/start' || text.startsWith('/start ')) {
          await this.pair(String(chatId))
          await this.send(
            'WickSight paired.\n\nBackground alerts are now sent here.\nCommands: /status, /stop, /test\n\nThis chat only receives alerts. No order is placed from Telegram.',
            'pair',
          )
        } else if (text === '/stop') {
          await this.send('WickSight alerts stopped for this chat.', 'pair')
          await this.unpair()
        } else if (text === '/status') {
          const s = this.status()
          await this.send(
            `WickSight ${s.mode} · ${s.paired ? 'paired' : 'not paired'}\nETA < ${s.thresholds.minutes}m · buffer < ${s.thresholds.bufferPct}%`,
            'pair',
          )
        } else if (text === '/test') {
          await this.send(sampleMessage(this.thresholds), 'test')
        }
      }
    } catch (err) {
      // Telegram being unreachable must not take the API down.
      console.warn('[telegram] poll:', (err as Error).message)
    } finally {
      this.polling = false
    }
  }
}

export interface RiskWatchEntry {
  position: PositionSnapshot
  eta: LiqEta | null
}

/**
 * Turns risk thresholds into Telegram messages. Only the transition into a
 * danger zone sends; repeated ticks are deduped, and a per-condition cooldown
 * keeps an oscillating tape from spamming the chat.
 */
export class RiskAlerter {
  private readonly active = new Set<string>()
  private readonly lastSent = new Map<string, number>()

  constructor(
    private readonly send: (text: string, kind: TelegramMessage['kind']) => Promise<unknown> | unknown,
    private readonly thresholds: TelegramThresholds,
    private readonly deepLink: (symbol: string) => string,
    private readonly now: () => number = Date.now,
  ) {}

  evaluate(entries: readonly RiskWatchEntry[]): void {
    const seen = new Set<string>()
    for (const entry of entries) {
      const p = entry.position
      if (!p.hasPosition) continue
      seen.add(`eta:${p.symbol}`)
      seen.add(`buffer:${p.symbol}`)
      if (entry.eta) {
        this.transition(`eta:${p.symbol}`, entry.eta.minutes <= this.thresholds.minutes, () =>
          this.etaMessage(p, entry.eta!),
        )
      } else {
        this.active.delete(`eta:${p.symbol}`)
      }
      if (p.distanceToLiqPct !== null) {
        this.transition(`buffer:${p.symbol}`, p.distanceToLiqPct <= this.thresholds.bufferPct, () =>
          this.bufferMessage(p),
        )
      }
    }
    // A closed position must not suppress the next alert when it reopens.
    for (const key of [...this.active]) {
      if ((key.startsWith('eta:') || key.startsWith('buffer:')) && !seen.has(key)) {
        this.active.delete(key)
      }
    }
  }

  priceAlert(alert: AlertSnapshot): void {
    const key = `price:${alert.symbol}:${alert.createdAt}`
    if (this.active.has(key)) return
    this.active.add(key)
    if (!this.cooldownPassed(key)) return
    void this.send(
      [
        '⚡ WickSight price alert',
        '',
        `${alert.symbol} ${alert.direction === 'above' ? '≥' : '≤'} ${money(alert.price)}`,
        '',
        `Close half on glasses: ${this.deepLink(alert.symbol)}`,
        'No order is sent from this message.',
      ].join('\n'),
      'price',
    )
  }

  private transition(key: string, entered: boolean, message: () => string): void {
    if (!entered) {
      this.active.delete(key)
      return
    }
    if (this.active.has(key)) return
    this.active.add(key)
    if (!this.cooldownPassed(key)) return
    void this.send(message(), key.startsWith('eta:') ? 'eta' : 'buffer')
  }

  private cooldownPassed(key: string): boolean {
    const now = this.now()
    const last = this.lastSent.get(key) ?? 0
    if (now - last < this.thresholds.cooldownMs) return false
    this.lastSent.set(key, now)
    return true
  }

  private etaMessage(p: PositionSnapshot, eta: LiqEta): string {
    return [
      '⚠ WickSight: liquidation ETA',
      '',
      `${p.symbol} ${p.side ?? ''} ${qty(p.qty, p.qtyDecimals)} · ${p.leverage}x`,
      `Liq ${money(p.liqPrice)} · buffer ${eta.bufferPct.toFixed(1)}%`,
      `LIQ IN ~${minutes(eta.minutes)} at this pace`,
      '',
      `Close half on glasses: ${this.deepLink(p.symbol)}`,
      'No order is sent from this message.',
    ].join('\n')
  }

  private bufferMessage(p: PositionSnapshot): string {
    return [
      '⚠ WickSight: buffer alert',
      '',
      `${p.symbol} ${p.side ?? ''} ${qty(p.qty, p.qtyDecimals)} · ${p.leverage}x`,
      `${p.distanceToLiqPct?.toFixed(1)}% from liquidation`,
      `Liq ${money(p.liqPrice)} · mark ${money(p.markPrice)}`,
      '',
      `Close half on glasses: ${this.deepLink(p.symbol)}`,
      'No order is sent from this message.',
    ].join('\n')
  }
}

function sampleMessage(thresholds: TelegramThresholds): string {
  return [
    '⚠ WickSight mock alert',
    '',
    'SOLUSDT LONG 4 · 25x',
    'Liq 146.85 · buffer 3.4%',
    `LIQ IN ~6m at this pace (threshold ${thresholds.minutes}m)`,
    '',
    'Close half on glasses: wicksight://close-half?symbol=SOLUSDT',
    'Mock mode: no Telegram token is configured and no order was sent.',
  ].join('\n')
}

function maskChat(chatId: string): string {
  return chatId.length <= 4 ? '••••' : `••••${chatId.slice(-4)}`
}

function money(value: number | null): string {
  if (value === null || !Number.isFinite(value) || value <= 0) return '—'
  return value >= 1000 ? value.toLocaleString('en-US', { maximumFractionDigits: 2 }) : value.toFixed(2)
}

function qty(value: number, decimals: number): string {
  return value.toFixed(decimals).replace(/\.?0+$/, '')
}

function minutes(value: number): string {
  if (value < 1) return '<1m'
  if (value < 60) return `${Math.round(value)}m`
  return `${(value / 60).toFixed(1)}h`
}
