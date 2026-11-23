import { interpolate, spring } from 'remotion'
import { FPS } from './timeline'

export const CLAMP = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const

/** Soft spring rise used for most entrances. */
export function rise(frame: number, delay = 0, distance = 34, damping = 200) {
  const p = spring({ frame: frame - delay, fps: FPS, config: { damping, mass: 0.6 } })
  return {
    opacity: p,
    transform: `translateY(${(1 - p) * distance}px)`,
  }
}

/** Fade in over `inFrames`, optionally fade out at the end of a range. */
export function fade(
  frame: number,
  inStart: number,
  inFrames = 10,
  outStart?: number,
  outFrames = 10,
) {
  let opacity = interpolate(frame, [inStart, inStart + inFrames], [0, 1], CLAMP)
  if (outStart !== undefined) {
    opacity = Math.min(
      opacity,
      interpolate(frame, [outStart, outStart + outFrames], [1, 0], CLAMP),
    )
  }
  return opacity
}

/** A number that eases from a to b while the frame advances. */
export function easeNumber(frame: number, from: number, to: number, start = 0, duration = 30) {
  return interpolate(frame, [start, start + duration], [from, to], {
    ...CLAMP,
    easing: (t) => 1 - Math.pow(1 - t, 3),
  })
}

export function fmt(value: number, decimals = 2): string {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}
