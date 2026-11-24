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
 * Cold open 0–10 · hook 10–25 · reveal 25–45 · proof 45–140 ·
 * safety 140–165 · CTA 165–179.
 */
export const CAPTIONS: Caption[] = [
  // Cold open 0:00 – 0:10
  { from: seconds(0.4), to: seconds(3.0), text: 'LIQ IN ~4m at this pace.' },
  { from: seconds(3.0), to: seconds(5.0), text: '"Close half."' },
  { from: seconds(5.0), to: seconds(6.4), text: 'Default No. Swipe to Yes.' },
  { from: seconds(6.4), to: seconds(8.4), text: 'Buffer 4.6% → 9.6%.' },
  { from: seconds(8.4), to: seconds(9.8), text: 'That is the difference.' },

  // Hook 0:10 – 0:25
  { from: seconds(10.4), to: seconds(13.0), text: "You're in a trade." },
  { from: seconds(13.0), to: seconds(16.4), text: 'The number that decides your night' },
  { from: seconds(16.4), to: seconds(20.0), text: 'is how far price is from liquidation.' },
  { from: seconds(20.0), to: seconds(22.6), text: 'Checking it costs you the setup.' },
  { from: seconds(22.6), to: seconds(24.8), text: 'This is WickSight.' },

  // Reveal 0:25 – 0:45
  { from: seconds(25.4), to: seconds(28.4), text: 'One screen. Three lines.' },
  { from: seconds(28.4), to: seconds(31.2), text: 'Position. PnL. Distance to liquidation.' },
  { from: seconds(31.2), to: seconds(35.0), text: 'On Even G2, in your line of sight.' },
  { from: seconds(35.0), to: seconds(39.5), text: 'Nothing to scroll. Nothing to unlock.' },
  { from: seconds(39.5), to: seconds(44.6), text: 'Hold the temple, and speak.' },

  // Proof 1 · HUD 0:45 – 0:59
  { from: seconds(45.4), to: seconds(48.6), text: 'Recorded on Binance testnet. Replayed here.' },
  { from: seconds(48.6), to: seconds(52.2), text: 'One position, always in view.' },
  { from: seconds(52.2), to: seconds(55.6), text: 'PnL, distance, and the line that matters.' },
  { from: seconds(55.6), to: seconds(58.8), text: 'Glance, and stay in the trade.' },

  // Proof 2 · Voice 0:59 – 1:15
  { from: seconds(59.4), to: seconds(62.6), text: 'Hold the temple. Speak.' },
  { from: seconds(62.6), to: seconds(66.6), text: '"Alert 61,500."' },
  { from: seconds(66.6), to: seconds(70.6), text: 'Armed while the app is open.' },
  { from: seconds(70.6), to: seconds(74.8), text: 'No typing. No app switching.' },

  // Proof 3 · Alert 1:15 – 1:27
  { from: seconds(75.4), to: seconds(79.4), text: 'When price crosses, the screen changes.' },
  { from: seconds(79.4), to: seconds(82.6), text: 'Current price.' },
  { from: seconds(82.6), to: seconds(85.6), text: 'Room left before liquidation.' },
  { from: seconds(85.6), to: seconds(86.8), text: 'One tap back.' },

  // Proof 4 · ETA 1:27 – 1:40
  { from: seconds(87.4), to: seconds(91.4), text: 'Distance is not time.' },
  { from: seconds(91.4), to: seconds(95.4), text: 'LIQ IN ~4m at this pace.' },
  { from: seconds(95.4), to: seconds(99.8), text: 'Hidden when price moves away or the tape is noise.' },

  // Proof 5 · Confirm 1:40 – 1:56
  { from: seconds(100.4), to: seconds(104.4), text: 'Now the part that has to be safe.' },
  { from: seconds(104.4), to: seconds(108.4), text: 'Hold. "Close half."' },
  { from: seconds(108.4), to: seconds(112.4), text: 'The default is No.' },
  { from: seconds(112.4), to: seconds(115.8), text: 'Swipe to Yes. Then tap.' },

  // Proof 6 · Fill 1:56 – 2:08
  { from: seconds(116.4), to: seconds(119.8), text: 'The order goes to Binance Futures testnet.' },
  { from: seconds(119.8), to: seconds(123.6), text: 'Filled. Half the position closed.' },
  { from: seconds(123.6), to: seconds(127.8), text: 'Reduce-only. A signed, single-use preview.' },

  // Proof 7 · Receipt 2:08 – 2:20
  { from: seconds(128.4), to: seconds(132.4), text: 'The action moved the risk.' },
  { from: seconds(132.4), to: seconds(136.4), text: 'Liq 58,684 → 55,591.' },
  { from: seconds(136.4), to: seconds(139.8), text: 'Buffer 4.6% → 9.6%. The receipt.' },

  // Safety 2:20 – 2:45
  { from: seconds(140.4), to: seconds(143.6), text: 'Testnet only.' },
  { from: seconds(143.6), to: seconds(147.6), text: 'Binance rejects any host that is not the testnet.' },
  { from: seconds(147.6), to: seconds(151.6), text: 'Keys live on the server, never in the app.' },
  { from: seconds(151.6), to: seconds(156.0), text: 'Every order needs the app token, a preview, and a Yes.' },
  { from: seconds(156.0), to: seconds(160.4), text: 'Mark price over WebSocket. REST only when needed.' },
  { from: seconds(160.4), to: seconds(164.6), text: 'Built for the session, not the phone screen.' },

  // CTA 2:45 – 2:59
  { from: seconds(165.4), to: seconds(168.0), text: 'WickSight.' },
  { from: seconds(168.0), to: seconds(171.0), text: 'Track 03 — Exchanges & Stocks.' },
  { from: seconds(171.0), to: seconds(174.6), text: 'One position. One screen. Act in seconds.' },
  { from: seconds(174.6), to: seconds(178.4), text: 'github.com/artomily/wicksight' },
]
