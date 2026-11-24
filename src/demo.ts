import './demo.css'
import { parseIntent } from '../server/intents.ts'

const MARK = 61_486.88
const ENTRY = 61_492.88
const LIQ = 58_684.4
const AFTER_LIQ = 55_590.6
const FILL_PRICE = 61_502.9
const INITIAL_QTY = 0.01
const AFTER_QTY = 0.005

type Screen = 'position' | 'armed' | 'confirm' | 'sending' | 'filled'
type Selected = 'no' | 'yes'

let screen: Screen = 'position'
let selected: Selected = 'no'
let qty = INITIAL_QTY
let alertPrice: number | null = null
let feedback = 'Recorded position · 0.01 BTCUSDT long · 20x'
let timer: number | undefined

const ESC: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

const esc = (value: string): string => value.replace(/[&<>"']/g, (char) => ESC[char] ?? char)

const fmtPrice = (value: number, decimals = 2): string =>
  value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })

const fmtQty = (value: number): string => {
  const fixed = value.toFixed(3)
  return fixed.includes('.') ? fixed.replace(/\.?0+$/, '') : fixed
}

const fmtSigned = (value: number, decimals = 2): string =>
  `${value >= 0 ? '+' : '-'}${Math.abs(value).toFixed(decimals)}`

const fmtPct = (value: number): string => `${fmtSigned(value, 1)}%`

const status = (text: string): string =>
  `<div class="hud-status"></div><div class="hud-status-text">${esc(text)}</div>`

const line = (top: number, text: string, opts: { size?: number; color?: string } = {}): string => {
  const style = [`top:${top}px`]
  if (opts.size) style.push(`font-size:${opts.size}px`)
  if (opts.color) style.push(`color:${opts.color}`)
  return `<div class="hud-line" style="${style.join(';')}">${esc(text)}</div>`
}

const hint = (text: string, bright = false): string =>
  `<div class="hud-hint${bright ? ' bright' : ''}">${esc(text)}</div>`

const row = (top: number, text: string, active: boolean): string =>
  `<div class="hud-row${active ? ' active' : ''}" style="top:${top}px">${esc(text)}</div>`

const clearTimer = (): void => {
  if (timer !== undefined) {
    window.clearTimeout(timer)
    timer = undefined
  }
}

const positionScreen = (): string => {
  const isAfter = qty === AFTER_QTY
  const mark = isAfter ? FILL_PRICE : MARK
  const liq = isAfter ? AFTER_LIQ : LIQ
  const pnl = (mark - ENTRY) * qty
  const margin = (ENTRY * qty) / 20
  const roe = margin > 0 ? (pnl / margin) * 100 : 0
  const buffer = ((mark - liq) / mark) * 100
  const eta = isAfter ? 8 : 4
  const statusText = alertPrice
    ? `BINANCE TESTNET · ALERT ${fmtPrice(alertPrice, 0)}`
    : 'BINANCE TESTNET · 20x'

  return [
    status(statusText),
    line(64, `BTCUSDT LONG ${fmtQty(qty)} · 20x`),
    line(118, `PnL ${fmtSigned(pnl)} USDT · ROE ${fmtPct(roe)}`),
    line(172, `Liq ${fmtPrice(liq, 1)} · ${buffer.toFixed(1)}% away`),
    hint(`LIQ IN ~${eta}m at this pace · buffer ${buffer.toFixed(1)}%`, true),
  ].join('')
}

const armedScreen = (): string => {
  const price = alertPrice ?? 61_500
  return [
    status('ALERT ARMED'),
    line(56, 'Alert set'),
    line(110, fmtPrice(price, 0)),
    line(164, price >= MARK ? 'Fires above' : 'Fires below'),
    hint('While app is open'),
  ].join('')
}

const confirmScreen = (): string => [
  status('CONFIRM'),
  line(34, 'Close half?'),
  line(72, 'BTCUSDT LONG · 0.01 open', { size: 22, color: '#00e600' }),
  row(124, 'No, keep 0.01', selected === 'no'),
  row(182, 'Yes, sell 0.005', selected === 'yes'),
  hint('Swipe to change · tap to confirm'),
].join('')

const sendingScreen = (): string => [
  status('MIC OFF'),
  line(64, 'Sending testnet order'),
  line(118, 'One moment'),
  hint(''),
].join('')

const filledScreen = (): string => [
  status('FILLED'),
  line(56, 'Closed half'),
  line(110, 'Liq 58,684 → 55,591 · buffer 4.6% → 9.6%', { size: 22 }),
  line(164, 'Sold 0.005 BTCUSDT @ 61,502.9'),
  hint('Left 0.005'),
].join('')

const hudFor = (): string => {
  switch (screen) {
    case 'armed':
      return armedScreen()
    case 'confirm':
      return confirmScreen()
    case 'sending':
      return sendingScreen()
    case 'filled':
      return filledScreen()
    default:
      return positionScreen()
  }
}

const actionsFor = (): string => {
  const button = (action: string, label: string, primary = false): string =>
    `<button class="btn${primary ? ' primary' : ''}" data-action="${action}">${label}</button>`

  switch (screen) {
    case 'armed':
      return [button('back', 'Back to position', true), button('reset', 'Reset')].join('')
    case 'confirm':
      return selected === 'no'
        ? [button('select-yes', 'Swipe to Yes', true), button('cancel', 'Cancel')].join('')
        : [button('execute', 'Tap to confirm', true), button('select-no', 'Back to No')].join('')
    case 'sending':
      return '<button class="btn" disabled>Sending…</button>'
    case 'filled':
      return [button('continue', 'Continue', true), button('reset', 'Reset')].join('')
    default:
      return [
        button('alert', 'Alert 61,500', true),
        button('close', 'Close half'),
        button('reset', 'Reset'),
      ].join('')
  }
}

const render = (): void => {
  const hud = document.querySelector<HTMLDivElement>('#hud')
  const feedbackEl = document.querySelector<HTMLDivElement>('#feedback')
  const buttons = document.querySelector<HTMLDivElement>('#buttons')
  if (!hud || !feedbackEl || !buttons) return

  hud.innerHTML = hudFor()
  feedbackEl.textContent = feedback
  buttons.innerHTML = actionsFor()
}

const fit = (): void => {
  const wrap = document.querySelector<HTMLDivElement>('#hud-wrap')
  const hud = document.querySelector<HTMLDivElement>('#hud')
  if (!wrap || !hud) return
  const scale = Math.min(2, wrap.clientWidth / 576)
  hud.style.transform = `scale(${scale})`
  wrap.style.height = `${288 * scale}px`
}

const clearAlert = (): void => {
  clearTimer()
  alertPrice = null
  screen = 'position'
  feedback = 'Alert cleared. Nothing was sent.'
  render()
}

const armAlert = (price: number): void => {
  clearTimer()
  if (!Number.isFinite(price) || price <= 0) {
    feedback = 'That price is not valid.'
    render()
    return
  }
  if (price < MARK * 0.2 || price > MARK * 5) {
    feedback = 'That price is too far from the recorded market.'
    render()
    return
  }
  alertPrice = price
  screen = 'armed'
  feedback = `Alert armed at ${fmtPrice(price, 0)} · ${price >= MARK ? 'fires above' : 'fires below'}`
  render()
  timer = window.setTimeout(() => {
    timer = undefined
    screen = 'position'
    feedback = `Alert armed at ${fmtPrice(price, 0)} · while the app is open`
    render()
  }, 2_600)
}

const openConfirm = (): void => {
  clearTimer()
  selected = 'no'
  screen = 'confirm'
  feedback = 'Close half? Default is No.'
  render()
}

const selectNo = (): void => {
  selected = 'no'
  feedback = 'Default is No. Nothing was sent.'
  render()
}

const selectYes = (): void => {
  selected = 'yes'
  feedback = 'Swipe registered. Tap to confirm.'
  render()
}

const cancel = (): void => {
  clearTimer()
  selected = 'no'
  screen = 'position'
  feedback = 'Cancelled. Nothing was sent.'
  render()
}

const execute = (): void => {
  if (selected !== 'yes') return
  clearTimer()
  screen = 'sending'
  feedback = 'Sending a simulated reduce-only order…'
  render()
  timer = window.setTimeout(() => {
    timer = undefined
    qty = AFTER_QTY
    screen = 'filled'
    feedback = 'Filled 0.005 @ 61,502.9 · receipt shown'
    render()
    timer = window.setTimeout(() => {
      timer = undefined
      screen = 'position'
      alertPrice = null
      feedback = 'Position 0.005 left. The risk moved: buffer 4.6% → 9.6%.'
      render()
    }, 5_000)
  }, 900)
}

const backToPosition = (): void => {
  clearTimer()
  screen = 'position'
  render()
}

const reset = (): void => {
  clearTimer()
  qty = INITIAL_QTY
  alertPrice = null
  selected = 'no'
  screen = 'position'
  feedback = 'Reset to the recorded 0.01 position.'
  render()
}

const handleCommand = (raw: string): void => {
  const text = raw.trim()
  if (!text) return
  if (/^reset$/i.test(text)) {
    reset()
    return
  }
  if (/^(cancel|clear)( the)? alert$/i.test(text)) {
    clearAlert()
    return
  }

  const intent = parseIntent(text, MARK)
  switch (intent.type) {
    case 'alert':
      armAlert(intent.price)
      break
    case 'close_half':
      openConfirm()
      break
    case 'cancel_alert':
      clearAlert()
      break
    case 'none':
      feedback = `Not caught: ${intent.hint}`
      render()
      break
  }
}

const shell = (): string => `
  <div class="page">
    <header class="topbar">
      <div class="brand"><img src="/favicon.svg" alt="" /><span>WICKSIGHT</span></div>
      <span class="badge">DEMO · REPLAY</span>
    </header>

    <section class="hero">
      <div class="kicker">Even G2 · Track 03</div>
      <h1>One position. One screen.<br />Act in seconds.</h1>
      <p class="lede">
        This is the <strong>WickSight HUD running in your browser</strong> on the recorded
        23 Nov 2026 Binance Futures <strong>testnet</strong> state. No keys, no exchange calls,
        no orders. Buttons and typed commands stand in for voice.
      </p>
    </section>

    <section class="screen-card">
      <div class="screen-head">
        <span>EVEN G2 · 576 × 288</span>
        <span class="replay">● DEMO · REPLAY</span>
      </div>
      <div class="hud-wrap" id="hud-wrap">
        <div class="hud-canvas" id="hud"></div>
      </div>
      <div class="screen-foot">
        <span>RECORDED 23 NOV 2026 · BINANCE FUTURES TESTNET</span>
        <span>NO LIVE DATA · NO KEYS · NO ORDERS</span>
      </div>
    </section>

    <section class="controls">
      <div class="controls-head">
        <h2>Try the HUD</h2>
        <div class="feedback" id="feedback"></div>
      </div>
      <div class="buttons" id="buttons"></div>
      <div class="command">
        <input
          id="command"
          type="text"
          autocomplete="off"
          spellcheck="false"
          placeholder="Type: alert 61,500 · close half · reset"
          aria-label="Type a command"
        />
        <button class="btn" id="run">Run</button>
      </div>
      <p class="hint">
        Voice is simulated here. <code>alert 61,500</code> arms an alert,
        <code>close half</code> opens the confirm screen, <code>reset</code> starts over.
        The real app uses 16 kHz push-to-talk and local Whisper.
      </p>
    </section>

    <p class="note">
      The recorded position is 0.01 BTCUSDT long at 20×, entry ≈ 61,492.9, liq 58,684.4,
      buffer 4.6%. Closing half fills 0.005 @ 61,502.9 and the receipt shows liq
      58,684 → 55,591, buffer 4.6% → 9.6%. The after-liq is derived from the recorded
      pre-close position and the exchange's isolated-margin formula; the live app reads both
      values from Binance. <a href="https://github.com/artomily/wicksight" target="_blank" rel="noreferrer">Source on GitHub</a>
      · <a href="https://github.com/artomily/wicksight/releases/download/v1.0.0/wicksight-final.mp4" target="_blank" rel="noreferrer">Watch the 2:59 demo</a>.
    </p>

    <footer class="footer">
      <span>WickSight · Track 03 — Exchanges &amp; Stocks</span>
      <span>DEMO · REPLAY · NOT FINANCIAL ADVICE</span>
    </footer>
  </div>
`

const root = document.querySelector<HTMLDivElement>('#demo')
if (root) {
  root.innerHTML = shell()

  // Optional direct states for screenshots and reviews: /?state=confirm|yes|filled|after|armed|sending
  const preview = new URLSearchParams(window.location.search).get('state')
  if (preview === 'confirm') {
    screen = 'confirm'
    selected = 'no'
    feedback = 'Close half? Default is No.'
  } else if (preview === 'yes') {
    screen = 'confirm'
    selected = 'yes'
    feedback = 'Swipe registered. Tap to confirm.'
  } else if (preview === 'filled') {
    qty = AFTER_QTY
    screen = 'filled'
    feedback = 'Filled 0.005 @ 61,502.9 · receipt shown'
  } else if (preview === 'after') {
    qty = AFTER_QTY
    screen = 'position'
    feedback = 'Position 0.005 left. The risk moved: buffer 4.6% → 9.6%.'
  } else if (preview === 'armed') {
    alertPrice = 61_500
    screen = 'armed'
    feedback = 'Alert armed at 61,500 · fires above'
  } else if (preview === 'sending') {
    screen = 'sending'
    feedback = 'Sending a simulated reduce-only order…'
  }

  render()
  fit()

  document.querySelector<HTMLDivElement>('#buttons')?.addEventListener('click', (event) => {
    const target = (event.target as HTMLElement).closest<HTMLElement>('[data-action]')
    if (!target) return
    switch (target.dataset.action) {
      case 'alert':
        armAlert(61_500)
        break
      case 'close':
        openConfirm()
        break
      case 'select-yes':
        selectYes()
        break
      case 'select-no':
        selectNo()
        break
      case 'execute':
        execute()
        break
      case 'cancel':
        cancel()
        break
      case 'continue':
      case 'back':
        backToPosition()
        break
      case 'reset':
        reset()
        break
    }
  })

  const input = document.querySelector<HTMLInputElement>('#command')
  const run = document.querySelector<HTMLButtonElement>('#run')
  const submit = (): void => {
    if (!input) return
    handleCommand(input.value)
    input.value = ''
    input.focus()
  }
  run?.addEventListener('click', submit)
  input?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') submit()
  })

  window.addEventListener('resize', fit)
}
