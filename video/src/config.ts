export interface ProofSlot {
  id: 'hud' | 'voice' | 'alert' | 'eta' | 'confirm' | 'fill' | 'receipt'
  step: string
  kicker: string
  title: string
  chips: string[]
  durationInFrames: number
}

/**
 * The seven proof beats. Each one is a labelled replay of the real 23 Nov 2026
 * Binance testnet HUD, rebuilt in Remotion from the captures in `public/`.
 * No live market data is shown; no recording is required.
 *
 * Exact durations (95 s total):
 *   hud 14s · voice 16s · alert 12s · eta 13s · confirm 16s · fill 12s · receipt 12s
 */
export const PROOF_SLOTS: ProofSlot[] = [
  {
    id: 'hud',
    step: '01 / 07',
    kicker: 'READ · REPLAY',
    title: 'One position,\nalways in view.',
    chips: ['Position, PnL, liq', 'WebSocket feed', 'Read in a glance'],
    durationInFrames: 420,
  },
  {
    id: 'voice',
    step: '02 / 07',
    kicker: 'VOICE · PUSH TO TALK',
    title: "Talk.\nDon't type.",
    chips: ['16 kHz from G2', 'Whisper small.en · local', 'No cloud audio'],
    durationInFrames: 480,
  },
  {
    id: 'alert',
    step: '03 / 07',
    kicker: 'ALERT · DISPLAY ONLY',
    title: 'The alert\nfinds you.',
    chips: ['Fires on mark price', 'While the app is open', 'One tap to dismiss'],
    durationInFrames: 360,
  },
  {
    id: 'eta',
    step: '04 / 07',
    kicker: 'RISK · TIME TO LIQ',
    title: 'Distance is\nnot time.',
    chips: ['3-minute tick window', 'USDT/min toward liq', 'Hidden when noisy or away'],
    durationInFrames: 390,
  },
  {
    id: 'confirm',
    step: '05 / 07',
    kicker: 'WRITE · EXPLICIT YES',
    title: 'Two gestures\nto act.',
    chips: ['Default is No', 'Swipe, then tap', 'Single-use preview'],
    durationInFrames: 480,
  },
  {
    id: 'fill',
    step: '06 / 07',
    kicker: 'FILL · BINANCE TESTNET',
    title: 'Filled on\ntestnet.',
    chips: ['Reduce-only market', 'Ban-aware REST', 'Keys never in app'],
    durationInFrames: 360,
  },
  {
    id: 'receipt',
    step: '07 / 07',
    kicker: 'AFTER ACTION · RECEIPT',
    title: 'Proof the\nrisk moved.',
    chips: ['Liq before → after', 'Buffer 4.6% → 9.6%', 'Derived from recorded state'],
    durationInFrames: 360,
  },
]

/** Sums to the proof section (2850 frames = 95 s). */
export const PROOF_TOTAL = PROOF_SLOTS.reduce((sum, slot) => sum + slot.durationInFrames, 0)

export type VideoProps = {
  repo: string
  music: boolean
  voiceover: boolean
}

export const defaultProps: VideoProps = {
  repo: 'github.com/artomily/wicksight',
  music: false,
  voiceover: false,
}
