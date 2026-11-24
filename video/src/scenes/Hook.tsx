import { interpolate, spring, useCurrentFrame } from 'remotion'
import { CLAMP } from '../anim'
import { C, F } from '../theme'
import { FPS } from '../timeline'

const Line: React.FC<{
  children: React.ReactNode
  delay: number
  size: number
  color?: string
  weight?: number
  marginTop?: number
}> = ({ children, delay, size, color = C.text, weight = 750, marginTop = 0 }) => {
  const frame = useCurrentFrame()
  const p = spring({
    frame: frame - delay,
    fps: FPS,
    config: { damping: 200, mass: 0.55 },
  })

  return (
    <div
      style={{
        overflow: 'hidden',
        height: size * 1.18,
        marginTop,
        display: 'flex',
        alignItems: 'flex-end',
      }}
    >
      <div
        style={{
          transform: `translateY(${(1 - p) * 105}%)`,
          opacity: Math.min(1, p * 1.4),
          fontFamily: F.display,
          fontSize: size,
          lineHeight: 1,
          fontWeight: weight,
          color,
          letterSpacing: '-0.035em',
        }}
      >
        {children}
      </div>
    </div>
  )
}

export const Hook: React.FC = () => {
  const frame = useCurrentFrame()

  const gauge = interpolate(frame, [24, 92], [0, 1], {
    ...CLAMP,
    easing: (t) => 1 - Math.pow(1 - t, 3),
  })
  const labelsIn = interpolate(frame, [90, 112], [0, 1], CLAMP)
  const jitter = Math.sin(frame / 3.2) * 0.035
  const shown = Math.max(0, 4.6 * gauge + jitter * gauge)
  const barHeight = (shown / 4.6) * 400

  const flash = interpolate(frame, [340, 352, 400], [0, 1, 0], CLAMP)
  const wipe = interpolate(frame, [418, 448], [0, 1], {
    ...CLAMP,
    easing: (t) => 1 - Math.pow(1 - t, 3),
  })

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      {/* kicker */}
      <div
        style={{
          position: 'absolute',
          left: 120,
          top: 138,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          fontFamily: F.mono,
          fontSize: 18,
          letterSpacing: 3.2,
          color: C.faint,
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            background: C.red,
            boxShadow: `0 0 14px ${C.red}`,
            opacity: 0.55 + 0.45 * Math.abs(Math.sin(frame / 12)),
          }}
        />
        TESTNET SESSION · BTCUSDT
      </div>

      <div style={{ position: 'absolute', left: 120, top: 196 }}>
        <Line delay={18} size={54} color={C.muted} weight={500}>
          You're in a trade.
        </Line>
        <Line delay={44} size={92} marginTop={26}>
          The number that decides
        </Line>
        <Line delay={86} size={92} marginTop={6}>
          your night is how far
        </Line>
        <Line delay={126} size={92} marginTop={6}>
          price is from <span style={{ color: C.red }}>liquidation.</span>
        </Line>
      </div>

      {/* distance gauge */}
      <div style={{ position: 'absolute', left: 1648, top: 210, width: 170 }}>
        <div
          style={{
            fontFamily: F.mono,
            fontSize: 12,
            letterSpacing: 2.4,
            color: C.faint,
          }}
        >
          DISTANCE TO LIQ
        </div>
        <div
          style={{
            fontFamily: F.display,
            fontSize: 62,
            fontWeight: 750,
            letterSpacing: '-0.04em',
            color: C.red,
            marginTop: 4,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {shown.toFixed(1)}%
        </div>

        <div
          style={{
            position: 'relative',
            marginTop: 22,
            width: 2,
            height: 400,
            background: 'rgba(255,106,92,0.16)',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: 2,
              height: barHeight,
              background: C.red,
              boxShadow: `0 0 18px ${C.red}`,
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: barHeight - 5,
              left: -5,
              width: 12,
              height: 12,
              borderRadius: 6,
              background: C.red,
              boxShadow: `0 0 18px ${C.red}`,
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: -10,
              left: 14,
              fontFamily: F.mono,
              fontSize: 12,
              color: C.faint,
              whiteSpace: 'nowrap',
              opacity: labelsIn,
            }}
          >
            ENTRY 61,492.9
          </div>
          <div
            style={{
              position: 'absolute',
              bottom: -30,
              left: 14,
              fontFamily: F.mono,
              fontSize: 12,
              color: C.redDim,
              whiteSpace: 'nowrap',
              opacity: labelsIn,
            }}
          >
            LIQ 58,684.4
          </div>
        </div>
      </div>

      {/* alarm pulse */}
      <div
        style={{
          position: 'absolute',
          left: 1680,
          top: 360,
          width: 240,
          height: 240,
          borderRadius: 120,
          border: `2px solid ${C.red}`,
          opacity: flash * 0.8,
          transform: `scale(${1 + (1 - flash) * 0.8})`,
        }}
      />

      {/* green transition wipe */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          bottom: 0,
          height: 3,
          width: `${wipe * 100}%`,
          background: C.green,
          boxShadow: `0 0 24px ${C.green}`,
        }}
      />
    </div>
  )
}
