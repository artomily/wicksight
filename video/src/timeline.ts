export const FPS = 30
export const WIDTH = 1920
export const HEIGHT = 1080

/**
 * Timeline at 30 fps. Total 2:55 (175 s).
 *
 *   hook     0:00 – 0:15
 *   reveal   0:15 – 0:35
 *   proof    0:35 – 2:10
 *   safety   2:10 – 2:40
 *   cta      2:40 – 2:55
 */
export const SECTIONS = {
  hook: { from: 0, duration: 450 },
  reveal: { from: 450, duration: 600 },
  proof: { from: 1050, duration: 2850 },
  safety: { from: 3900, duration: 900 },
  cta: { from: 4800, duration: 450 },
} as const

export const DURATION = SECTIONS.cta.from + SECTIONS.cta.duration // 5250

export const seconds = (s: number) => Math.round(s * FPS)
