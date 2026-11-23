import { BinanceTestnetAdapter } from './exchange/binance.ts'
import type { ExchangeAdapter, PositionSnapshot } from './exchange/types.ts'
import { applyMark } from './recompute.ts'

export type Transport = 'ws' | 'poll' | 'mock'

export interface FeedMeta {
  transport: Transport
  connected: boolean
  stale: boolean
  pausedUntil: number | null
  lastUpdate: number
}

export interface FeedOptions {
  onMark?: (markPrice: number) => void
}

export interface PositionFeed {
  start(): Promise<void>
  stop(): void
  view(): PositionSnapshot | null
  meta(): FeedMeta
  refresh(): Promise<PositionSnapshot | null>
}

const MIN = 60_000

/**
 * Mock / OKX: no user-data stream, so the feed polls. The interval is local
 * for mock (1 s) and slow for a real exchange (12 s), and the adapter's own
 * pause gate stops calls entirely during a ban.
 */
class PollingFeed implements PositionFeed {
  private position: PositionSnapshot | null = null
  private lastOk = 0
  private timer: ReturnType<typeof setInterval> | null = null
  private busy = false

  constructor(
    private readonly adapter: ExchangeAdapter,
    private readonly symbol: string,
    private readonly intervalMs: number,
    private readonly transport: Transport,
    private readonly options: FeedOptions = {},
  ) {}

  async start(): Promise<void> {
    await this.refresh()
    this.timer = setInterval(() => void this.refresh(), this.intervalMs)
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }

  view(): PositionSnapshot | null {
    return this.position
  }

  meta(): FeedMeta {
    const adapterPause = this.adapter.getPausedUntil?.() ?? 0
    return {
      transport: this.transport,
      connected: true,
      stale: !this.position || Date.now() - this.lastOk > Math.max(15_000, this.intervalMs * 3),
      pausedUntil: adapterPause > Date.now() ? adapterPause : null,
      lastUpdate: this.lastOk,
    }
  }

  async refresh(): Promise<PositionSnapshot | null> {
    if (this.busy) return this.position
    this.busy = true
    try {
      this.position = await this.adapter.getPosition(this.symbol)
      this.lastOk = Date.now()
      this.options.onMark?.(this.position.markPrice)
      return this.position
    } catch {
      return this.position
    } finally {
      this.busy = false
    }
  }
}

/**
 * Binance testnet live feed:
 *  - mark price via `<symbol>@markPrice@1s` (no request weight)
 *  - positions/fills via the user data stream (`listenKey`)
 *  - REST only for the initial snapshot, order calls, and a slow fallback poll
 *    when the mark socket is down
 *  - during a -1003 ban every REST call is suppressed until the ban expires
 */
class BinanceFeed implements PositionFeed {
  private position: PositionSnapshot | null = null
  private lastMarkAt = 0
  private lastSnapshotAt = 0
  private lastSnapshotOk = 0

  private markSocket: WebSocket | null = null
  private userSocket: WebSocket | null = null
  private listenKey: string | null = null

  private markRetry = 0
  private userRetry = 0
  private reconnectMarkTimer: ReturnType<typeof setTimeout> | null = null
  private reconnectUserTimer: ReturnType<typeof setTimeout> | null = null
  private keepAliveTimer: ReturnType<typeof setInterval> | null = null
  private supervisorTimer: ReturnType<typeof setInterval> | null = null
  private refreshTimer: ReturnType<typeof setTimeout> | null = null

  private refreshBusy = false
  private refreshQueued = false
  private nextFallbackPollAt = 0
  private closed = false

  constructor(
    private readonly adapter: BinanceTestnetAdapter,
    private readonly symbol: string,
    private readonly options: FeedOptions = {},
  ) {}

  async start(): Promise<void> {
    await this.refresh().catch(() => null)
    this.openMarkSocket()
    void this.openUserSocket()
    this.keepAliveTimer = setInterval(() => void this.keepAlive(), 30 * MIN)
    // Fallback: only when the mark socket is down, at most every 12 s.
    this.supervisorTimer = setInterval(() => void this.supervise(), 5_000)
  }

  stop(): void {
    this.closed = true
    for (const timer of [
      this.reconnectMarkTimer,
      this.reconnectUserTimer,
      this.refreshTimer,
    ]) {
      if (timer) clearTimeout(timer)
    }
    for (const timer of [this.keepAliveTimer, this.supervisorTimer]) {
      if (timer) clearInterval(timer)
    }
    this.markSocket?.close()
    this.userSocket?.close()
    this.markSocket = null
    this.userSocket = null
  }

  view(): PositionSnapshot | null {
    return this.position
  }

  meta(): FeedMeta {
    const pausedUntil = this.adapter.getPausedUntil()
    const markOpen = this.markSocket?.readyState === WebSocket.OPEN
    const userOpen = this.userSocket?.readyState === WebSocket.OPEN
    const noMark = this.lastMarkAt === 0 || Date.now() - this.lastMarkAt > 15_000
    const noSnapshot = this.lastSnapshotOk === 0 || Date.now() - this.lastSnapshotOk > 30_000
    return {
      transport: 'ws',
      connected: markOpen || userOpen,
      stale: !this.position || (noMark && noSnapshot),
      pausedUntil: pausedUntil > Date.now() ? pausedUntil : null,
      lastUpdate: Math.max(this.lastMarkAt, this.lastSnapshotAt),
    }
  }

  async refresh(): Promise<PositionSnapshot | null> {
    if (this.refreshBusy) {
      this.refreshQueued = true
      return this.position
    }
    this.refreshBusy = true
    try {
      this.position = await this.adapter.getPosition(this.symbol)
      this.lastSnapshotAt = Date.now()
      this.lastSnapshotOk = Date.now()
      this.options.onMark?.(this.position.markPrice)
      return this.position
    } catch {
      return this.position
    } finally {
      this.refreshBusy = false
      if (this.refreshQueued) {
        this.refreshQueued = false
        void this.refresh()
      }
    }
  }

  private scheduleRefresh(delayMs = 800): void {
    if (this.closed) return
    if (this.refreshTimer) clearTimeout(this.refreshTimer)
    this.refreshTimer = setTimeout(() => {
      this.refreshTimer = null
      void this.refresh()
    }, delayMs)
  }

  private openMarkSocket(): void {
    if (this.closed) return
    const ws = new WebSocket(this.adapter.markPriceStreamUrl(this.symbol))
    this.markSocket = ws

    ws.onopen = () => {
      this.markRetry = 0
      console.log('[feed] mark socket open')
    }
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(String(event.data)) as { e?: string; s?: string; p?: string }
        if (data.e !== 'markPriceUpdate' || data.s !== this.symbol || !data.p) return
        const mark = Number(data.p)
        if (!Number.isFinite(mark) || mark <= 0) return
        this.lastMarkAt = Date.now()
        if (this.position) this.position = applyMark(this.position, mark)
        this.options.onMark?.(mark)
      } catch {
        // A malformed frame is not worth tearing the socket down for.
      }
    }
    ws.onerror = () => {
      // onclose follows; the reconnect handler is shared.
    }
    ws.onclose = () => {
      if (this.markSocket === ws) this.markSocket = null
      if (this.closed) return
      this.scheduleMarkReconnect()
    }
  }

  private scheduleMarkReconnect(): void {
    if (this.reconnectMarkTimer || this.closed) return
    const delay = Math.min(30_000, 1_000 * 2 ** this.markRetry) + Math.random() * 500
    this.markRetry = Math.min(this.markRetry + 1, 5)
    console.warn(`[feed] mark socket closed, retrying in ${Math.round(delay)}ms`)
    this.reconnectMarkTimer = setTimeout(() => {
      this.reconnectMarkTimer = null
      this.openMarkSocket()
    }, delay)
  }

  private async openUserSocket(): Promise<void> {
    if (this.closed) return
    if (this.adapter.getPausedUntil() > Date.now()) {
      this.scheduleUserReconnect(this.adapter.getPausedUntil() - Date.now() + 1_000)
      return
    }

    try {
      this.listenKey = await this.adapter.createListenKey()
    } catch (err) {
      const code = (err as { code?: string }).code
      const delay = code === 'PAUSED' ? Math.max(5_000, this.adapter.getPausedUntil() - Date.now() + 1_000) : 5_000
      this.scheduleUserReconnect(delay)
      return
    }

    const ws = new WebSocket(this.adapter.userStreamUrl(this.listenKey))
    this.userSocket = ws

    ws.onopen = () => {
      this.userRetry = 0
      console.log('[feed] user socket open')
    }
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(String(event.data)) as { e?: string }
        if (!data.e) return
        if (data.e === 'listenKeyExpired') {
          console.warn('[feed] listenKey expired, recreating')
          ws.close()
          return
        }
        if (data.e === 'ACCOUNT_UPDATE' || data.e === 'ORDER_TRADE_UPDATE' || data.e === 'ACCOUNT_CONFIG_UPDATE') {
          this.scheduleRefresh(600)
        }
      } catch {
        // ignore malformed frames
      }
    }
    ws.onerror = () => {
      // onclose follows
    }
    ws.onclose = () => {
      if (this.userSocket === ws) this.userSocket = null
      if (this.closed) return
      this.scheduleUserReconnect()
    }
  }

  private scheduleUserReconnect(delayMs?: number): void {
    if (this.reconnectUserTimer || this.closed) return
    const delay =
      delayMs ?? Math.min(60_000, 2_000 * 2 ** this.userRetry) + Math.random() * 1_000
    this.userRetry = Math.min(this.userRetry + 1, 5)
    console.warn(`[feed] user socket retry in ${Math.round(delay)}ms`)
    this.reconnectUserTimer = setTimeout(() => {
      this.reconnectUserTimer = null
      void this.openUserSocket()
    }, delay)
  }

  private async keepAlive(): Promise<void> {
    if (this.closed || !this.listenKey) return
    if (this.adapter.getPausedUntil() > Date.now()) return
    try {
      await this.adapter.keepAliveListenKey()
    } catch (err) {
      console.warn('[feed] listenKey keepalive failed:', (err as Error).message)
    }
  }

  /** Slow REST fallback, only while the mark socket is not delivering. */
  private async supervise(): Promise<void> {
    if (this.closed) return
    if (this.adapter.getPausedUntil() > Date.now()) return

    const markOpen = this.markSocket?.readyState === WebSocket.OPEN
    const markFresh = this.lastMarkAt > 0 && Date.now() - this.lastMarkAt < 12_000
    // A missing snapshot (boot during a ban) must be retried even when the
    // mark socket is healthy.
    if (markOpen && markFresh && this.position) return
    if (Date.now() < this.nextFallbackPollAt) return

    this.nextFallbackPollAt = Date.now() + 12_000
    await this.refresh()
  }
}

export function createFeed(adapter: ExchangeAdapter, symbol: string, options: FeedOptions = {}): PositionFeed {
  if (adapter instanceof BinanceTestnetAdapter) {
    return new BinanceFeed(adapter, symbol, options)
  }
  if (adapter.mode === 'mock') {
    return new PollingFeed(adapter, symbol, 1_000, 'mock', options)
  }
  return new PollingFeed(adapter, symbol, 12_000, 'poll', options)
}
