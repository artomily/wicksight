import { seconds } from './timeline'

export interface Caption {
  from: number
  to: number
  text: string
}

/**
 * Every VO line, on screen. Judges may watch muted; these carry the story.
 * Times are absolute frames at 30 fps.
 *
 * Proof beats: 35–49 hud · 49–65 voice · 65–77 alert · 77–90 eta ·
 * 90–106 confirm · 106–118 fill · 118–130 receipt.
 */
export const CAPTIONS: Caption[] = [
  // Hook 0:00 – 0:15
  { from: seconds(0.4), to: seconds(3), text: "You're in a trade." },
  { from: seconds(3), to: seconds(6.4), text: 'The number that decides your night' },
  { from: seconds(6.4), to: seconds(10), text: 'is how far price is from liquidation.' },
  { from: seconds(10), to: seconds(12.6), text: 'Checking it costs you the setup.' },
  { from: seconds(12.6), to: seconds(14.8), text: 'This is WickSight.' },

  // Reveal 0:15 – 0:35
  { from: seconds(15.4), to: seconds(18.4), text: 'One screen. Three lines.' },
  { from: seconds(18.4), to: seconds(21.2), text: 'Position. PnL. Distance to liquidation.' },
  { from: seconds(21.2), to: seconds(25), text: 'On Even G2, in your line of sight.' },
  { from: seconds(25), to: seconds(29.5), text: 'Nothing to scroll. Nothing to unlock.' },
  { from: seconds(29.5), to: seconds(34.6), text: 'Hold the temple, and speak.' },

  // Proof 1 · HUD 0:35 – 0:49
  { from: seconds(35.4), to: seconds(38.6), text: 'Recorded on Binance testnet. Replayed here.' },
  { from: seconds(38.6), to: seconds(42.2), text: 'One position, always in view.' },
  { from: seconds(42.2), to: seconds(45.6), text: 'PnL, distance, and the line that matters.' },
  { from: seconds(45.6), to: seconds(48.8), text: 'Glance, and stay in the trade.' },

  // Proof 2 · Voice 0:49 – 1:05
  { from: seconds(49.4), to: seconds(52.6), text: 'Hold the temple. Speak.' },
  { from: seconds(52.6), to: seconds(56.6), text: '"Alert 61,500."' },
  { from: seconds(56.6), to: seconds(60.6), text: 'Armed while the app is open.' },
  { from: seconds(60.6), to: seconds(64.8), text: 'No typing. No app switching.' },

  // Proof 3 · Alert 1:05 – 1:17
  { from: seconds(65.4), to: seconds(69.4), text: 'When price crosses, the screen changes.' },
  { from: seconds(69.4), to: seconds(72.6), text: 'Current price.' },
  { from: seconds(72.6), to: seconds(75.6), text: 'Room left before liquidation.' },
  { from: seconds(75.6), to: seconds(76.8), text: 'One tap back.' },

  // Proof 4 · ETA 1:17 – 1:30
  { from: seconds(77.4), to: seconds(81.4), text: 'Distance is not time.' },
  { from: seconds(81.4), to: seconds(85.4), text: 'LIQ IN ~4m at this pace.' },
  { from: seconds(85.4), to: seconds(89.8), text: 'Hidden when price moves away or the tape is noise.' },

  // Proof 5 · Confirm 1:30 – 1:46
  { from: seconds(90.4), to: seconds(94.4), text: 'Now the part that has to be safe.' },
  { from: seconds(94.4), to: seconds(98.4), text: 'Hold. "Close half."' },
  { from: seconds(98.4), to: seconds(102.4), text: 'The default is No.' },
  { from: seconds(102.4), to: seconds(105.8), text: 'Swipe to Yes. Then tap.' },

  // Proof 6 · Fill 1:46 – 1:58
  { from: seconds(106.4), to: seconds(109.8), text: 'The order goes to Binance Futures testnet.' },
  { from: seconds(109.8), to: seconds(113.6), text: 'Filled. Half the position closed.' },
  { from: seconds(113.6), to: seconds(117.8), text: 'Reduce-only. A signed, single-use preview.' },

  // Proof 7 · Receipt 1:58 – 2:10
  { from: seconds(118.4), to: seconds(122.4), text: 'The action moved the risk.' },
  { from: seconds(122.4), to: seconds(126.4), text: 'Liq 58,684 → 55,591.' },
  { from: seconds(126.4), to: seconds(129.8), text: 'Buffer 4.6% → 9.6%. The receipt.' },

  // Safety 2:10 – 2:40
  { from: seconds(130.4), to: seconds(133.6), text: 'Testnet only.' },
  { from: seconds(133.6), to: seconds(138), text: 'Binance rejects any host that is not the testnet.' },
  { from: seconds(138), to: seconds(142.6), text: 'Keys live on the server, never in the app.' },
  { from: seconds(142.6), to: seconds(147.4), text: 'Every order needs the app token, a preview, and a Yes.' },
  { from: seconds(147.4), to: seconds(152.2), text: 'Mark price over WebSocket. REST only when needed.' },
  { from: seconds(152.2), to: seconds(157.4), text: 'Built for the session, not the phone screen.' },

  // CTA 2:40 – 2:55
  { from: seconds(160.4), to: seconds(164), text: 'WickSight.' },
  { from: seconds(164), to: seconds(168), text: 'Track 03 — Exchanges & Stocks.' },
  { from: seconds(168), to: seconds(171.6), text: 'One position. One screen. Act in seconds.' },
  { from: seconds(171.6), to: seconds(174.6), text: 'github.com/artomily/wicksight' },
]
