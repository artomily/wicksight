import {
  CreateStartUpPageContainer,
  OsEventTypeList,
  RebuildPageContainer,
  TextContainerUpgrade,
  TextContainerProperty,
  waitForEvenAppBridge,
  type EvenAppBridge,
} from '@evenrealities/even_hub_sdk'
import type { OrderPreviewView, StateResponse, VoiceResponse } from '../shared/types'
import { ApiError, api } from './api'
import { VoiceRecorder } from './audio'
import { compact, ellipsis, fmtPrice, fmtQty } from './format'
import * as ui from './ui'
import { mountHostPanel } from './hostPanel'

mountHostPanel()

const bridge: EvenAppBridge = await waitForEvenAppBridge()

type Screen =
  | { kind: 'boot' }
  | { kind: 'position' }
  | { kind: 'listening' }
  | { kind: 'thinking'; message: string }
  | { kind: 'confirm'; preview: OrderPreviewView; selected: 'no' | 'yes' }
  | { kind: 'result'; status: string; main: string; hint: string; brightness?: number }
  | { kind: 'alertHit' }

let screen: Screen = { kind: 'boot' }
let lastState: StateResponse | null = null
let offline = false
let pausedUntil: number | null = null
let stale = false
let created = false
let lastTexts = new Map<number, string>()
let lastPageWriteAt = 0

let rendering: Promise<void> = Promise.resolve()
let returnTimer: ReturnType<typeof setTimeout> | null = null
let pollTimer: ReturnType<typeof setInterval> | null = null

const mic = {
  active: false,
  ready: false,
  stopRequested: false,
  recorder: null as VoiceRecorder | null,
  watchdog: null as ReturnType<typeof setTimeout> | null,
}

function clearReturn() {
  if (returnTimer) {
    clearTimeout(returnTimer)
    returnTimer = null
  }
}

function scheduleReturn(ms: number) {
  clearReturn()
  returnTimer = setTimeout(() => {
    returnTimer = null
    void show({ kind: 'position' })
  }, ms)
}

/** Serialize every bridge write so fast taps can't interleave rebuilds. */
function enqueue(task: () => Promise<void>): Promise<void> {
  rendering = rendering.then(task).catch((err) => {
    console.error('[render]', (err as Error).message)
  })
  return rendering
}

async function writePage(spec: ui.PageSpec) {
  const total = spec.texts.length
  const rebuild = () =>
    bridge.rebuildPageContainer(
      new RebuildPageContainer({ containerTotalNum: total, textObject: spec.texts }),
    )

  if (!created) {
    const result = await bridge.createStartUpPageContainer(
      new CreateStartUpPageContainer({ containerTotalNum: total, textObject: spec.texts }),
    )
    if (result !== 0) {
      // A WebView reload can leave the native page in place: fall back to a
      // rebuild instead of showing a blank screen.
      console.warn('[ui] create failed, rebuilding instead:', result)
      if (!(await rebuild())) console.error('[ui] rebuild after failed create also failed')
    }
    created = true
    console.log('APP_READY')
  } else if (!(await rebuild())) {
    console.error('[ui] rebuildPageContainer failed')
  }

  lastTexts = new Map(spec.texts.map((t) => [t.containerID ?? 0, t.content ?? '']))
  lastPageWriteAt = Date.now()
}

async function upgradeText(container: TextContainerProperty): Promise<void> {
  const id = container.containerID ?? 0
  const content = container.content ?? ''
  if (lastTexts.get(id) === content) return
  await bridge.textContainerUpgrade(
    new TextContainerUpgrade({
      containerID: id,
      containerName: container.containerName,
      content,
    }),
  )
  lastTexts.set(id, content)
}

function alertPrice(): number | null {
  const alert = lastState?.alert
  return alert && !alert.triggeredAt ? alert.price : null
}

function specFor(next: Screen): ui.PageSpec {
  switch (next.kind) {
    case 'boot':
      return ui.bootPage()
    case 'position':
      return ui.positionPage(lastState?.position ?? null, alertPrice(), offline, pausedUntil, stale, lastState?.eta ?? null)
    case 'listening':
      return ui.listeningPage()
    case 'thinking':
      return ui.thinkingPage(next.message)
    case 'confirm':
      return ui.confirmPage(next.preview, next.selected)
    case 'result':
      return ui.resultPage(next.status, next.main, next.hint, next.brightness)
    case 'alertHit': {
      const p = lastState?.position
      return ui.alertHitPage(p?.markPrice ?? 0, p?.distanceToLiqPct ?? null, p?.symbol ?? '')
    }
  }
}

async function show(next: Screen): Promise<void> {
  clearReturn()
  const previous = screen
  screen = next
  await enqueue(async () => {
    if (next.kind === 'position' && previous.kind === 'position' && created) {
      const spec = ui.positionPage(lastState?.position ?? null, alertPrice(), offline, pausedUntil, stale, lastState?.eta ?? null)
      for (const container of spec.texts) await upgradeText(container)
      return
    }
    await writePage(specFor(next))
  })
}

async function patchPosition(): Promise<void> {
  await enqueue(async () => {
    if (!created) return
    if (screen.kind === 'alertHit') {
      const p = lastState?.position
      const spec = ui.alertHitPage(p?.markPrice ?? 0, p?.distanceToLiqPct ?? null, p?.symbol ?? '')
      for (const container of spec.texts) await upgradeText(container)
      return
    }
    if (screen.kind !== 'position') return
    const spec = ui.positionPage(lastState?.position ?? null, alertPrice(), offline, pausedUntil, stale, lastState?.eta ?? null)
    for (const container of spec.texts) await upgradeText(container)
  })
}

function showResult(status: string, main: string, hint: string, ms = 4000, brightness = 4) {
  void show({ kind: 'result', status, main, hint, brightness })
  scheduleReturn(ms)
}

/* ------------------------------- polling ------------------------------- */

let polling = false
let pollCooldownUntil = 0

async function pollNow(): Promise<void> {
  if (polling || Date.now() < pollCooldownUntil) return
  polling = true
  try {
    const state = await api.state()
    lastState = state
    offline = false
    pausedUntil = state.meta.pausedUntil ?? null
    stale = state.meta.stale === true

    if (screen.kind === 'boot') {
      await show({ kind: 'position' })
    } else if (screen.kind === 'position') {
      await patchPosition()
    } else if (screen.kind === 'alertHit') {
      await patchPosition()
    }

    // Never steal the screen from a confirmation, a recording, or an
    // in-flight order. The alert shows as soon as the user is back on the HUD.
    const idleScreen = screen.kind === 'position' || screen.kind === 'result'
    if (state.alert?.triggeredAt && idleScreen) {
      await show({ kind: 'alertHit' })
    }
  } catch (err) {
    offline = true
    if (err instanceof ApiError) {
      if (err.code === 'PAUSED' || err.code === 'NO_DATA') {
        pausedUntil = err.pausedUntil ?? pausedUntil
        pollCooldownUntil = Date.now() + 10_000
      }
    }
    // Exchange rate limits should not turn into a request storm.
    if (/banned|too many|rate.?limit|429/i.test((err as Error).message)) {
      pollCooldownUntil = Date.now() + 15_000
    }
    if (screen.kind === 'boot') {
      await show({ kind: 'position' })
    } else if (screen.kind === 'position') {
      await patchPosition()
    }
  } finally {
    polling = false
  }
}

function startPolling() {
  if (pollTimer) return
  void pollNow()
  pollTimer = setInterval(() => void pollNow(), 2000)
}

/* -------------------------------- voice -------------------------------- */

async function startListening(): Promise<void> {
  if (mic.active || screen.kind !== 'position') return
  mic.active = true
  mic.ready = false
  mic.stopRequested = false

  const recorder = new VoiceRecorder(bridge)
  mic.recorder = recorder
  const started = await recorder.start()

  if (!started.ok) {
    mic.active = false
    mic.recorder = null
    showResult('● MIC OFF', 'Mic unavailable\n\nCheck app permissions', 'Tap to return', 5000)
    return
  }

  mic.ready = true
  if (mic.stopRequested) {
    mic.stopRequested = false
    await finishListening()
    return
  }

  await show({ kind: 'listening' })
  mic.watchdog = setTimeout(() => {
    void finishListening()
  }, 12_000)
}

async function endListening(): Promise<void> {
  if (!mic.active) return
  if (!mic.ready) {
    mic.stopRequested = true
    return
  }
  await finishListening()
}

async function finishListening(): Promise<void> {
  if (!mic.active) return
  mic.active = false
  mic.ready = false
  if (mic.watchdog) {
    clearTimeout(mic.watchdog)
    mic.watchdog = null
  }

  const recorder = mic.recorder
  mic.recorder = null
  const pcm = recorder ? await recorder.stop() : new Uint8Array(0)

  if (pcm.length < 6_400) {
    showResult('● TOO SHORT', 'Hold while you speak', 'Try again', 3000)
    return
  }

  await show({ kind: 'thinking', message: 'Transcribing' })

  try {
    const voice = await api.voice(pcm)
    await handleVoice(voice)
  } catch (err) {
    showResult('● ERROR', `Voice failed\n\n${compact((err as Error).message)}`, 'Tap to return', 6000)
  }
}

async function handleVoice(voice: VoiceResponse): Promise<void> {
  const intent = voice.intent

  if (intent.type === 'alert') {
    try {
      const { alert } = await api.setAlert(intent.price)
      const direction = alert.direction === 'above' ? 'Fires above' : 'Fires below'
      showResult(
        '● ALERT ARMED',
        `Alert set\n\n${fmtPrice(alert.price, 0)}\n\n${direction}`,
        'While app is open',
        4500,
      )
      void pollNow()
    } catch (err) {
      showResult('● ALERT FAILED', `Alert not set\n\n${compact((err as Error).message)}`, 'Tap to return', 6000)
    }
    return
  }

  if (intent.type === 'cancel_alert') {
    try {
      await api.clearAlert()
      lastState = lastState ? { ...lastState, alert: null } : lastState
      showResult('● ALERT CLEARED', 'No alert armed', 'Tap to return', 3000)
      void pollNow()
    } catch (err) {
      showResult('● ERROR', compact((err as Error).message), 'Tap to return', 5000)
    }
    return
  }

  if (intent.type === 'close_half') {
    await show({ kind: 'thinking', message: 'Checking position' })
    try {
      const { preview } = await api.previewCloseHalf()
      await show({ kind: 'confirm', preview, selected: 'no' })
    } catch (err) {
      showResult('● CANNOT CLOSE', `Nothing to close\n\n${compact((err as Error).message)}`, 'Tap to return', 6000)
    }
    return
  }

  const heard = voice.text ? `"${ellipsis(voice.text, 54)}"` : 'No speech heard'
  showResult('● NOT CAUGHT', `${heard}\n\n${intent.hint}`, 'Tap to return', 6000)
}

async function executeOrder(preview: OrderPreviewView): Promise<void> {
  await show({ kind: 'thinking', message: 'Sending testnet order' })
  try {
    const result = await api.executeCloseHalf(preview.id)
    lastState = lastState ? { ...lastState, position: result.position } : lastState
    const action = result.fill.side === 'LONG' ? 'Sold' : 'Bought'
    const left =
      result.position.qty > 0
        ? `Left ${fmtQty(result.position.qty, result.position.qtyDecimals)}`
        : 'Position closed'
    const sold = `${action} ${fmtQty(result.fill.executedQty, result.fill.qtyDecimals)} ${result.fill.symbol} @ ${fmtPrice(result.fill.avgPrice, result.position.priceDecimals)}`
    const receipt = result.receipt
    const receiptLine = receipt
      ? `Liq ${optionalPrice(receipt.liqBefore)} → ${optionalPrice(receipt.liqAfter)} · buffer ${optionalPct(receipt.bufferBeforePct)} → ${optionalPct(receipt.bufferAfterPct)}`
      : null
    showResult(
      '● FILLED',
      receiptLine ? `Closed half\n\n${receiptLine}\n\n${sold}` : `Closed half\n\n${sold}`,
      left,
      5000,
    )
    void pollNow()
  } catch (err) {
    showResult(
      '● NOT SENT',
      `Order not sent\n\n${compact((err as Error).message)}\n\nNothing changed`,
      'Tap to return',
      7000,
    )
  }
}

function optionalPrice(value: number | null): string {
  return value !== null && Number.isFinite(value) && value > 0 ? fmtPrice(value, 0) : '—'
}

function optionalPct(value: number | null): string {
  return value !== null && Number.isFinite(value) ? `${value.toFixed(1)}%` : '—'
}

/* -------------------------------- input -------------------------------- */

function onTextClick() {
  switch (screen.kind) {
    case 'position':
      void pollNow()
      break
    case 'alertHit':
      void dismissAlert()
      break
    case 'result':
      void show({ kind: 'position' })
      break
    case 'listening':
      // The release event ends the recording; a stray tap changes nothing.
      break
    case 'confirm':
    case 'thinking':
    case 'boot':
      break
  }
}

async function dismissAlert(): Promise<void> {
  try {
    await api.clearAlert()
  } catch {
    // Clearing is best effort; the local view still returns to the position.
  }
  if (lastState) lastState = { ...lastState, alert: null }
  await show({ kind: 'position' })
}

function handleConfirmInput(eventType: OsEventTypeList | undefined) {
  if (screen.kind !== 'confirm') return
  const preview = screen.preview

  if (eventType === OsEventTypeList.DOUBLE_CLICK_EVENT) {
    void show({ kind: 'position' })
    return
  }
  if (eventType === OsEventTypeList.SCROLL_TOP_EVENT) {
    void show({ kind: 'confirm', preview, selected: 'no' })
    return
  }
  if (eventType === OsEventTypeList.SCROLL_BOTTOM_EVENT) {
    void show({ kind: 'confirm', preview, selected: 'yes' })
    return
  }
  if (eventType === OsEventTypeList.CLICK_EVENT || eventType === undefined) {
    if (screen.selected === 'yes') void executeOrder(preview)
    else void show({ kind: 'position' })
  }
}

function onPrimaryClick() {
  // The host emits a synthetic tap event right after a rebuild. Ignoring taps
  // inside the settle window keeps a swipe (which rebuilds the page) from
  // turning into an order.
  if (Date.now() - lastPageWriteAt < 700) return

  if (screen.kind === 'confirm') {
    handleConfirmInput(undefined)
    return
  }
  onTextClick()
}

function onDoubleClick() {
  if (screen.kind === 'confirm') {
    void show({ kind: 'position' })
    return
  }
  void bridge.shutDownPageContainer(1)
}

bridge.onEvenHubEvent((event) => {
  if (event.audioEvent?.audioPcm?.length) {
    mic.recorder?.push(event.audioEvent.audioPcm)
    return
  }

  const sys = event.sysEvent
  if (sys) {
    switch (sys.eventType) {
      case OsEventTypeList.LONG_PRESS_EVENT:
        void startListening()
        return
      case OsEventTypeList.LONG_PRESS_RELEASE_EVENT:
        void endListening()
        return
      case OsEventTypeList.DOUBLE_CLICK_EVENT:
        onDoubleClick()
        return
      case undefined:
        // SDK 0.0.16 + simulator 0.9.x deliver a single tap as a sysEvent
        // with eventType 0 omitted; eventSource is the tell-tale.
        if (sys.eventSource !== undefined) onPrimaryClick()
        return
      default:
        return
    }
  }

  const ev = event.textEvent
  if (!ev) return

  if (ev.eventType === OsEventTypeList.DOUBLE_CLICK_EVENT) {
    onDoubleClick()
    return
  }
  if (
    ev.eventType === OsEventTypeList.SCROLL_TOP_EVENT ||
    ev.eventType === OsEventTypeList.SCROLL_BOTTOM_EVENT
  ) {
    if (screen.kind === 'confirm') handleConfirmInput(ev.eventType)
    return
  }
  if (ev.eventType === OsEventTypeList.CLICK_EVENT || ev.eventType === undefined) {
    onPrimaryClick()
  }
})

/* -------------------------------- boot --------------------------------- */

await show({ kind: 'boot' })

// Dev-only state previews for design QA: open /?demo=confirm in the simulator.
if (import.meta.env.DEV) {
  const demo = new URLSearchParams(location.search).get('demo')
  try {
    if (demo === 'confirm') {
      const { preview } = await api.previewCloseHalf()
      await show({ kind: 'confirm', preview, selected: 'no' })
    } else if (demo === 'listening') {
      await show({ kind: 'listening' })
    } else if (demo === 'alert') {
      lastState = await api.state()
      await show({ kind: 'alertHit' })
    } else if (demo === 'list') {
    }
  } catch (err) {
    console.warn('[demo]', (err as Error).message)
  }
}

startPolling()
