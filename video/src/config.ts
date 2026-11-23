export type ProofKind = 'image' | 'video'

export interface Highlight {
  /** Coordinates in the original 576×288 capture. */
  x: number
  y: number
  w: number
  h: number
  label: string
}

export interface ProofSlot {
  id: 'hud' | 'voice' | 'alert' | 'confirm' | 'fill'
  kind: ProofKind
  /** File inside video/public. Use `clips/xx.mp4` for recordings. */
  src: string
  step: string
  kicker: string
  title: string
  chips: string[]
  durationInFrames: number
  highlight?: Highlight
  waveform?: boolean
}

/**
 * Real proof slots. To swap in tonight's simulator recordings:
 *   1. drop the file into video/public/clips/
 *   2. set kind: 'video' and src: 'clips/<name>.mp4'
 * Keep durationInFrames as-is (the recording is trimmed/looped to fit).
 *
 * Exact durations:
 *   hud 18s · voice 20s · alert 17s · confirm 23s · fill 17s
 */
export const PROOF_SLOTS: ProofSlot[] = [
  {
    id: 'hud',
    kind: 'image',
    src: 'position.png',
    step: '01 / 05',
    kicker: 'READ · LIVE',
    title: 'One position,\nalways in view.',
    chips: ['Position, PnL, liq', 'Live over WebSocket', 'Read in a glance'],
    durationInFrames: 540,
    highlight: { x: 22, y: 170, w: 310, h: 38, label: '4.6% AWAY' },
  },
  {
    id: 'voice',
    kind: 'image',
    src: 'listening.png',
    step: '02 / 05',
    kicker: 'VOICE · PUSH TO TALK',
    title: "Talk.\nDon't type.",
    chips: ['16 kHz from G2', 'Whisper small.en · local', 'No cloud audio'],
    durationInFrames: 600,
    waveform: true,
  },
  {
    id: 'alert',
    kind: 'image',
    src: 'alert.png',
    step: '03 / 05',
    kicker: 'ALERT · DISPLAY ONLY',
    title: 'The alert\nfinds you.',
    chips: ['Fires on mark price', 'While the app is open', 'One tap to dismiss'],
    durationInFrames: 510,
  },
  {
    id: 'confirm',
    kind: 'image',
    src: 'confirm.png',
    step: '04 / 05',
    kicker: 'WRITE · EXPLICIT YES',
    title: 'Two gestures\nto act.',
    chips: ['Default is No', 'Swipe, then tap', 'Single-use preview'],
    durationInFrames: 690,
    highlight: { x: 24, y: 118, w: 528, h: 62, label: '' },
  },
  {
    id: 'fill',
    kind: 'image',
    src: 'filled.png',
    step: '05 / 05',
    kicker: 'PROOF · BINANCE TESTNET',
    title: 'Filled on\ntestnet.',
    chips: ['Reduce-only market', 'Ban-aware REST', 'Keys never in app'],
    durationInFrames: 510,
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
  repo: 'github.com/your-handle/session-guard',
  music: false,
  voiceover: false,
}
