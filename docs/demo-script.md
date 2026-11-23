# 3-minute demo script

Target: **2:55**. Record in the Even Hub simulator at 576×288, screen-recorded cleanly; voice live.

## Before recording (10 minutes)

- [ ] `.env` has **testnet** keys; `npm run check:live` says `mode: binance-testnet` with the position open (not `mock`, not `flat`).
- [ ] One open position on Binance Futures testnet (e.g. 0.010 BTCUSDT long, 20x). Note the liquidation price. `npm run check:live` must show it.
- [ ] `npm run dev` and `evenhub-simulator http://localhost:5173 --automation-port 9898` running.
- [ ] macOS microphone permission granted to the terminal running the simulator (System Settings → Privacy & Security → Microphone). Test one command before recording.
- [ ] Simulator window at a readable size; hide desktop icons, notifications, other windows.
- [ ] Reset the demo position: `curl -X POST localhost:8787/api/dev/reset` (mock only).
- [ ] Record at 1080p or higher; crop/zoom the 576×288 canvas so text is legible on a phone screen.
- [ ] Say the commands out loud twice as practice. Keep the mic close.

## Shot list

### 0:00 — 0:15 · Hook

**Visual:** the three-line HUD, live PnL ticking.

**VO:** "You're in a trade. The number that decides whether you sleep tonight is how far price is from liquidation. Checking that on your phone costs you the setup. This is Session Guard, on Even G2."

### 0:15 — 0:45 · The glance

**Visual:** slow push-in on the HUD. Point at each line.

**VO:** "One screen. Three lines. The position: BTCUSDT long, a tenth of a BTC, twenty times. The PnL: plus nine dollars and change, thirty percent return on margin. And the one that matters: liquidation is five point nine percent away. That is it. No charts, no order book, nothing to scroll."

**On screen:**
```
● BINANCE TESTNET · 20x
BTCUSDT LONG 0.010 · 20x
PnL +9.64 USDT · ROE +30.5%
Liq 60,279.60 · 5.9% away
```

### 0:45 — 1:10 · Alert by voice

**Visual:** hold the temple control → `Listening` screen → say the command → release → `Alert set`.

**VO:** "Price alerts are the reason you look at your phone at all. Hold the temple…" *(hold)* "…say 'alert sixty-two thousand'…" *(release)* "…and it's armed. No typing, no app switching."

**On screen:** `Listening` → `Alert set · 62,000 · Fires below`.

### 1:10 — 1:30 · Trigger

**Visual:** HUD; price crosses the alert; screen switches to `ALERT HIT`. Tap dismisses.

**VO:** "When it hits, the screen changes. Current price, and how much room is left before liquidation. One tap, back to the position."

*(If the testnet price won't cooperate, set the alert two dollars from the mark before recording and let it fire on camera. Do not fake it.)*

### 1:30 — 2:25 · The action (the important part)

**Visual:** HUD → hold → say "close half" → release → confirm screen.

**VO:** "Now the part that has to be safe. Same gesture: hold, 'close half', release."

**Visual:** confirm screen. Point at the default **No, keep 0.010**, then swipe to **Yes, sell 0.005**, pause, tap.

**VO:** "The default is No. To send anything I have to swipe to Yes, then tap. Two deliberate gestures. The quantity in that row is the exact quantity the server will send — it is a signed, single-use preview. It expires in forty-five seconds. If I tap twice, nothing doubles."

**Visual:** `FILLED` screen with the fill price and remaining size.

**VO:** "The order goes to Binance Futures testnet from a small local server. The API secret never touches the glasses. And when this ships, it still cannot reach mainnet — the adapter refuses to boot against a production host."

### 2:25 — 2:50 · Under the hood

**Visual:** cut to a simple diagram (or terminal): WebView → API → testnet. Show `npm run check` + the repo tree for 5 seconds.

**VO:** "The glasses app is TypeScript on the Even Hub SDK. Voice is Whisper, running locally, no cloud. The server holds the key, keeps the position on a WebSocket and owns the order guard. The whole read path is one cached request; the write path is one confirmation token."

### 2:50 — 3:00 · Close

**Visual:** HUD, alert armed, then the repo URL.

**VO:** "One position. One screen. Act in seconds — without leaving the trade. Session Guard, Track 03."

## Fallbacks

- **Mic fails on camera:** stop, fix the permission, re-record the take. Do not type the command and pretend it was voice.
- **Testnet down / rate-limited:** switch `EXCHANGE=okx` demo or `EXCHANGE=mock` and say so on camera — the HUD label changes to `OKX DEMO` / `MOCK DATA`. Honesty is part of the safety score.
- **Price alert won't trigger:** set it three dollars from the mark; the mock adapter oscillates every few seconds, and the testnet moves enough during a 30-second setup.
- **Order rejected:** show it. The error screen says `Order not sent · Nothing changed`. That is a feature.

## Export

- 1920×1080, H.264, ≤ 3:00.
- Burn in four captions: `glance`, `voice`, `confirm`, `testnet`.
- First frame: the HUD, not a logo. Judges decide in 5 seconds.
