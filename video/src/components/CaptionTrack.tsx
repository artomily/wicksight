import { interpolate, useCurrentFrame } from 'remotion'
import { CAPTIONS, type Caption } from '../captions'
import { C, F } from '../theme'

/** Bottom captions for every VO line, readable with sound off. */
export const CaptionTrack: React.FC<{ captions?: Caption[] }> = ({
  captions = CAPTIONS,
}) => {
  const frame = useCurrentFrame()
  const caption = captions.find((c) => frame >= c.from && frame < c.to)
  if (!caption) return null

  const local = frame - caption.from
  const enter = interpolate(local, [0, 8], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const exit = interpolate(caption.to - frame, [0, 6], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const opacity = Math.min(enter, exit)
  const y = (1 - enter) * 10

  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 52,
        display: 'flex',
        justifyContent: 'center',
        pointerEvents: 'none',
        opacity,
        transform: `translateY(${y}px)`,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          maxWidth: 1480,
          padding: '13px 26px 14px',
          borderRadius: 12,
          background: 'rgba(5, 13, 9, 0.82)',
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
            color: C.text,
            letterSpacing: '-0.012em',
            textAlign: 'left',
          }}
        >
          {caption.text}
        </span>
      </div>
    </div>
  )
}
