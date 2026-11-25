import { API_BASE, api } from './api'
import { fmtPrice, modeLabel } from './format'
import { voxelLensSvg } from './voxel'

/**
 * Phone-side host page. The glasses UI is drawn by the Even Hub bridge, not by
 * this page. This panel exists so the operator can see connection state, the
 * key-safety posture, background alert pairing, and test the intent parser.
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
          <h1>Every position.<br />The riskiest first.</h1>
          <p class="sub">
            The glasses draw one HUD. This panel is the bench: connection state,
            key safety, background alerts, and the same intent parser, without speaking.
          </p>
        </div>
        <div class="host-voxel">${voxelLensSvg(220)}</div>
      </section>

      <section class="host-grid">
        <div class="host-cell"><span class="host-k">API</span><span class="host-v" id="h-api">connecting…</span></div>
        <div class="host-cell"><span class="host-k">MODE</span><span class="host-v" id="h-mode">—</span></div>
        <div class="host-cell"><span class="host-k">RISK ORDER</span><span class="host-v" id="h-risk">—</span></div>
        <div class="host-cell"><span class="host-k">OPEN · ALERT</span><span class="host-v" id="h-open">— · none</span></div>
      </section>

      <section class="host-card">
        <span class="eyebrow">PARSER</span>
        <h2>Test a command.</h2>
        <p class="fine">Same parser as the glasses. No audio needed. Close half targets the riskiest position.</p>
        <div class="input-row">
          <input id="h-cmd" autocomplete="off" placeholder="alert 61,500" />
          <button id="h-send" type="button">Parse</button>
        </div>
        <pre id="h-out" class="out">Try “alert 61,500” or “close half”.</pre>
      </section>

      <section class="host-card">
        <span class="eyebrow">SECURITY · API KEYS</span>
        <h2>Keys that cannot move funds.</h2>
        <div class="host-kv" id="h-security">
          <span>Checking the exchange permission endpoint…</span>
        </div>
        <p class="fine">
          Read-only + futures trade only. Withdrawals are refused at boot. Use a
          sub-account with an IP whitelist; testnet remains the default.
        </p>
      </section>

      <section class="host-card">
        <span class="eyebrow">BACKGROUND ALERTS · TELEGRAM</span>
        <h2>When the app is closed.</h2>
        <div class="host-kv" id="h-telegram">
          <span>Checking Telegram…</span>
        </div>
        <div class="input-row">
          <button id="h-telegram-test" type="button" hidden>Send mock alert</button>
        </div>
        <p class="fine">
          The server watches ETA and buffer on every position tick. Pair with
          <code>/start</code>; the bot only notifies and links back to the glasses
          confirmation. It never places an order.
        </p>
      </section>

      <footer class="host-foot">
        <span>${API_BASE}</span>
        <button id="h-reset" class="ghost" type="button" hidden>Reset demo positions</button>
      </footer>
    </main>
  `

  const $ = <T extends HTMLElement>(id: string) => root.querySelector<T>(`#${id}`)!
  const apiEl = $<HTMLSpanElement>('h-api')
  const modeEl = $<HTMLSpanElement>('h-mode')
  const riskEl = $<HTMLSpanElement>('h-risk')
  const openEl = $<HTMLSpanElement>('h-open')
  const outEl = $<HTMLPreElement>('h-out')
  const securityEl = $<HTMLDivElement>('h-security')
  const telegramEl = $<HTMLDivElement>('h-telegram')
  const telegramTest = $<HTMLButtonElement>('h-telegram-test')
  const input = $<HTMLInputElement>('h-cmd')
  const send = $<HTMLButtonElement>('h-send')
  const reset = $<HTMLButtonElement>('h-reset')

  let mode = ''

  async function refresh() {
    try {
      const [state, security] = await Promise.all([api.state(), api.security()])
      const p = state.position
      mode = p.mode
      apiEl.textContent = 'online'
      apiEl.dataset.ok = 'true'
      modeEl.textContent = `${modeLabel(p.mode)} · ${p.symbol}`
      riskEl.textContent = state.header
      riskEl.title = state.positions
        .filter((entry) => entry.position.hasPosition)
        .map((entry) => `${entry.position.symbol} ${entry.position.distanceToLiqPct?.toFixed(1) ?? '—'}%`)
        .join(' · ')
      const open = state.positions.filter((entry) => entry.position.hasPosition)
      const alert = state.alert
      openEl.textContent = `${open.length} open · ${
        alert
          ? `${alert.symbol} ${fmtPrice(alert.price, 0)}${alert.triggeredAt ? ' hit' : ''}`
          : 'no alert'
      }`
      reset.hidden = mode !== 'mock'
      renderSecurity(security)
      renderTelegram(security.telegram)
    } catch (err) {
      apiEl.textContent = (err as Error).message
      apiEl.dataset.ok = 'false'
      securityEl.innerHTML = '<span>Security status unavailable while the API is offline.</span>'
      telegramEl.innerHTML = '<span>Telegram status unavailable while the API is offline.</span>'
      telegramTest.hidden = true
    }
  }

  function renderSecurity(security: Awaited<ReturnType<typeof api.security>>) {
    const s = security.keySafety
    const rows: string[] = [
      `<span>Mode</span><b>${security.testnetOnly ? 'testnet / paper' : 'MAINNET OPT-IN'}</b>`,
    ]
    if (s) {
      rows.push(
        `<span>Withdrawals</span><b data-ok="${String(s.withdrawals !== true)}">${
          s.withdrawals === true ? 'ENABLED — REFUSED' : s.withdrawals === false ? 'disabled' : 'unverified'
        }</b>`,
      )
      rows.push(
        `<span>Futures trade</span><b data-ok="${String(s.futures !== false)}">${
          s.futures === true ? 'enabled' : s.futures === false ? 'missing — REFUSED' : 'unverified'
        }</b>`,
      )
      rows.push(
        `<span>IP whitelist</span><b data-ok="${String(s.ipRestrict !== false)}">${
          s.ipRestrict === true ? 'on' : s.ipRestrict === false ? 'recommended' : 'unverified'
        }</b>`,
      )
      if (s.warning) rows.push(`<span>Note</span><b>${escapeHtml(s.warning)}</b>`)
    } else {
      rows.push('<span>Key check</span><b>not applicable (mock/OKX)</b>')
    }
    if (security.mainnetOptIn) {
      rows.push('<span>Warning</span><b>ALLOW_MAINNET=1 — real funds</b>')
    }
    securityEl.innerHTML = rows.join('')
  }

  function renderTelegram(status: Awaited<ReturnType<typeof api.security>>['telegram']) {
    if (!status) {
      telegramEl.innerHTML = '<span>Telegram is disabled on this server.</span>'
      telegramTest.hidden = true
      return
    }
    const pair =
      status.mode === 'mock'
        ? 'mock mode — no token'
        : status.paired
          ? `paired · ${status.chatIdMasked ?? ''}`
          : 'waiting for /start'
    const latest = status.recent.at(-1)
    telegramEl.innerHTML = [
      `<span>Delivery</span><b>${status.mode} · ${pair}</b>`,
      `<span>Thresholds</span><b>ETA &lt; ${status.thresholds.minutes}m · buffer &lt; ${status.thresholds.bufferPct}%</b>`,
      latest ? `<span>Last alert</span><b>${escapeHtml(latest.text.split('\n')[0] ?? '')}</b>` : '',
    ].join('')
    telegramTest.hidden = status.mode !== 'mock'
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

  telegramTest.addEventListener('click', async () => {
    telegramTest.disabled = true
    try {
      await api.telegramTest()
      outEl.textContent = 'Mock Telegram alert queued. Check the server log and the card above.'
      await refresh()
    } catch (err) {
      outEl.textContent = (err as Error).message
    } finally {
      telegramTest.disabled = false
    }
  })

  reset.addEventListener('click', async () => {
    await fetch(`${API_BASE}/api/dev/reset`, { method: 'POST' })
    outEl.textContent = 'Demo positions reset to BTC, ETH, and SOL.'
    void refresh()
  })

  void refresh()
  setInterval(() => void refresh(), 6000)
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char)
}
