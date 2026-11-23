import { seconds } from './timeline'

export interface Caption {
  from: number
  to: number
  text: string
}

/**
 * Every VO line, on screen. Judges may watch muted; these carry the story.
 * Times are absolute frames at 30 fps.
 */
export const CAPTIONS: Caption[] = [
  // Hook 0:00 – 0:15
  { from: seconds(0.4), to: seconds(3), text: "You're in a trade." },
  { from: seconds(3), to: seconds(6.4), text: 'The number that decides your night' },
  { from: seconds(6.4), to: seconds(10), text: 'is how far price is from liquidation.' },
  { from: seconds(10), to: seconds(12.6), text: 'Checking it costs you the setup.' },
  { from: seconds(12.6), to: seconds(14.8), text: 'This is Session Guard.' },

  // Reveal 0:15 – 0:35
  { from: seconds(15.4), to: seconds(18.4), text: 'One screen. Three lines.' },
  { from: seconds(18.4), to: seconds(21.2), text: 'Position. Live PnL. Distance to liquidation.' },
  { from: seconds(21.2), to: seconds(25), text: 'On Even G2, in your line of sight.' },
  { from: seconds(25), to: seconds(29.5), text: 'Nothing to scroll. Nothing to unlock.' },
  { from: seconds(29.5), to: seconds(34.6), text: 'Hold the temple, and speak.' },

  // Proof 1 · HUD 0:35 – 0:53
  { from: seconds(35.4), to: seconds(39.4), text: 'One position, always in view.' },
  { from: seconds(39.4), to: seconds(43.6), text: 'The numbers you check a hundred times a session.' },
  { from: seconds(43.6), to: seconds(48.2), text: 'Mark price over WebSocket, no polling storm.' },
  { from: seconds(48.2), to: seconds(52.6), text: 'Glance, and stay in the trade.' },

  // Proof 2 · Voice 0:53 – 1:13
  { from: seconds(53.4), to: seconds(57.4), text: 'Hold the temple. Speak.' },
  { from: seconds(57.4), to: seconds(61.6), text: '"Alert sixty-two thousand."' },
  { from: seconds(61.6), to: seconds(66.4), text: 'Armed while the app is open.' },
  { from: seconds(66.4), to: seconds(72.6), text: 'No typing. No app switching.' },

  // Proof 3 · Alert 1:13 – 1:30
  { from: seconds(73.4), to: seconds(78.2), text: 'When price crosses, the screen changes.' },
  { from: seconds(78.2), to: seconds(82.2), text: 'Current price.' },
  { from: seconds(82.2), to: seconds(86.2), text: 'Room left before liquidation.' },
  { from: seconds(86.2), to: seconds(89.8), text: 'One tap, back to the position.' },

  // Proof 4 · Confirm 1:30 – 1:53
  { from: seconds(90.4), to: seconds(94.4), text: 'Now the part that has to be safe.' },
  { from: seconds(94.4), to: seconds(98.6), text: 'Hold. "Close half."' },
  { from: seconds(98.6), to: seconds(102.6), text: 'The default is No.' },
  { from: seconds(102.6), to: seconds(107.4), text: 'Swipe to Yes. Then tap.' },
  { from: seconds(107.4), to: seconds(112.2), text: 'A signed, single-use preview.' },

  // Proof 5 · Fill 1:53 – 2:10
  { from: seconds(113.4), to: seconds(118), text: 'The order goes to Binance Futures testnet.' },
  { from: seconds(118), to: seconds(122.6), text: 'Filled. Half the position closed.' },
  { from: seconds(122.6), to: seconds(127.4), text: 'The API secret never touches the glasses.' },
  { from: seconds(127.4), to: seconds(129.8), text: 'Rate limits pause every call.' },

  // Safety 2:10 – 2:40
  { from: seconds(130.4), to: seconds(133.6), text: 'Testnet only.' },
  { from: seconds(133.6), to: seconds(138), text: 'Binance rejects any host that is not the testnet.' },
  { from: seconds(138), to: seconds(142.6), text: 'Keys live on the server, never in the app.' },
  { from: seconds(142.6), to: seconds(147.4), text: 'Every order needs the app token, a preview, and a Yes.' },
  { from: seconds(147.4), to: seconds(152.2), text: 'Mark price over WebSocket. REST only when needed.' },
  { from: seconds(152.2), to: seconds(157.4), text: 'Built for the session, not the phone screen.' },

  // CTA 2:40 – 2:55
  { from: seconds(160.4), to: seconds(164), text: 'Session Guard.' },
  { from: seconds(164), to: seconds(168), text: 'Track 03 — Exchanges & Stocks.' },
  { from: seconds(168), to: seconds(171.6), text: 'One position. One screen. Act in seconds.' },
  { from: seconds(171.6), to: seconds(174.6), text: 'github.com/your-handle/session-guard' },
]
