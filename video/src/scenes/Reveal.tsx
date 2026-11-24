import { interpolate, spring, useCurrentFrame } from 'remotion'
import { CLAMP } from '../anim'
import { DeviceFrame } from '../components/DeviceFrame'
import { fmtPct, fmtSigned } from '../format'
import { C, F } from '../theme'
import { FPS } from '../timeline'

const MARGIN = (61492.88 * 0.01) / 20

const Callout: React.FC<{
  delay: number
  y: number
  label: string
  value: string
}> = ({ delay, y, label, value }) => {
  const frame = useCurrentFrame()
  const p = spring({ frame: frame - delay, fps: FPS, config: { damping: 200, mass: 0.6 } })
  const line = interpolate(frame, [delay, delay + 14], [0, 1], CLAMP)

  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: 1300,
          top: y + 8,
          width: 60,
          height: 1,
          background: C.green,
          opacity: 0.5,
          transform: `scaleX(${line})`,
          transformOrigin: 'left',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 1376,
          top: y - 12,
          opacity: p,
          transform: `translateX(${(1 - p) * 18}px)`,
        }}
      >
        <div
          style={{
            fontFamily: F.mono,
            fontSize: 14,
            letterSpacing: 3,
            color: C.green,
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontFamily: F.display,
            fontSize: 26,
            fontWeight: 550,
            color: C.text,
            marginTop: 6,
            letterSpacing: '-0.01em',
            whiteSpace: 'nowrap',
          }}
        >
          {value}
        </div>
      </div>
    </>
  )
}

export const Reveal: React.FC = () => {
  const frame = useCurrentFrame()

  const enter = spring({ frame, fps: FPS, config: { damping: 200, mass: 0.7 } })
  const reveal = interpolate(frame, [16, 54], [0, 1], CLAMP)
  const zoom = interpolate(frame, [520, 600], [1, 1.025], CLAMP)

  // The captured position, replayed: the same entry, liquidation and the
  // recorded −0.06 USDT mark. No live market data is implied.
  const pnl = -0.06
  const pnlLabel = fmtSigned(pnl)
  const roeLabel = fmtPct((pnl / MARGIN) * 100)

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div
        style={{
          position: 'absolute',
          top: 108,
          left: 0,
          right: 0,
          textAlign: 'center',
          fontFamily: F.mono,
          fontSize: 16,
          letterSpacing: 4.4,
          color: C.faint,
          opacity: interpolate(frame, [0, 14], [0, 1], CLAMP),
        }}
      >
        WICKSIGHT · EVEN G2
      </div>

      <div
        style={{
          position: 'absolute',
          left: 170,
          top: 214,
          opacity: enter,
          transform: `translateY(${(1 - enter) * 26}px) scale(${(0.96 + enter * 0.04) * zoom})`,
          transformOrigin: 'center center',
        }}
      >
        <DeviceFrame
          scale={2}
          arms={false}
          reveal={reveal}
          pnl={pnlLabel}
          roe={roeLabel}
          qty="0.01"
          mark="58,684.4"
          distance="4.6"
          glow={0.22}
        />
      </div>

      <Callout delay={176} y={332} label="POSITION" value="BTCUSDT · LONG · 20x" />
      <Callout delay={232} y={450} label="PNL / ROE" value={`${pnlLabel} USDT · ${roeLabel}`} />
      <Callout delay={288} y={568} label="LIQUIDATION" value="58,684.4 · 4.6% away" />

      <div
        style={{
          position: 'absolute',
          left: 170,
          top: 800,
          fontFamily: F.mono,
          fontSize: 11,
          letterSpacing: 1.8,
          color: C.faint,
          opacity: interpolate(frame, [300, 340], [0, 1], CLAMP),
        }}
      >
        HUD RECONSTRUCTION FROM THE RECORDED 23 NOV TESTNET STATE
      </div>

      <div
        style={{
          position: 'absolute',
          left: 200,
          top: 842,
          fontFamily: F.mono,
          fontSize: 14,
          letterSpacing: 2.6,
          color: C.faint,
          opacity: interpolate(frame, [300, 340], [0, 1], CLAMP),
        }}
      >
        576 × 288 · MONOCHROME GREEN · ONE SCREEN
      </div>

      <div
        style={{
          position: 'absolute',
          right: 200,
          top: 842,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          fontFamily: F.mono,
          fontSize: 14,
          letterSpacing: 2.6,
          color: C.green,
          opacity: interpolate(frame, [320, 360], [0, 1], CLAMP),
        }}
      >
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: 4,
            background: C.green,
            boxShadow: `0 0 12px ${C.green}`,
          }}
        />
        TESTNET · REPLAY
      </div>
    </div>
  )
}
