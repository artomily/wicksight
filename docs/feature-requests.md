# Feature requests for Even Realities

Observations from building WickSight on Even Hub SDK 0.0.16 with simulator 0.9.3. Ordered by impact on a trading/alerting app.

## 1. An always-available one-line slot (complication)

**Problem.** Even G2 shows one app at a time and a backgrounded app cannot display or notify. For a price alert this is the whole product: the alert is only useful when the user is *not* looking at the app. Our alert screen can only appear if WickSight is already the foreground app.

**Ask.** An opt-in "complication" slot — one line of text (or a small 576×32 strip) that a whitelisted app can update at a low cadence (e.g. once a minute) while another app is in front. User-controlled, revocable per app, with a visible indicator. Alternatively, a narrowly scoped notification API for price/alert apps, rate-limited and user-approved.

**Why it matters.** It turns any monitoring app from a toy into something you can leave running. It is also the difference between "check your position" and "be told when it matters".

## 2. A stable tap contract

**Problem.** On SDK 0.0.16 + simulator 0.9.3, a single tap on a text container arrives as `event.sysEvent` with `eventType` omitted (0) and `eventSource` set — no `containerID`. The docs describe taps on the capturing container as `event.textEvent` with `CLICK_EVENT`. Apps written to the docs silently do nothing on a tap. We had to handle both channels and treat a `sysEvent` with `eventSource` and no `eventType` as a tap.

For list containers, a click in the simulator delivered a `listEvent` with neither `eventType` nor `currentSelectItemIndex`, so the app could not tell which row was chosen. We replaced native lists with our own two-row selection screen.

**Ask.** Guarantee and document one canonical tap event that always carries `containerID`, `eventSource` and `eventType: 0`; keep `textEvent` as a compatibility alias. For lists, always include `currentSelectItemIndex` (and an `itemID`) on click, and document whether a selection notification is emitted on rebuild.

## 3. Microphone state and level

**Problem.** `audioControl(true)` returns a boolean. It cannot distinguish "permission denied", "busy", "no device" from "open but silent". We render a `Listening` screen with no way to know whether audio is actually flowing, and a silent recording only surfaces as an empty transcript several seconds later.

**Ask.** `getAudioState(): 'idle' | 'requesting' | 'open' | 'denied' | 'busy' | 'error'` plus a lightweight RMS/level in the audio event (one number per 100 ms buffer). Both are enough to render a real level meter and fail loudly instead of silently.

## 4. Two type sizes and numeric alignment

**Problem.** The display has one LVGL font, no size control and no alignment. On a 576×288 canvas, a dashboard's most important number cannot be made larger than its label; every line has the same weight. We used vertical spacing and text brightness to build hierarchy, which works but is a workaround.

**Ask.** A second, larger numeric size (or a `largeNumber` text container) and right-alignment for numeric fields. For any finance, fitness or navigation app, the glanceable hierarchy is the product.

## 5. Simulator audio injection (and a reload endpoint)

**Problem.** Voice is the core interaction, but the simulator's automation API cannot inject PCM. CI can drive taps and screenshots, not a spoken command; on macOS the simulator also needs a TCC microphone grant, which headless runs cannot obtain, so audio arrives as silence. Separately, a WebView reload leaves the native page in place, so `createStartUpPageContainer` returns `invalid` on the second load — which breaks hot-reload testing and looks like an app bug.

**Ask.** `POST /api/audio` accepting 16 kHz PCM16 (or a WAV) and feeding it to `audioEvent` exactly like the mic; a `--simulate-mic-permission=denied|granted` flag; and `POST /api/app/reload` that tears down the native page so a fresh `createStartUpPageContainer` succeeds.

---

Built for Track 03 (Exchanges & Stocks). Testnet only — no mainnet path exists in the code.
