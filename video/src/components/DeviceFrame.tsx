import { C, F } from '../theme'
import { HudMock } from './HudMock'

interface DeviceFrameProps {
  scale: number
  pnl?: string
  roe?: string
  qty?: string
  mark?: string
  distance?: string
  reveal?: number
  glow?: number
  arms?: boolean
}

/** Stylised Even G2 display: one 576×288 panel with temple arms. */
export const DeviceFrame: React.FC<DeviceFrameProps> = ({
  scale,
  reveal = 1,
  glow = 0.18,
  arms = true,
  ...hud
}) => {
  const width = 576 * scale
  const height = 288 * scale

  return (
    <div style={{ position: 'relative', width, height }}>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: -46,
          display: 'flex',
          justifyContent: 'space-between',
          fontFamily: F.mono,
          fontSize: 15,
          letterSpacing: 2.6,
          color: C.faint,
        }}
      >
        <span>EVEN G2</span>
        <span>576 × 288</span>
      </div>

      {arms ? (
        <>
          <div
            style={{
              position: 'absolute',
              left: -150,
              top: height / 2 - 1,
              width: 150,
              height: 2,
              background: `linear-gradient(90deg, transparent, ${C.line})`,
            }}
          />
          <div
            style={{
              position: 'absolute',
              right: -150,
              top: height / 2 - 1,
              width: 150,
              height: 2,
              background: `linear-gradient(90deg, ${C.line}, transparent)`,
            }}
          />
        </>
      ) : null}

      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 26,
          border: `1px solid rgba(120, 240, 170, 0.28)`,
          boxShadow: `0 0 90px rgba(70,224,138,${glow}), inset 0 0 46px rgba(70,224,138,0.05)`,
          overflow: 'hidden',
          background: '#000',
        }}
      >
        <div
          style={{
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
            clipPath: `inset(${(1 - reveal) * 100}% 0 0 0)`,
          }}
        >
          <HudMock {...hud} />
        </div>
      </div>
    </div>
  )
}
