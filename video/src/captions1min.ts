import { seconds } from './timeline'

export interface Caption1Min {
  from: number
  to: number
  text: string
}

/**
 * Captions for the 60-second cut. Times are absolute frames at 30 fps.
 * 0–8 concept · 8–14 Telegram · 14–16 glance · 16–21 alert · 21–25 multi ·
 * 25–41 close · 41–48 receipt · 48–51 simulator · 51–60 end.
 */
export const CAPTIONS_1MIN: Caption1Min[] = [
  { from: seconds(0.4), to: seconds(4.6), text: 'LIQ IN ~4m at this pace. The clock is the risk.' },

  { from: seconds(8.4), to: seconds(12.2), text: "While you're in another app, the warning lands in Telegram." },

  { from: seconds(14.2), to: seconds(17.0), text: 'One glance: position, distance, time.' },
  { from: seconds(17.0), to: seconds(21.0), text: 'The alert fires at 61,500.' },

  { from: seconds(21.2), to: seconds(24.8), text: '3 positions · riskiest SOL ~10m.' },

  { from: seconds(25.2), to: seconds(29.8), text: '"Close half."' },
  { from: seconds(29.8), to: seconds(33.8), text: 'Default is No.' },
  { from: seconds(33.8), to: seconds(37.8), text: 'Swipe to Yes. Then tap.' },
  { from: seconds(37.8), to: seconds(41.0), text: 'Reduce-only. Testnet.' },

  { from: seconds(41.2), to: seconds(45.0), text: 'Buffer 4.6% → 9.6%.' },
  { from: seconds(45.0), to: seconds(48.0), text: 'The receipt proves the risk moved.' },

  { from: seconds(48.2), to: seconds(51.0), text: 'The same HUD, in the Even Hub simulator.' },

  { from: seconds(51.2), to: seconds(55.0), text: 'Trade-only keys. Withdrawal keys refused.' },
  { from: seconds(55.0), to: seconds(58.0), text: 'Testnet only. Explicit yes.' },
  { from: seconds(58.0), to: seconds(59.8), text: 'WickSight. wicksight.vercel.app' },
]
