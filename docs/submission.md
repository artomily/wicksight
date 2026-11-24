# DoraHacks submission — draft

Copy/paste source for the Even Realities hackathon form. Links marked `TBD`.

## Basics

- **Project name:** WickSight
- **Tagline:** See the liquidation coming. Get out of it — from your glasses.
- **Track:** 03 — Exchanges & Stocks
- **Repo:** `github.com/artomily/wicksight` (owner publishes before submission)
- **Live demo:** https://wicksight.vercel.app
- **Demo video:** `wicksight-final.mp4` — 60s key-features cut, 1080p, English voiceover + 25% music bed, captions; full cut: `wicksight-full.mp4` (2:55). Both are labelled replays of the 23 Nov testnet HUD.
- **Team:** solo

## Short description (card)

WickSight is the glanceable liquidation guard that does both halves of the job: it reads the time to liquidation (`LIQ IN ~4m at this pace · buffer 4.6%`), then acts on it — say "close half", confirm on an explicit No/Yes screen, and see the after-action receipt prove the buffer moved: `Liq 58,684 → 55,591 · buffer 4.6% → 9.6%`. Orders go to Binance Futures **testnet** from a server-side key; the glasses never see a secret. One screen, two gestures, and a receipt.

## Full description

**The problem.** In a trading session the number that matters is not the chart, it is how far price is from liquidation. Checking that means picking up the phone, unlocking it, opening the exchange, and losing the screen you were watching. Even G2 is already on your face, but until now it had no way to show a position or take a fast, safe action.

**What it does.** WickSight shows three lines on the 576×288 monochrome canvas: the position (`BTCUSDT LONG 0.010 · 20x`), the PnL in USDT with ROE, and the liquidation price with the distance in percent. A fourth line turns the distance into time when the last three minutes of mark ticks are trending toward the line: `LIQ IN ~4m at this pace · buffer 4.6%`; it hides when price is moving away, flat or too noisy. It updates every two seconds in place, without flicker. Hold the temple to talk: "alert 62,000" arms a price alert, "close half" opens a confirm screen. The confirm screen defaults to **No**; the user swipes to **Yes** and taps. The order executes on Binance Futures testnet and the fill is shown with an after-action receipt: `Liq 58,684 → 55,591 · buffer 4.6% → 9.6% · sold 0.005 @ 61,502.9`.

**Why not just a monitor?** A monitor tells you that you are close to liquidation. That is useful until the moment you need to do something about it. WickSight closes the loop on the same screen: the time-to-liquidation is followed by a voice command, a default-No confirmation, a single-use preview, and a reduce-only close-half on Binance Futures testnet. The receipt is the proof: `Liq 58,684 → 55,591 · buffer 4.6% → 9.6%`. No app switch, no phone unlock, no "now what?" at the worst possible moment.

**How Even Hub is used.** The app is a Vite + TypeScript WebView app using `@evenrealities/even_hub_sdk` 0.0.16: text containers for the HUD, `textContainerUpgrade` for live values, `rebuildPageContainer` for screens, `audioControl` + `audioEvent` for 16 kHz PCM push-to-talk, and long-press events for the gesture. The network permission whitelist points at the owner's API origin, and `app.json` declares the glasses microphone.

**The backend.** A small Fastify server holds the testnet key, keeps the position from the Binance user data stream and the mark price from a 1 s WebSocket (REST only for the initial snapshot, orders and a fallback), and owns every guard. Speech-to-text runs locally (Whisper small.en via transformers.js, ~0.7 s, no cloud); a deterministic parser turns the transcript into an intent. Order writes are a two-step flow: a preview token carrying the exact quantity (45 s TTL, single use), then execution behind a shared app token. The server re-reads the position and refuses sizes above the position or below the exchange step.

**Safety.** Testnet only: the Binance adapter refuses any host that is not `testnet.binancefuture.com` at boot; OKX runs only with its demo header. API keys never leave the server and are gitignored. Order routes require a shared app token and a CORS allowlist, so a stray page or `curl` cannot move the position. There is no custody and no auto-trading: alerts are display-only, and nothing sends an order without a swipe plus a tap. If the API is down, the HUD says so and the order path fails closed (`Order not sent · Nothing changed`).

**Why it can launch.** Even Hub has messaging, news, AI and navigation apps but no trading app, and Track 03's own example is this workflow. The path is: catalogue listing with testnet + read-only mainnet (keys with trade permission disabled), then order writing only after an exchange review. The repo runs with no keys at all using a clearly labelled mock position, so anyone can try the interaction in the simulator in two commands.

**Limits, stated honestly.** G2 shows one app at a time, so an alert only fires while WickSight is open; the confirm screen says so. The ETA is a short-window linear pace, not a liquidation forecast; it hides when the tape is noisy or moving away. This is not financial advice and never holds funds. The demo video is not live footage: it replays the recorded 23 Nov testnet HUD and says so on screen.

## Built with

Even Hub SDK 0.0.16, Vite, TypeScript, Fastify, transformers.js (Whisper small.en), Binance Futures testnet REST + WebSocket, OKX demo adapter (fallback), Even Hub simulator 0.9.3.

## Submission checklist

- [ ] Public repo + README (private until submission, owner creates)
- [ ] Demo video ≤ 3:00, fully Remotion with the labelled HUD replay
- [ ] Description pasted (above)
- [ ] Feature requests pasted (docs/feature-requests.md)
- [ ] Optional `.ehpk`: `npm run pack`
- [ ] Submit ≥ 6 h before deadline (29 Nov 23:59 Dubai = 30 Nov 02:59 WIB)
