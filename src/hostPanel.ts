import { API_BASE, api } from './api'
import { fmtPrice, fmtQty, fmtSigned, modeLabel } from './format'
import { voxelLensSvg } from './voxel'

/**
 * Phone-side host page. The glasses UI is drawn by the Even Hub bridge, not by
 * this page. This panel exists so the operator can see connection state and
 * test the intent parser without speaking.
 */
export function mountHostPanel(): void {
  const root = document.querySelector<HTMLDivElement>('#app')
  if (!root) return

  root.innerHTML = `
    <main class="host">
      <header class="host-head">
        <div class="host-brand"><img src="/favicon.svg" alt="" /><span>WICKSIGHT</span></div>
        <span class="eyebrow"><span class="eyebrow-dot"></span>HOST PANEL · SIMULATOR</span>
      </header>

      <section class="host-hero">
        <div class="host-copy">
          <span class="eyebrow">BENCH · TESTNET</span>
          <h1>One position.<br />One screen.</h1>
          <p class="sub">
            The glasses draw the HUD. This panel is the bench: connection state and the
            same intent parser, without speaking.
          </p>
        </div>
        <div class="host-voxel">${voxelLensSvg(220)}</div>
      </section>

      <section class="host-grid">
        <div class="host-cell"><span class="host-k">API</span><span class="host-v" id="h-api">connecting…</span></div>
        <div class="host-cell"><span class="host-k">MODE</span><span class="host-v" id="h-mode">—</span></div>
        <div class="host-cell"><span class="host-k">POSITION</span><span class="host-v" id="h-pos">—</span></div>
        <div class="host-cell"><span class="host-k">ALERT</span><span class="host-v" id="h-alert">none</span></div>
      </section>

      <section class="host-card">
        <span class="eyebrow">PARSER</span>
        <h2>Test a command.</h2>
        <p class="fine">Same parser as the glasses. No audio needed.</p>
        <div class="input-row">
          <input id="h-cmd" autocomplete="off" placeholder="alert 61,500" />
          <button id="h-send" type="button">Parse</button>
        </div>
        <pre id="h-out" class="out">Try “alert 61,500” or “close half”.</pre>
      </section>

      <footer class="host-foot">
        <span>${API_BASE}</span>
        <button id="h-reset" class="ghost" type="button" hidden>Reset demo position</button>
      </footer>
    </main>
  `

  const $ = <T extends HTMLElement>(id: string) => root.querySelector<T>(`#${id}`)!
  const apiEl = $<HTMLSpanElement>('h-api')
  const modeEl = $<HTMLSpanElement>('h-mode')
  const posEl = $<HTMLSpanElement>('h-pos')
  const alertEl = $<HTMLSpanElement>('h-alert')
  const outEl = $<HTMLPreElement>('h-out')
  const input = $<HTMLInputElement>('h-cmd')
  const send = $<HTMLButtonElement>('h-send')
  const reset = $<HTMLButtonElement>('h-reset')

  let mode = ''

  async function refresh() {
    try {
      const state = await api.state()
      const p = state.position
      mode = p.mode
      apiEl.textContent = 'online'
      apiEl.dataset.ok = 'true'
      modeEl.textContent = `${modeLabel(p.mode)} · ${p.symbol}`
      posEl.textContent = p.hasPosition
        ? `${p.side} ${fmtQty(p.qty, p.qtyDecimals)} · ${fmtSigned(p.unrealizedPnl)} USDT · ${fmtPrice(p.markPrice, p.priceDecimals)}`
        : 'flat'
      alertEl.textContent = state.alert
        ? `${fmtPrice(state.alert.price, 0)} (${state.alert.direction})${state.alert.triggeredAt ? ' · hit' : ''}`
        : 'none'
      reset.hidden = mode !== 'mock'
    } catch (err) {
      apiEl.textContent = (err as Error).message
      apiEl.dataset.ok = 'false'
    }
  }

  async function parse() {
    const text = input.value.trim()
    if (!text) return
    outEl.textContent = 'Parsing…'
    try {
      const res = await api.intent(text)
      const intent = res.intent
      const summary =
        intent.type === 'alert'
          ? `alert @ ${fmtPrice(intent.price, 0)}`
          : intent.type === 'none'
            ? `${intent.reason} — ${intent.hint}`
            : intent.type
      outEl.textContent = `"${res.text}"\n→ ${summary}`
    } catch (err) {
      outEl.textContent = (err as Error).message
    }
  }

  send.addEventListener('click', () => void parse())
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') void parse()
  })

  reset.addEventListener('click', async () => {
    await fetch(`${API_BASE}/api/dev/reset`, { method: 'POST' })
    outEl.textContent = 'Demo position reset to 0.010 BTC.'
    void refresh()
  })

  void refresh()
  setInterval(() => void refresh(), 6000)
}
