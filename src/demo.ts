import './demo.css'
import { parseIntent } from '../server/intents.ts'
import { voxelLensSvg } from './voxel'
import { mountSimulator } from './sim/ui.ts'

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
    <header class="nav">
      <a class="brand" href="#"><img src="/favicon.svg" alt="" /><span>WICKSIGHT</span></a>
      <nav class="nav-links">
        <a href="#simulator">Simulator</a>
        <a href="#try">Replay</a>
        <a href="#features">Features</a>
        <a href="#how">How it works</a>
        <a href="#safety">Safety</a>
      </nav>
      <div class="nav-actions">
        <a class="nav-cta" href="#try">Try the demo <span>→</span></a>
        <a class="nav-ghost" href="https://github.com/artomily/wicksight" target="_blank" rel="noreferrer">GitHub ↗</a>
      </div>
    </header>

    <section class="hero">
      <div class="hero-copy">
        <span class="eyebrow"><span class="eyebrow-dot"></span>EVEN G2 · TRACK 03</span>
        <h1>See the liquidation coming.<br /><span class="lime">Get out of it.</span></h1>
        <p class="lede">
          WickSight reads the time to liquidation, then gets you out: a voiced close-half,
          a default-No confirmation, and a receipt that proves the buffer moved. From your
          glasses, on Binance Futures <strong>testnet</strong>.
        </p>
        <div class="hero-actions">
          <a class="btn primary" href="#simulator">Play the simulator <span>→</span></a>
          <a class="btn" href="#try">Watch the replay</a>
          <a class="btn" href="https://github.com/artomily/wicksight/releases/download/v1.0.0/wicksight-final.mp4" target="_blank" rel="noreferrer">60s demo <span>↗</span></a>
        </div>
        <div class="hero-stats">
          <div class="stat"><span class="stat-value">4.6%</span><span class="stat-label">buffer at entry</span></div>
          <div class="stat"><span class="stat-value">~4m</span><span class="stat-label">time to liq</span></div>
          <div class="stat"><span class="stat-value">2</span><span class="stat-label">gestures to act</span></div>
        </div>
      </div>
      <div class="hero-visual">
        <div class="voxel-panel">
          <div class="panel-top"><span class="pill">VOXEL · LENS</span><span>01 / 04</span></div>
          <div class="voxel-art">${voxelLensSvg(560)}</div>
          <div class="panel-foot"><span>ONE POSITION</span><span>ONE SCREEN</span></div>
        </div>
      </div>
    </section>

    <section class="ticker">
      <div class="ticker-cell"><span class="ticker-k">READ</span><span class="ticker-v">Position · PnL · Liq distance · ETA</span></div>
      <div class="ticker-cell"><span class="ticker-k">ACT</span><span class="ticker-v">Voice → No/Yes → testnet fill</span></div>
      <div class="ticker-cell"><span class="ticker-k">PROVE</span><span class="ticker-v">Receipt: buffer 4.6% → 9.6%</span></div>
    </section>

    <section class="section" id="try">
      <div class="section-head">
        <span class="eyebrow">LIVE DEMO · REPLAY</span>
        <h2>Try the HUD.</h2>
        <p>
          The recorded 23 Nov 2026 testnet state, running entirely in your browser.
          No keys, no exchange calls, no orders. Buttons and typed commands stand in for voice.
        </p>
        <div class="bar"></div>
      </div>

      <div class="screen-card">
        <div class="screen-head">
          <span>EVEN G2 · HUD · 576 × 288</span>
          <span class="replay">● DEMO · REPLAY</span>
        </div>
        <div class="hud-wrap" id="hud-wrap">
          <div class="hud-canvas" id="hud"></div>
        </div>
        <div class="screen-foot">
          <span>RECORDED 23 NOV 2026 · BINANCE FUTURES TESTNET</span>
          <span>NO LIVE DATA · NO KEYS · NO ORDERS</span>
        </div>
      </div>

      <div class="controls">
        <div class="controls-head">
          <h2>Try it</h2>
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
          <button class="btn primary" id="run">Run</button>
        </div>
        <p class="hint">
          Voice is simulated here. <code>alert 61,500</code> arms an alert,
          <code>close half</code> opens the confirm screen, <code>reset</code> starts over.
          The real app uses 16 kHz push-to-talk and local Whisper.
        </p>
      </div>

      <p class="demo-note">
        The recorded position is 0.01 BTCUSDT long at 20×, entry ≈ 61,492.9, liq 58,684.4,
        buffer 4.6%. Closing half fills 0.005 @ 61,502.9 and the receipt shows liq
        58,684 → 55,591, buffer 4.6% → 9.6%. The after-liq is derived from the recorded
        pre-close position and the exchange's isolated-margin formula; the live app reads both
        values from Binance. <a href="https://github.com/artomily/wicksight" target="_blank" rel="noreferrer">Source on GitHub</a>
        · <a href="https://github.com/artomily/wicksight/releases/download/v1.0.0/wicksight-final.mp4" target="_blank" rel="noreferrer">Watch the 60s demo</a>.
      </p>
    </section>

    <section class="section simulator" id="simulator">
      <div id="simulator-root"></div>
    </section>

    <section class="section" id="features">
      <div class="section-head">
        <span class="eyebrow">WHAT IT DOES</span>
        <h2>Four things. One loop.</h2>
        <p>Read the risk, act on it, and prove the action changed it. That is the whole product.</p>
        <div class="bar"></div>
      </div>
      <div class="feature-grid">
        <article class="feature">
          <div class="feature-top"><span>01</span><span class="mono">ETA</span></div>
          <div class="feature-bar"></div>
          <h3>Liquidation ETA</h3>
          <p>Not just how far. How long — fitted from the last three minutes of 1 s mark ticks.</p>
          <div class="feature-code">LIQ IN ~4m at this pace
buffer 4.6%</div>
        </article>
        <article class="feature">
          <div class="feature-top"><span>02</span><span class="mono">VOICE</span></div>
          <div class="feature-bar"></div>
          <h3>Voice</h3>
          <p>Hold the temple. Speak. 16 kHz PCM in, Whisper small.en locally, a deterministic parser.</p>
          <div class="feature-code">"alert 61,500"
"close half"</div>
        </article>
        <article class="feature">
          <div class="feature-top"><span>03</span><span class="mono">WRITE</span></div>
          <div class="feature-bar"></div>
          <h3>Confirmed close-half</h3>
          <p>Voice only creates a preview. Default No; swipe to Yes; tap. Reduce-only, quantity-bound, single use.</p>
          <div class="feature-code">No, keep 0.010
Yes, sell 0.005</div>
        </article>
        <article class="feature">
          <div class="feature-top"><span>04</span><span class="mono">PROOF</span></div>
          <div class="feature-bar"></div>
          <h3>After-action receipt</h3>
          <p>The execute response carries the before/after liquidation line and buffer from the exchange snapshots.</p>
          <div class="feature-code">Liq 58,684 → 55,591
buffer 4.6% → 9.6%</div>
        </article>
      </div>
    </section>

    <section class="section" id="how">
      <div class="section-head">
        <span class="eyebrow">HOW IT WORKS</span>
        <h2>Glance. Confirm. Prove.</h2>
        <div class="bar"></div>
      </div>
      <div class="how-grid">
        <div class="how-step"><span class="step-num">01</span><h3>Glance</h3><p>Position, PnL, distance to liquidation, and the ETA — one 576×288 monochrome screen, updated in place.</p></div>
        <div class="how-step"><span class="step-num">02</span><h3>Confirm</h3><p>Hold the temple and speak. A preview appears. Default No; swipe to Yes; tap. The order path fails closed.</p></div>
        <div class="how-step"><span class="step-num">03</span><h3>Prove</h3><p>A reduce-only testnet fill returns the after-action receipt. The buffer moved, and the receipt shows it.</p></div>
      </div>
    </section>

    <section class="section safety" id="safety">
      <div class="section-head">
        <span class="eyebrow">SAFETY MODEL</span>
        <h2>Testnet only. Explicit yes.</h2>
        <div class="bar"></div>
      </div>
      <div class="safety-grid">
        <div class="safety-card"><span class="safety-k">HOST GATE</span><h3>Exact hostname.</h3><p>The Binance adapter refuses any host that is not <span class="mono">testnet.binancefuture.com</span> at boot. Lookalikes are rejected.</p></div>
        <div class="safety-card"><span class="safety-k">KEYS</span><h3>Server-side only.</h3><p>Testnet keys live in the server's <span class="mono">.env</span>; never in the WebView, never in logs, never in git.</p></div>
        <div class="safety-card"><span class="safety-k">CONFIRM</span><h3>Default No.</h3><p>Two gestures, a single-use preview bound to the quantity, 45 s TTL. A replay gets a clean 409.</p></div>
        <div class="safety-card"><span class="safety-k">AUTOMATION</span><h3>None.</h3><p>Alerts are display-only. Nothing fires an order without a human. No custody; no mainnet order path.</p></div>
      </div>
    </section>

    <footer class="footer">
      <div class="footer-brand"><img src="/favicon.svg" alt="" /><span>WICKSIGHT</span></div>
      <div class="footer-links">
        <a href="https://github.com/artomily/wicksight" target="_blank" rel="noreferrer">GitHub ↗</a>
        <a href="https://github.com/artomily/wicksight/releases/download/v1.0.0/wicksight-final.mp4" target="_blank" rel="noreferrer">60s demo ↗</a>
        <a href="https://github.com/artomily/wicksight/releases/download/v1.0.0/wicksight-full.mp4" target="_blank" rel="noreferrer">Full cut ↗</a>
        <a href="https://wicksight.vercel.app" target="_blank" rel="noreferrer">Live demo ↗</a>
      </div>
      <div class="footer-fine">DEMO · REPLAY<br />NOT FINANCIAL ADVICE</div>
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
  const simulatorRoot = document.querySelector<HTMLDivElement>('#simulator-root')
  if (simulatorRoot) mountSimulator(simulatorRoot)
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
