import { interpolate, spring, useCurrentFrame } from 'remotion'
import { CLAMP } from '../anim'
import { C, F } from '../theme'
import { FPS } from '../timeline'

export const CTA: React.FC<{ repo: string }> = ({ repo }) => {
  const frame = useCurrentFrame()
  const word = spring({ frame, fps: FPS, config: { damping: 200, mass: 0.7 } })
  const tag = interpolate(frame, [26, 50], [0, 1], CLAMP)
  const pill = spring({ frame: frame - 44, fps: FPS, config: { damping: 200, mass: 0.6 } })
  const glow = 0.12 + 0.05 * Math.sin(frame / 22)

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 250,
          textAlign: 'center',
          fontFamily: F.mono,
          fontSize: 16,
          letterSpacing: 4,
          color: C.greenDim,
          opacity: tag,
        }}
      >
        EVEN REALITIES HACKATHON · TRACK 03
      </div>

      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 300,
          textAlign: 'center',
          opacity: word,
          transform: `scale(${0.94 + word * 0.06})`,
        }}
      >
        <div
          style={{
            fontFamily: F.display,
            fontSize: 138,
            fontWeight: 800,
            letterSpacing: '-0.055em',
            color: C.text,
            textShadow: `0 0 90px rgba(70,224,138,${glow})`,
          }}
        >
          WICKSIGHT
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 500,
          display: 'flex',
          justifyContent: 'center',
          opacity: tag,
        }}
      >
        <div style={{ width: 240, height: 2, background: C.green, boxShadow: `0 0 20px ${C.green}` }} />
      </div>

      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 540,
          textAlign: 'center',
          fontFamily: F.display,
          fontSize: 46,
          fontWeight: 400,
          color: C.muted,
          letterSpacing: '-0.02em',
          opacity: tag,
          transform: `translateY(${(1 - tag) * 12}px)`,
        }}
      >
        One position. One screen. Act in seconds.
      </div>

      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 646,
          display: 'flex',
          justifyContent: 'center',
          opacity: pill,
          transform: `translateY(${(1 - pill) * 18}px)`,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            padding: '14px 26px',
            borderRadius: 999,
            border: `1px solid ${C.line}`,
            background: 'rgba(8, 18, 12, 0.9)',
            fontFamily: F.mono,
            fontSize: 24,
            letterSpacing: 0.4,
            color: C.text,
          }}
        >
          <span style={{ color: C.green }}>↗</span>
          {repo}
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 760,
          display: 'flex',
          justifyContent: 'center',
          gap: 12,
          opacity: pill,
        }}
      >
        {['BINANCE TESTNET', 'NO CUSTODY', 'NOT FINANCIAL ADVICE'].map((chip) => (
          <span
            key={chip}
            style={{
              fontFamily: F.mono,
              fontSize: 11,
              letterSpacing: 2,
              color: C.faint,
              border: `1px solid ${C.line}`,
              borderRadius: 4,
              padding: '5px 9px',
            }}
          >
            {chip}
          </span>
        ))}
      </div>

    </div>
  )
}
