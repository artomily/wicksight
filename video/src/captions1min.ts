import { seconds } from './timeline'

export interface Caption1Min {
  from: number
  to: number
  text: string
}

/**
 * Captions for the 60-second cut. Times are absolute frames at 30 fps.
 * 0–5 cold · 5–15 glance · 15–25 alert · 25–42 close · 42–50 receipt · 50–60 end.
 */
export const CAPTIONS_1MIN: Caption1Min[] = [
  { from: seconds(0.4), to: seconds(4.8), text: 'LIQ IN ~4m at this pace. The clock is the risk.' },

  { from: seconds(5.4), to: seconds(9.2), text: 'One screen: position, PnL, distance to liq.' },
  { from: seconds(9.2), to: seconds(14.6), text: 'And time: ~4 minutes at this pace.' },

  { from: seconds(15.4), to: seconds(19.2), text: '"Alert 61,500."' },
  { from: seconds(19.2), to: seconds(24.6), text: 'Armed while the app is open. Alert hit.' },

  { from: seconds(25.4), to: seconds(29.6), text: '"Close half."' },
  { from: seconds(29.6), to: seconds(35.4), text: 'Default is No.' },
  { from: seconds(35.4), to: seconds(39.0), text: 'Swipe to Yes. Then tap.' },
  { from: seconds(39.0), to: seconds(41.6), text: 'Reduce-only. Single-use preview.' },

  { from: seconds(42.4), to: seconds(47.0), text: 'Buffer 4.6% → 9.6%.' },
  { from: seconds(47.0), to: seconds(49.6), text: 'The receipt proves the risk moved.' },

  { from: seconds(50.4), to: seconds(54.4), text: 'Testnet only. Keys server-side. Explicit Yes.' },
  { from: seconds(54.4), to: seconds(57.4), text: 'WickSight. github.com/artomily/wicksight' },
  { from: seconds(57.4), to: seconds(59.8), text: 'Live demo: wicksight.vercel.app' },
]
