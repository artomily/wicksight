import { interpolate, useCurrentFrame } from 'remotion'
import { C, F } from '../theme'
import type { Caption1Min } from '../voV4.generated'

/**
 * Bottom captions for the v4 cut. Each chunk is 2-7 spoken words and appears
 * exactly when its first word is voiced. The word being spoken is highlighted,
 * so the captions follow the voice even with the sound off.
 */
export const CaptionTrack1Min: React.FC<{ captions: Caption1Min[] }> = ({ captions }) => {
  const frame = useCurrentFrame()
  const caption = captions.find((c) => frame >= c.from && frame < c.to)
  if (!caption) return null

  const local = frame - caption.from
  const enter = interpolate(local, [0, 5], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const exit = interpolate(caption.to - frame, [0, 3], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const opacity = Math.min(enter, exit)

  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 48,
        display: 'flex',
        justifyContent: 'center',
        pointerEvents: 'none',
        opacity,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          maxWidth: 1560,
          padding: '12px 26px 14px',
          borderRadius: 12,
          background: 'rgba(5, 13, 9, 0.84)',
          border: `1px solid ${C.line}`,
          boxShadow: '0 10px 40px rgba(0,0,0,0.45)',
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            background: C.green,
            boxShadow: `0 0 14px ${C.green}`,
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontFamily: F.display,
            fontSize: 34,
            lineHeight: 1.28,
            letterSpacing: '-0.012em',
            textAlign: 'left',
          }}
        >
          {caption.words.map((word, i) => {
            const current = frame >= word.start && frame < word.end
            return (
              <span
                key={`${word.start}-${i}`}
                style={{
                  color: current ? C.greenBright : C.text,
                  textShadow: current ? `0 0 20px rgba(70,224,138,0.55)` : 'none',
                }}
              >
                {word.word}
                {i < caption.words.length - 1 ? ' ' : ''}
              </span>
            )
          })}
        </span>
      </div>
    </div>
  )
}
