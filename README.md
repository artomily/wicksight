# Session Guard

A glanceable position guard for **Even G2**, built for the Even Realities hackathon, **Track 03 — Exchanges & Stocks**.

You look at your position, not your phone. Three lines on the glasses: position, PnL, distance to liquidation. Hold the temple and say **"alert 62,000"** or **"close half"**. Every order needs an explicit **No / Yes** confirmation. Testnet only.

```
● BINANCE TESTNET · 20x

BTCUSDT LONG 0.010 · 20x

PnL +9.64 USDT · ROE +30.5%

Liq 60,279.60 · 5.9% away

Hold: speak · 2x exit
```

| Glance | Confirm (default No) | Filled |
|---|---|---|
| ![](docs/img/position.png) | ![](docs/img/confirm.png) | ![](docs/img/filled.png) |

*Simulator capture with the mock position (no keys needed). With testnet keys the status line reads `BINANCE TESTNET`.*

## Why

Trading sessions are exactly the moment a heads-up display earns its place: you are watching one number, your hands are busy, and looking down at a phone costs attention. Session Guard is not a trading terminal. It is one screen you can read in a glance and two commands you can say in a second.

## Demo flow (20 seconds)

1. The glasses show the open position, live PnL and liquidation distance.
2. Hold the temple → **"alert 62,000"** → release. The alert is armed while the app is open.
3. Hold again → **"close half"** → the confirm screen shows **No, keep 0.010** and **Yes, sell 0.005**.
4. Swipe to **Yes**, tap. The order goes to Binance Futures **testnet** and the fill is shown.
5. Price alert hits → the screen switches to **ALERT HIT** until you tap.

## Who it's for

Active crypto-futures traders who already wear G2 for notifications and navigation, and prop-desk traders who keep one position open through a session. The first version is deliberately single-position: the person who needs this has one trade they care about, not a portfolio to manage from their glasses.

**Why now.** Track 03's own example is this exact flow, and the Even Hub catalogue has messaging, news, AI and navigation apps but no trading app. Testnet-only keeps the first release away from custody and away from financial advice.

**Launch path.**

1. Even Hub catalogue listing — testnet and read-only mainnet.
2. Read-only mainnet: position, PnL and liquidation only; API keys with trade permission disabled.
3. Order writing stays behind an explicit exchange/broker review. Session Guard never holds funds.

## Safety model

This is the part that matters for a trading app.

| Risk | How it is handled |
|---|---|
| Mainnet / real funds | The Binance adapter refuses to boot against any host that is not the testnet. The OKX adapter always sends the `x-simulated-trading: 1` header — demo only. There is no mainnet code path. |
| API keys | Only in the server's `.env`. Never sent to the WebView, never logged, never committed (`.gitignore`). |
| Accidental order | Voice only creates a **preview**. Executing requires a second gesture: swipe to **Yes**, then tap. The default selection is **No**. |
| Double execution | The preview ID is single-use, bound to the exact quantity, and expires after 45 s. A second tap cannot send the same order twice. |
| Stale quantity | The server re-reads the position before sending and refuses an order larger than the open position or below the exchange step size. |
| Rate limits | Client backs off for 15 s on `-1003` / 429 instead of hammering the testnet. |
| Auto-trading | There is none. Alerts are display-only; nothing fires an order without a human. |
| Data | One position, read from the user's own exchange account. No analytics, no third-party sharing. |

Alerts only fire **while the app is open** — Even G2 shows one app at a time and cannot push in the background. The UI says so on the alert confirmation screen.

## Architecture

```
Even G2 (or the Even Hub simulator)
└── WebView app — Vite + TypeScript + @evenrealities/even_hub_sdk
    ├── 3-line HUD (576×288), textContainerUpgrade for live values
    ├── push-to-talk: 16 kHz PCM16 from the glasses mic
    └── fetch → Session Guard API (whitelisted origin in app.json)
                 │
                 ├── POST /api/voice     PCM → Whisper tiny.en → intent
                 ├── GET  /api/state     position + alert, polled every 2 s
                 ├── POST /api/orders/preview   exact qty + token
                 └── POST /api/orders/execute   single-use token
                              │
                    Binance Futures TESTNET (default)
                    OKX demo (adapter fallback)
                    Mock paper position (no keys, labelled "MOCK DATA")
```

The phone-side page in the simulator (and the WebView on real hardware) shows connection state and a text box that exercises the same intent parser — useful when a demo room is too loud.

## Run it

Prerequisites: Node 20+, npm, the Even Hub CLI and simulator.

```bash
npm install -g @evenrealities/evenhub-cli @evenrealities/evenhub-simulator
```

```bash
git clone <your-fork> session-guard && cd session-guard
npm install
cp .env.example .env
```

### 1. Testnet keys (no real money)

1. Open <https://testnet.binancefuture.com> and sign in.
2. Create an API key (Wallet → API Key). Testnet keys only work on testnet.
3. Put them in `.env`:

```dotenv
EXCHANGE=binance
BINANCE_API_KEY=...
BINANCE_API_SECRET=...
SYMBOL=BTCUSDT
```

4. Verify access without placing an order:

```bash
npm run check
```

Expected: `OK — endpoint reachable and signed request accepted.` and the current testnet position.

### 2. Start it

```bash
npm run dev      # Vite on :5173 + API on :8787
npm run sim      # second terminal: evenhub-simulator http://localhost:5173
```

The glasses canvas should show the position. Hold the simulator's press control to talk (macOS will ask for microphone permission for your terminal — allow it).

### 3. No keys? Mock mode

With no keys, `EXCHANGE=auto` falls back to a deterministic paper position and the HUD clearly says **MOCK DATA**. Every screen and order path works; nothing leaves your machine.

```bash
curl -X POST localhost:8787/api/dev/reset   # put the demo position back
```

While developing, `?demo=confirm`, `?demo=listening` and `?demo=alert` open those screens directly in a dev build (`import.meta.env.DEV` only).

## Voice

Speech-to-text runs **locally** by default: `onnx-community/whisper-small.en` (q8) inside the Node process via `@huggingface/transformers`. No API key, no audio leaves the machine. The model downloads once (~250 MB) and is warmed at boot; a short command transcribes in ~0.7 s. Set `ASR_MODEL=onnx-community/whisper-tiny.en` for a 40 MB model (~0.25 s) if you accept weaker number recognition.

```dotenv
ASR_PROVIDER=local     # or openai
OPENAI_API_KEY=        # only if ASR_PROVIDER=openai
```

Commands understood:

| Say | Result |
|---|---|
| "alert 62,000" / "alert at sixty two thousand" | arms a price alert (above or below, derived from the market) |
| "close half" / "close half of the position" | opens the confirm screen |
| "cancel the alert" | clears it |
| "close all" | refused on purpose — only half is enabled |

`npm run check` shows the exchange path. `POST /api/intent {"text":"..."}` exercises the parser without audio.

## Packaging and deployment (optional)

`npm run pack` produces `out.ehpk` (manifest + built `dist`). To run on real glasses the API needs a public HTTPS origin with CORS enabled; add that origin to the `network` whitelist in `app.json`. Keep the testnet keys on that server, never in the app bundle.

The repo is deliberately **local-first**: judges and the owner can run the whole demo with `npm run dev` and the mock adapter, no keys, no hosting. The API binds to `127.0.0.1` by default; set `HOST=0.0.0.0` only when a phone on the LAN must reach it, and restrict CORS before exposing it publicly.

## Project layout
```
src/
  main.ts        screen state machine, bridge events, polling, voice flow
  ui.ts          every page as plain container specs (576×288)
  audio.ts       push-to-talk PCM recorder
  api.ts         typed client for the local API
  hostPanel.ts   phone-side status + parser test box
server/
  index.ts       Fastify routes, CORS, order guards
  exchange/      binance.ts (testnet), okx.ts (demo), mock.ts
  asr.ts         local Whisper / optional OpenAI
  intents.ts     deterministic voice intent parser
  store.ts       alert state + single-use order previews
shared/types.ts  the JSON contract both sides use
scripts/check-exchange.ts   setup doctor
docs/            demo script + feature requests
```

## Tests

`npm test` runs 21 checks with no network and no keys: intent parsing (spoken numbers, percent phrasing, refusal of "close all"), step-size flooring, single-use confirmation tokens, alert arming, the non-testnet host guard, and a stubbed Binance testnet that verifies request signing, the reduce-only order payload and error mapping.

```bash
npm test
```

## Bench notes

- Display: 576×288, one LVGL font, no size/alignment control. Layout is spacing and brightness, measured at a 27 px line pitch.
- The SDK delivers a single tap as a `sysEvent` with `eventType` 0 omitted (SDK 0.0.16 + simulator 0.9.x). The app handles both that and the documented `textEvent` click.
- No background. Polling stops when the WebView is suspended; the HUD refreshes on foreground.
- The simulator is not an emulator; timing, BLE and mic permission differ on hardware.

## Built during the hackathon

Everything in this repo was written during the Even Realities hackathon (23–29 Nov 2026). Pre-existing: the official Even Hub SDK, CLI, simulator and Vite. The Whisper model is a public Hugging Face checkpoint.

Track 03 — Exchanges & Stocks. Testnet only. Not financial advice.

## Docs

- [3-minute demo script](docs/demo-script.md)
- [Feature requests for Even Realities](docs/feature-requests.md)
