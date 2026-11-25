import { TextContainerProperty } from '@evenrealities/even_hub_sdk'
import type { LiqEtaView, PositionView } from '../shared/types'
import { fmtPct, fmtPrice, fmtQty, fmtSigned, formatEta, modeLabel } from './format'
import type { OrderPreviewView } from '../shared/types'

export const W = 576
export const H = 288

export interface PageSpec {
  texts: TextContainerProperty[]
}

function text(
  id: number,
  name: string,
  y: number,
  content: string,
  opts: { h?: number; brightness?: number; z?: number; capture?: boolean } = {},
): TextContainerProperty {
  return new TextContainerProperty({
    xPosition: 28,
    yPosition: y,
    width: W - 56,
    height: opts.h ?? 30,
    borderWidth: 0,
    paddingLength: 0,
    containerID: id,
    containerName: name,
    content,
    textColor: opts.brightness ?? 4,
    isEventCapture: opts.capture ? 1 : 0,
    zOrderIndex: opts.z ?? id,
  })
}

function captureLayer(active: boolean): TextContainerProperty {
  return new TextContainerProperty({
    xPosition: 0,
    yPosition: 0,
    width: W,
    height: H,
    borderWidth: 0,
    paddingLength: 0,
    containerID: 1,
    containerName: 'capture',
    content: ' ',
    textColor: 0,
    isEventCapture: active ? 1 : 0,
    zOrderIndex: 0,
  })
}

const HINT_Y = 242

interface PositionTexts {
  status: string
  main: string
  hint: string
  hintBrightness?: number
}

export interface HudContext {
  /** "3 positions · riskiest SOL ~6m" from the server. */
  header?: string
  /** 1-based selection among open positions. */
  index?: number
  count?: number
}

function clock(ts: number): string {
  return new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

export function positionTexts(
  position: PositionView | null,
  alertPrice?: number | null,
  offline = false,
  pausedUntil?: number | null,
  stale = false,
  eta: LiqEtaView | null = null,
  hud: HudContext = {},
): PositionTexts {
  if (!position) {
    if (pausedUntil) {
      return {
        status: '○ RATE LIMITED',
        main: `Binance paused this IP\n\nuntil ${clock(pausedUntil)}\n\nCached data only`,
        hint: 'Tap to retry',
      }
    }
    return {
      status: offline ? '● OFFLINE' : '● CONNECTING',
      main: offline ? "Can't reach server\n\nStart the API\n\nTap to retry" : 'WickSight\n\nConnecting',
      hint: offline ? 'npm run dev' : '',
    }
  }

  const label = modeLabel(position.mode)
  const multi = (hud.count ?? 1) > 1
  const count = multi && hud.index ? ` · ${hud.index}/${hud.count}` : ''
  const status = pausedUntil
    ? `○ RATE LIMITED · ${clock(pausedUntil)}`
    : offline
      ? '○ OFFLINE'
      : stale
        ? `○ ${label} · STALE`
        : alertPrice
          ? `● ${label} · ALERT ${fmtPrice(alertPrice, 0)}${count}`
          : multi && hud.header
            ? `● ${hud.header}`
            : `● ${label} · ${position.leverage}x`

  if (!position.hasPosition || !position.side) {
    return {
      status: `${status}`,
      main: `No open position\n\n${position.symbol}\n\nOpen one on testnet`,
      hint: 'Hold: speak · 2x exit',
    }
  }

  const pnl = `${fmtSigned(position.unrealizedPnl)} USDT`
  const roe = fmtPct(position.roePct)
  const liq = position.liqPrice
    ? `Liq ${fmtPrice(position.liqPrice, position.priceDecimals)}`
    : 'Liq n/a'
  const away = position.distanceToLiqPct !== null ? ` · ${position.distanceToLiqPct.toFixed(1)}% away` : ''
  const etaLine = eta
    ? `LIQ IN ${formatEta(eta.minutes)} at this pace · buffer ${eta.bufferPct.toFixed(1)}%${count}`
    : null

  return {
    status,
    main: [
      `${position.symbol} ${position.side} ${fmtQty(position.qty, position.qtyDecimals)} · ${position.leverage}x`,
      `PnL ${pnl} · ROE ${roe}`,
      `${liq}${away}`,
    ].join('\n\n'),
    hint: etaLine ?? (multi ? `Swipe/tap: cycle${count}` : 'Hold: speak · 2x exit'),
    hintBrightness: eta && eta.minutes <= 5 ? 4 : 2,
  }
}

export function positionPage(
  position: PositionView | null,
  alertPrice?: number | null,
  offline = false,
  pausedUntil?: number | null,
  stale = false,
  eta: LiqEtaView | null = null,
  hud: HudContext = {},
): PageSpec {
  const t = positionTexts(position, alertPrice, offline, pausedUntil, stale, eta, hud)
  return {
    texts: [
      captureLayer(true),
      text(2, 'status', 4, t.status, { brightness: 2 }),
      text(3, 'main', 64, t.main, { h: 176 }),
      text(4, 'hint', HINT_Y, t.hint, { brightness: t.hintBrightness ?? 2, h: 32 }),
    ],
  }
}

export function bootPage(): PageSpec {
  return {
    texts: [
      captureLayer(true),
      text(2, 'status', 4, '● CONNECTING', { brightness: 2 }),
      text(3, 'main', 64, 'WickSight\n\nConnecting to testnet', { h: 176 }),
      text(4, 'hint', HINT_Y, 'One position. One screen.', { brightness: 2 }),
    ],
  }
}

export function listeningPage(): PageSpec {
  return {
    texts: [
      captureLayer(true),
      text(2, 'status', 4, '● MIC ON', { brightness: 2 }),
      text(3, 'main', 56, 'Listening\n\nSpeak now', { h: 176 }),
      text(4, 'hint', HINT_Y, 'alert 62,000 · close half', { brightness: 2 }),
    ],
  }
}

export function thinkingPage(label = 'Transcribing'): PageSpec {
  return {
    texts: [
      captureLayer(true),
      text(2, 'status', 4, '● MIC OFF', { brightness: 2 }),
      text(3, 'main', 64, `${label}\n\nOne moment`, { h: 176 }),
      text(4, 'hint', HINT_Y, '', { brightness: 2 }),
    ],
  }
}

export function confirmPage(preview: OrderPreviewView, selected: 'no' | 'yes'): PageSpec {
  const action = preview.side === 'LONG' ? 'sell' : 'buy'
  const qty = fmtQty(preview.qty, preview.qtyDecimals)
  const open = fmtQty(preview.qty + preview.remaining, preview.qtyDecimals)

  const row = (id: number, y: number, z: number, label: string, active: boolean) =>
    new TextContainerProperty({
      xPosition: 28,
      yPosition: y,
      width: W - 56,
      height: 50,
      borderWidth: active ? 1 : 0,
      borderColor: active ? 8 : 0,
      borderRadius: 4,
      paddingLength: 8,
      containerID: id,
      containerName: id === 5 ? 'row-no' : 'row-yes',
      content: label,
      textColor: active ? 4 : 2,
      isEventCapture: 0,
      zOrderIndex: z,
    })

  return {
    texts: [
      captureLayer(true),
      text(2, 'status', 4, '● CONFIRM', { brightness: 2, z: 1 }),
      text(3, 'main', 34, 'Close half?', { h: 34, z: 2 }),
      text(4, 'detail', 72, `${preview.symbol} ${preview.side} · ${open} open`, { brightness: 3, z: 3 }),
      row(5, 124, 4, `No, keep ${open}`, selected === 'no'),
      row(6, 182, 5, `Yes, ${action} ${qty}`, selected === 'yes'),
      text(7, 'hint', 242, 'Swipe to change · tap to confirm', { brightness: 2, z: 6 }),
    ],
  }
}

export function resultPage(status: string, main: string, hint: string, brightness = 4): PageSpec {
  return {
    texts: [
      captureLayer(true),
      text(2, 'status', 4, status, { brightness: 2 }),
      text(3, 'main', 56, main, { h: 184, brightness }),
      text(4, 'hint', HINT_Y, hint, { brightness: 2 }),
    ],
  }
}

export function alertHitPage(markPrice: number, distancePct: number | null, symbol: string): PageSpec {
  return {
    texts: [
      captureLayer(true),
      text(2, 'status', 4, '● ALERT HIT', { brightness: 2 }),
      text(3, 'main', 48, `${symbol}\n\n${fmtPrice(markPrice)}\n\n${distancePct !== null ? `Liq ${distancePct.toFixed(1)}% away` : 'Check position'}`, {
        h: 190,
      }),
      text(4, 'hint', HINT_Y, 'Tap to dismiss', { brightness: 2 }),
    ],
  }
}
