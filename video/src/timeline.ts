export const FPS = 30
export const WIDTH = 1920
export const HEIGHT = 1080

/**
 * Timeline at 30 fps. Total 2:59 (179 s).
 *
 *   cold     0:00 – 0:10   danger → close half → Yes → receipt
 *   hook     0:10 – 0:25
 *   reveal   0:25 – 0:45
 *   proof    0:45 – 2:20
 *   safety   2:20 – 2:45
 *   cta      2:45 – 2:59
 */
export const SECTIONS = {
  cold: { from: 0, duration: 300 },
  hook: { from: 300, duration: 450 },
  reveal: { from: 750, duration: 600 },
  proof: { from: 1350, duration: 2850 },
  safety: { from: 4200, duration: 750 },
  cta: { from: 4950, duration: 420 },
} as const

export const DURATION = SECTIONS.cta.from + SECTIONS.cta.duration // 5370 = 179 s

export const seconds = (s: number) => Math.round(s * FPS)
