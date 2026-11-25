import { parseIntent } from '../../server/intents.ts'
import { alertHitPage, confirmPage, positionPage, resultPage, type PageSpec } from '../ui.ts'
import { fmtPrice, fmtQty, formatEta } from '../format.ts'
import { MarketSimulator, type Scenario, type Speed } from './engine.ts'
import { rankByRisk, riskHeader } from '../../shared/risk.ts'
import type { LiqEta } from '../../server/eta.ts'
import type { PositionSnapshot, Side } from '../../server/exchange/types.ts'
import { pageHtml, receiptLine } from './render.ts'
import type { CloseReceipt } from '../../server/receipt.ts'
import type { OrderFill, OrderPreview } from '../../server/exchange/types.ts'

type Screen = 'position' | 'confirm' | 'alert' | 'filled'
type Selected = 'no' | 'yes'

const SCENARIOS: Array<{ id: Scenario; label: string }> = [
  { id: 'calm', label: 'Calm' },
  { id: 'dump', label: 'Dump' },
  { id: 'wick', label: 'Wick spike' },
  { id: 'recovery', label: 'Recovery' },
]
const SPEEDS: Speed[] = [1, 5, 20]

interface SimBookConfig {
  symbol: string
  side: Side
  size: number
  leverage: number
  entry: number
}

const BOOKS: SimBookConfig[] = [
  { symbol: 'BTCUSDT', side: 'LONG', size: 0.01, leverage: 20, entry: 63_120 },
  { symbol: 'ETHUSDT', side: 'LONG', size: 0.2, leverage: 10, entry: 3_150 },
  { symbol: 'SOLUSDT', side: 'LONG', size: 4, leverage: 25, entry: 152 },
]

type SimEntry = { position: PositionSnapshot; eta: LiqEta | null }

const wait = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms))

interface SpeechResultLike {
  results: { 0: { 0: { transcript: string } } }
}
interface SpeechRecognitionLike {
  lang: string
  interimResults: boolean
  maxAlternatives: number
  start(): void
  stop(): void
  onresult: ((event: SpeechResultLike) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
}

export function mountSimulator(root: HTMLElement): void {
  root.innerHTML = `
    <div class="section-head">
      <span class="eyebrow">SIMULATOR · LIVE IN YOUR BROWSER</span>
      <h2>Play the book.</h2>
      <p>
        A synthetic BTC/ETH/SOL tape, three positions ranked by risk, and the real
        HUD/ETA/receipt logic. Nothing leaves this tab: no keys, no calls, no orders.
      </p>
      <div class="bar"></div>
    </div>
    <div class="sim-layout">
      <div class="screen-card sim-screen">
        <div class="screen-head">
          <span>EVEN G2 · SIMULATION · 576 × 288</span>
          <span class="replay sim-badge">● SIMULATION</span>
        </div>
        <div class="hud-wrap" id="sim-hud-wrap">
          <div class="hud-canvas" id="sim-hud"></div>
        </div>
        <div class="screen-foot">
          <span>SIMULATION · NO NETWORK · NO ORDERS</span>
          <span>NOT FINANCIAL ADVICE</span>
        </div>
        <div class="sim-stats">
          <span>Mark <b id="sim-mark">—</b></span>
          <span>Liq <b id="sim-liq">—</b></span>
          <span>ETA <b id="sim-eta">hidden</b></span>
          <span>Bars <b id="sim-samples">0</b></span>
        </div>
      </div>

      <div class="sim-panel">
        <div class="sim-tour" id="sim-tour-bar" hidden>
          <span class="sim-tour-step" id="sim-tour-step">1/4</span>
          <span id="sim-tour-text"></span>
          <button class="btn" id="sim-tour-stop" type="button">Stop</button>
        </div>

        <div class="sim-group">
          <div class="sim-group-head">
            <h3>Market</h3>
            <button class="btn primary" id="sim-tour-start" type="button">Try it · 30s</button>
          </div>
          <div class="sim-chips" id="sim-scenarios">
            ${SCENARIOS.map((s) => `<button class="btn" data-scenario="${s.id}" type="button">${s.label}</button>`).join('')}
          </div>
          <div class="sim-row">
            <div class="sim-chips" id="sim-speeds">
              ${SPEEDS.map((s) => `<button class="btn" data-speed="${s}" type="button">${s}x</button>`).join('')}
            </div>
            <div class="sim-row-end">
              <button class="btn primary" id="sim-toggle" type="button">Start</button>
              <button class="btn" id="sim-reset" type="button">Reset</button>
            </div>
          </div>
        </div>

        <div class="sim-group">
          <h3>Position <span class="sim-selected" id="sim-selected">SOL</span></h3>
          <div class="sim-form">
            <label>Symbol
              <select id="sim-symbol">
                ${BOOKS.map((book) => `<option value="${book.symbol}">${book.symbol}</option>`).join('')}
              </select>
            </label>
            <label>Side
              <select id="sim-side">
                <option value="LONG">Long</option>
                <option value="SHORT">Short</option>
              </select>
            </label>
            <label>Size
              <input id="sim-size" type="number" min="0.001" max="10" step="0.001" value="0.01" />
            </label>
            <label>Leverage <span id="sim-lev-label">20x</span>
              <input id="sim-leverage" type="range" min="5" max="50" step="1" value="20" />
            </label>
            <label>Entry (USDT)
              <input id="sim-entry" type="number" min="0.01" max="500000" step="0.1" value="61492.9" />
            </label>
            <button class="btn" id="sim-apply" type="button">Apply position</button>
          </div>
        </div>

        <div class="sim-group">
          <h3>Actions</h3>
          <div class="sim-action-row">
            <input id="sim-alert-price" type="text" inputmode="decimal" placeholder="Alert 61,500" aria-label="Alert price" />
            <button class="btn" id="sim-alert" type="button">Alert</button>
            <button class="btn" id="sim-mic" type="button" hidden>Speak</button>
          </div>
          <div class="sim-action-row">
            <input id="sim-command" type="text" autocomplete="off" placeholder="Type: alert 61,500 · close half" aria-label="Type a simulator command" />
            <button class="btn" id="sim-run" type="button">Run</button>
          </div>
          <div class="buttons" id="sim-actions"></div>
          <p class="feedback" id="sim-feedback">Simulation ready. Start the tape.</p>
          <p class="hint">Keyboard: Space start/pause · C close half · ←/→ No/Yes · Enter confirm · R reset.</p>
        </div>
      </div>
    </div>
  `

  const $ = <T extends HTMLElement>(id: string): T => {
    const el = root.querySelector<T>(`#${id}`)
    if (!el) throw new Error(`simulator: missing #${id}`)
    return el
  }

  const hud = $<HTMLDivElement>('sim-hud')
  const wrap = $<HTMLDivElement>('sim-hud-wrap')
  const feedback = $<HTMLParagraphElement>('sim-feedback')
  const actions = $<HTMLDivElement>('sim-actions')
  const toggle = $<HTMLButtonElement>('sim-toggle')
  const tourBar = $<HTMLDivElement>('sim-tour-bar')
  const tourStep = $<HTMLSpanElement>('sim-tour-step')
  const tourText = $<HTMLSpanElement>('sim-tour-text')

  const sims = BOOKS.map(
    (book, index) =>
      new MarketSimulator({
        side: book.side,
        size: book.size,
        leverage: book.leverage,
        entry: book.entry,
        symbol: book.symbol,
        seed: 0x51a7 + index * 17,
      }),
  )
  let selectedSymbol = BOOKS.find((book) => book.symbol === 'SOLUSDT')?.symbol ?? BOOKS[0]!.symbol
  const sim = () => sims.find((entry) => entry.symbol === selectedSymbol) ?? sims[0]!
  let screen: Screen = 'position'
  let selected: Selected = 'no'
  let alertPrice: number | null = null
  let alertAbove = false
  let alertSymbol: string | null = null
  let preview: OrderPreview | null = null
  let fill: OrderFill | null = null
  let receipt: CloseReceipt | null = null
  let tourToken = 0
  let last = performance.now()

  const readForm = () => ({
    side: (($<HTMLSelectElement>('sim-side').value === 'SHORT' ? 'SHORT' : 'LONG') as 'LONG' | 'SHORT'),
    size: Math.max(0.001, Number($<HTMLInputElement>('sim-size').value) || 0.01),
    leverage: Math.min(50, Math.max(5, Number($<HTMLInputElement>('sim-leverage').value) || 20)),
    entry: Math.max(0.01, Number($<HTMLInputElement>('sim-entry').value) || 61_492.9),
  })

  const setFeedback = (text: string) => {
    feedback.textContent = text
  }

  const rankedNow = (): SimEntry[] =>
    rankByRisk<SimEntry>(
      sims.map((entry) => {
        const state = entry.snapshot()
        return { position: state.position, eta: state.eta }
      }),
    )

  const selectedEntry = () => {
    const ranked = rankedNow()
    return ranked.find((entry) => entry.position.symbol === selectedSymbol) ?? ranked[0] ?? null
  }

  const openEntries = () => rankedNow().filter((entry) => entry.position.hasPosition)

  const syncForm = () => {
    const p = sim().snapshot().position
    $<HTMLSelectElement>('sim-symbol').value = selectedSymbol
    $<HTMLSelectElement>('sim-side').value = p.side === 'SHORT' ? 'SHORT' : 'LONG'
    $<HTMLInputElement>('sim-size').value = String(p.qty || 0.01)
    $<HTMLInputElement>('sim-leverage').value = String(p.leverage || 20)
    $('sim-lev-label').textContent = `${p.leverage || 20}x`
    $<HTMLInputElement>('sim-entry').value = String(p.entryPrice || 0)
    $('sim-selected').textContent = selectedSymbol.replace(/USDT$/, '')
  }

  const selectSymbol = (symbol: string) => {
    if (!sims.some((entry) => entry.symbol === symbol)) return
    selectedSymbol = symbol
    alertPrice = null
    syncForm()
    render()
  }

  const cycle = (delta: number) => {
    const open = openEntries()
    if (open.length < 2) return
    const at = Math.max(0, open.findIndex((entry) => entry.position.symbol === selectedSymbol))
    const next = open[(at + delta + open.length) % open.length]
    if (next) selectSymbol(next.position.symbol)
  }

  const setTour = (step: string, text: string) => {
    if (!text) {
      tourBar.hidden = true
      return
    }
    tourBar.hidden = false
    tourStep.textContent = step
    tourText.textContent = text
  }

  const drawHud = () => {
    const ranked = rankedNow()
    const chosen = selectedEntry()
    const open = ranked.filter((entry) => entry.position.hasPosition)
    const index = chosen ? open.findIndex((entry) => entry.position.symbol === chosen.position.symbol) + 1 : 0
    const state = sim().snapshot()
    const alertFor = alertPrice !== null && alertSymbol === chosen?.position.symbol ? alertPrice : null
    let page: PageSpec
    if (screen === 'confirm' && preview) {
      page = confirmPage(preview, selected)
    } else if (screen === 'alert') {
      const p = chosen?.position
      page = alertHitPage(p?.markPrice ?? 0, p?.distanceToLiqPct ?? null, p?.symbol ?? '')
    } else if (screen === 'filled' && receipt && fill) {
      const main = `Closed half\n\n${receiptLine(receipt)}\n\nSold ${fmtQty(fill.executedQty)} ${state.position.symbol} @ ${fmtPrice(fill.avgPrice, 1)}`
      page = resultPage('● FILLED', main, 'Tap to continue', 4)
    } else {
      page = positionPage(
        chosen?.position ?? state.position,
        alertFor,
        false,
        null,
        false,
        chosen?.eta ?? null,
        { header: riskHeader(ranked), index, count: open.length },
      )
    }
    hud.innerHTML = pageHtml(page)
    $('sim-mark').textContent = fmtPrice(chosen?.position.markPrice ?? state.markPrice, 1)
    $('sim-liq').textContent = chosen?.position.liqPrice ? fmtPrice(chosen.position.liqPrice, 1) : '—'
    $('sim-eta').textContent = chosen?.eta ? `${formatEta(chosen.eta.minutes)} · ${chosen.eta.bufferPct.toFixed(1)}%` : 'hidden'
    $('sim-samples').textContent = String(state.samples)
    $('sim-selected').textContent = selectedSymbol.replace(/USDT$/, '')
  }

  const drawActions = () => {
    const button = (label: string, action: string, primary = false) =>
      `<button class="btn${primary ? ' primary' : ''}" data-action="${action}" type="button">${label}</button>`
    if (screen === 'confirm') {
      actions.innerHTML =
        selected === 'no'
          ? button('Swipe to Yes', 'select-yes', true) + button('Cancel', 'cancel')
          : button('Tap to confirm', 'execute', true) + button('Back to No', 'select-no')
      return
    }
    if (screen === 'alert') {
      actions.innerHTML = button('Tap to dismiss', 'dismiss', true)
      return
    }
    if (screen === 'filled') {
      actions.innerHTML = button('Continue', 'continue', true)
      return
    }
    actions.innerHTML =
      button('Close half', 'close', true) +
      button('Cycle', 'cycle') +
      (alertPrice !== null ? button('Clear alert', 'clear-alert') : '')
  }

  const render = () => {
    drawHud()
    drawActions()
    toggle.textContent = sims.some((entry) => entry.isRunning) ? 'Pause' : 'Start'
    for (const el of root.querySelectorAll<HTMLElement>('[data-scenario]')) {
      el.classList.toggle('active', el.dataset.scenario === sims[0]!.currentScenario)
    }
    for (const el of root.querySelectorAll<HTMLElement>('[data-speed]')) {
      el.classList.toggle('active', Number(el.dataset.speed) === sims[0]!.currentSpeed)
    }
  }

  const resetSim = () => {
    stopTour()
    for (const entry of sims) entry.reset()
    const riskiest = rankedNow().find((entry) => entry.position.hasPosition)
    selectedSymbol = riskiest?.position.symbol ?? sims[0]!.symbol
    syncForm()
    screen = 'position'
    selected = 'no'
    alertPrice = null
    preview = null
    fill = null
    receipt = null
    setFeedback('Reset. Adjust the position, pick a scenario, and start the tape.')
    render()
  }

  const applyPosition = () => {
    const form = readForm()
    sim().setPosition(form)
    screen = 'position'
    alertPrice = null
    preview = null
    setFeedback(`Position set: ${form.side} ${form.size} ${selectedSymbol} · ${form.leverage}x · entry ${fmtPrice(form.entry, 1)}`)
    render()
  }

  const armAlert = (price: number) => {
    const mark = sim().snapshot().markPrice
    if (!Number.isFinite(price) || price <= 0) {
      setFeedback('That alert price is not valid.')
      return
    }
    if (price < mark * 0.2 || price > mark * 5) {
      setFeedback('That price is too far from the simulated market.')
      return
    }
    alertPrice = price
    alertAbove = price >= mark
    alertSymbol = selectedSymbol
    screen = 'position'
    setFeedback(`Alert armed at ${fmtPrice(price, 0)} · ${alertAbove ? 'fires above' : 'fires below'} · while the app is open`)
    render()
  }

  const openConfirm = () => {
    if (!sim().snapshot().position.hasPosition) {
      setFeedback('No position to close.')
      return
    }
    const next = sim().previewCloseHalf()
    preview = next
    if (next.qty <= 0) {
      setFeedback('Position is too small to close half at the 0.001 BTC step.')
      return
    }
    selected = 'no'
    screen = 'confirm'
    setFeedback('Close half? The default is No. Swipe to Yes, then tap.')
    render()
  }

  const execute = () => {
    if (selected !== 'yes' || !preview) return
    const result = sim().closeHalf()
    fill = result.fill
    receipt = result.receipt
    preview = null
    screen = 'filled'
    sim().pause()
    setFeedback('Simulated reduce-only fill. The receipt proves the buffer moved; nothing was sent.')
    render()
  }

  const dismissAlert = () => {
    screen = 'position'
    setFeedback('Alert hit. Tap back to the position.')
    render()
  }

  const continueFromFill = () => {
    screen = 'position'
    setFeedback(`Left ${fmtQty(sim().snapshot().position.qty)} ${selectedSymbol}. The risk moved.`)
    render()
  }

  const stopTour = () => {
    tourToken++
    setTour('', '')
  }

  const startTour = async () => {
    const token = ++tourToken
    selectedSymbol = sims.find((entry) => entry.symbol === 'SOLUSDT')?.symbol ?? selectedSymbol
    syncForm()
    applyPosition()
    sim().setScenario('dump')
    sim().setSpeed(20)
    sim().start()
    render()
    setTour('1/4', 'Dump scenario · watch the buffer shrink')
    await wait(2200)
    if (token !== tourToken) return
    for (let i = 0; i < 40; i++) {
      if (token !== tourToken) return
      if (sim().snapshot().eta) break
      await wait(150)
    }
    // Freeze the tape at the ETA so the demo shows the action improving risk,
    // instead of racing the liquidation line during the explanation.
    sim().pause()
    render()
    setTour('2/4', sim().snapshot().eta ? 'ETA appears: LIQ IN ~Xm at this pace' : 'Waiting for a clean three-minute tape…')
    await wait(3800)
    if (token !== tourToken) return
    openConfirm()
    setTour('3/4', '“Close half” · default is No')
    await wait(3600)
    if (token !== tourToken) return
    selected = 'yes'
    setFeedback('Swipe registered: Yes. Tap to confirm.')
    render()
    setTour('4/4', 'Tap to confirm · simulated fill')
    await wait(2600)
    if (token !== tourToken) return
    execute()
    setTour('✓', 'Receipt: liquidation and buffer before → after')
    await wait(6000)
    if (token !== tourToken) return
    setTour('', '')
    setFeedback('Tour complete. Try Calm, Wick spike, or Recovery yourself.')
  }

  const handleCommand = (raw: string) => {
    const text = raw.trim()
    if (!text) return
    if (/^reset$/i.test(text)) {
      resetSim()
      return
    }
    const intent = parseIntent(text, sim().snapshot().markPrice)
    switch (intent.type) {
      case 'alert':
        armAlert(intent.price)
        break
      case 'close_half':
        openConfirm()
        break
      case 'cancel_alert':
        alertPrice = null
        setFeedback('Alert cleared. Nothing was sent.')
        render()
        break
      case 'none':
        setFeedback(`Not caught: ${intent.hint}`)
        break
    }
  }

  const fit = () => {
    const scale = Math.min(2, wrap.clientWidth / 576)
    hud.style.transform = `scale(${scale})`
    wrap.style.height = `${288 * scale}px`
  }

  // Keyboard stands in for temple taps/swipes: Space, C, R, arrows, Enter, Esc.
  window.addEventListener('keydown', (event) => {
    const target = event.target as HTMLElement | null
    if (target && /^(INPUT|SELECT|TEXTAREA)$/.test(target.tagName)) return
    if (event.key === ' ') {
      event.preventDefault()
      sim().toggle()
      render()
      return
    }
    if (event.key.toLowerCase() === 'c') {
      openConfirm()
      return
    }
    if (event.key.toLowerCase() === 'r') {
      resetSim()
      return
    }
    if (event.key === 'ArrowUp') {
      cycle(-1)
      return
    }
    if (event.key === 'ArrowDown') {
      cycle(1)
      return
    }
    if (screen === 'confirm') {
      if (event.key === 'ArrowLeft') {
        selected = 'no'
        render()
      } else if (event.key === 'ArrowRight') {
        selected = 'yes'
        render()
      } else if (event.key === 'Enter' && selected === 'yes') {
        execute()
      } else if (event.key === 'Escape') {
        screen = 'position'
        preview = null
        setFeedback('Cancelled. Nothing was sent.')
        render()
      }
    }
  })

  // Controls
  for (const el of root.querySelectorAll<HTMLButtonElement>('[data-scenario]')) {
    el.addEventListener('click', () => {
      for (const entry of sims) entry.setScenario(el.dataset.scenario as Scenario)
      setFeedback(`Scenario: ${el.textContent}. Start or resume the tape.`)
      render()
    })
  }
  for (const el of root.querySelectorAll<HTMLButtonElement>('[data-speed]')) {
    el.addEventListener('click', () => {
      for (const entry of sims) entry.setSpeed(Number(el.dataset.speed) as Speed)
      setFeedback(`Speed: ${el.dataset.speed}x simulated time.`)
      render()
    })
  }
  $<HTMLInputElement>('sim-leverage').addEventListener('input', (event) => {
    $('sim-lev-label').textContent = `${(event.target as HTMLInputElement).value}x`
  })
  $<HTMLSelectElement>('sim-symbol').addEventListener('change', (event) => {
    selectSymbol((event.target as HTMLSelectElement).value)
    setFeedback(`Editing ${selectedSymbol}. The other positions keep running.`)
  })
  $('sim-apply').addEventListener('click', applyPosition)
  $('sim-reset').addEventListener('click', resetSim)
  toggle.addEventListener('click', () => {
    const running = sims.some((entry) => entry.isRunning)
    for (const entry of sims) {
      if (running) entry.pause()
      else entry.start()
    }
    setFeedback(running ? 'Tape paused.' : 'Tape running.')
    render()
  })
  $('sim-tour-start').addEventListener('click', () => void startTour())
  $('sim-tour-stop').addEventListener('click', () => {
    stopTour()
    setFeedback('Tour stopped. The simulation is still yours.')
  })
  $('sim-alert').addEventListener('click', () => {
    const raw = $<HTMLInputElement>('sim-alert-price').value.replace(/,/g, '')
    armAlert(Number(raw))
  })
  $('sim-run').addEventListener('click', () => {
    handleCommand($<HTMLInputElement>('sim-command').value)
    $<HTMLInputElement>('sim-command').value = ''
  })
  $<HTMLInputElement>('sim-command').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      handleCommand((event.target as HTMLInputElement).value)
      ;(event.target as HTMLInputElement).value = ''
    }
  })
  actions.addEventListener('click', (event) => {
    const target = (event.target as HTMLElement).closest<HTMLElement>('[data-action]')
    if (!target) return
    switch (target.dataset.action) {
      case 'select-yes':
        selected = 'yes'
        setFeedback('Swipe registered: Yes. Tap to confirm.')
        render()
        break
      case 'select-no':
        selected = 'no'
        setFeedback('Default is No. Nothing was sent.')
        render()
        break
      case 'cancel':
        screen = 'position'
        preview = null
        selected = 'no'
        setFeedback('Cancelled. Nothing was sent.')
        render()
        break
      case 'execute':
        execute()
        break
      case 'dismiss':
        dismissAlert()
        break
      case 'continue':
        continueFromFill()
        break
      case 'close':
        openConfirm()
        break
      case 'cycle':
        cycle(1)
        setFeedback(`Showing ${selectedSymbol} · ${openEntries().length} open positions.`)
        render()
        break
      case 'clear-alert':
        alertPrice = null
        setFeedback('Alert cleared. Nothing was sent.')
        render()
        break
    }
  })

  // Optional browser mic; the typed command path always works.
  const Speech = (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike })
  const Recognition = Speech.SpeechRecognition ?? Speech.webkitSpeechRecognition
  if (Recognition) {
    const mic = $<HTMLButtonElement>('sim-mic')
    mic.hidden = false
    let recognition: SpeechRecognitionLike | null = null
    mic.addEventListener('click', () => {
      if (recognition) {
        recognition.stop()
        recognition = null
        mic.textContent = 'Speak'
        return
      }
      recognition = new Recognition()
      recognition.lang = 'en-US'
      recognition.interimResults = false
      recognition.maxAlternatives = 1
      mic.textContent = 'Listening…'
      recognition.onresult = (event) => {
        const transcript = event.results[0]?.[0]?.transcript ?? ''
        setFeedback(`Heard: “${transcript}”`)
        handleCommand(transcript)
      }
      recognition.onerror = () => setFeedback('Mic unavailable. Type the command instead.')
      recognition.onend = () => {
        recognition = null
        mic.textContent = 'Speak'
      }
      recognition.start()
    })
  }

  // Alert crossing and live HUD.
  window.setInterval(() => {
    const now = performance.now()
    for (const entry of sims) entry.tick(now - last)
    last = now
    const state = sim().snapshot()
    if (alertPrice !== null && alertSymbol === selectedSymbol) {
      const hit = alertAbove ? state.markPrice >= alertPrice : state.markPrice <= alertPrice
      if (hit) {
        alertPrice = null
        screen = 'alert'
        sim().pause()
        setFeedback('Alert hit. The alert is display-only; nothing was sent.')
      }
    }
    if (screen === 'position' || screen === 'alert') drawHud()
  }, 100)

  window.addEventListener('resize', fit)
  fit()
  syncForm()
  render()
  setFeedback('Simulation ready. Pick a scenario and press Start.')

  // Expose a tiny handle for screenshots/automation in local reviews.
  ;(window as unknown as { __wicksightSimulator?: unknown }).__wicksightSimulator = {
    sims,
    sim: () => sim(),
    selectedSymbol: () => selectedSymbol,
    selectSymbol,
    cycle,
    applyPosition,
    startTour,
    openConfirm,
    execute,
    armAlert,
    reset: resetSim,
    setScreen: (next: Screen) => {
      screen = next
      render()
    },
  }
}
