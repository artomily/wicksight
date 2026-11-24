import { interpolate, spring, useCurrentFrame } from 'remotion'
import { CLAMP } from '../anim'
import { C, F } from '../theme'
import { FPS } from '../timeline'

const Check: React.FC = () => (
  <svg width={34} height={34} viewBox="0 0 34 34">
    <circle cx="17" cy="17" r="15.5" fill="none" stroke={C.green} strokeWidth="1.4" opacity="0.55" />
    <path
      d="M10.5 17.5 L15 22 L24 12.5"
      fill="none"
      stroke={C.green}
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const Row: React.FC<{ delay: number; title: string; sub: string }> = ({ delay, title, sub }) => {
  const frame = useCurrentFrame()
  const p = spring({ frame: frame - delay, fps: FPS, config: { damping: 200, mass: 0.55 } })

  return (
    <div
      style={{
        display: 'flex',
        gap: 20,
        alignItems: 'flex-start',
        opacity: p,
        transform: `translateX(${(1 - p) * -18}px)`,
      }}
    >
      <div style={{ marginTop: 2 }}>
        <Check />
      </div>
      <div>
        <div
          style={{
            fontFamily: F.display,
            fontSize: 27,
            fontWeight: 650,
            color: C.text,
            letterSpacing: '-0.015em',
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontFamily: F.display,
            fontSize: 19,
            color: C.muted,
            marginTop: 5,
            letterSpacing: '-0.005em',
          }}
        >
          {sub}
        </div>
      </div>
    </div>
  )
}

const Node: React.FC<{
  x: number
  y: number
  label: string
  sub: string
  active?: boolean
  badge?: string
}> = ({ x, y, label, sub, active = false, badge }) => (
  <div
    style={{
      position: 'absolute',
      left: x,
      top: y,
      width: 600,
      height: 112,
      borderRadius: 14,
      background: active ? 'rgba(12, 30, 20, 0.95)' : C.panel,
      border: `1px solid ${active ? 'rgba(70,224,138,0.55)' : C.line}`,
      boxShadow: active ? '0 0 50px rgba(70,224,138,0.14)' : 'none',
      padding: '22px 26px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
    }}
  >
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontFamily: F.mono,
        fontSize: 15,
        letterSpacing: 2.4,
        color: active ? C.green : C.muted,
      }}
    >
      <span>{label}</span>
      {badge ? (
        <span
          style={{
            fontSize: 11,
            letterSpacing: 1.8,
            padding: '3px 8px',
            borderRadius: 4,
            border: `1px solid ${C.greenDim}`,
            color: C.green,
          }}
        >
          {badge}
        </span>
      ) : null}
    </div>
    <div
      style={{
        fontFamily: F.display,
        fontSize: 20,
        color: C.faint,
        marginTop: 8,
        letterSpacing: '-0.005em',
      }}
    >
      {sub}
    </div>
  </div>
)

const Packet: React.FC<{ x: number; from: number; to: number; offset: number }> = ({
  x,
  from,
  to,
  offset,
}) => {
  const frame = useCurrentFrame()
  const span = to - from
  const progress = ((frame * 1.6 + offset) % span) / span
  const y = from + progress * span
  const opacity = Math.sin(progress * Math.PI)

  return (
    <span
      style={{
        position: 'absolute',
        left: x - 4,
        top: y - 4,
        width: 8,
        height: 8,
        borderRadius: 4,
        background: C.green,
        boxShadow: `0 0 14px ${C.green}`,
        opacity: opacity * 0.9,
      }}
    />
  )
}

export const Safety: React.FC = () => {
  const frame = useCurrentFrame()
  const line1 = interpolate(frame, [60, 100], [0, 1], CLAMP)
  const line2 = interpolate(frame, [300, 340], [0, 1], CLAMP)
  const business = interpolate(frame, [620, 670], [0, 1], CLAMP)

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div
        style={{
          position: 'absolute',
          left: 120,
          top: 160,
          fontFamily: F.mono,
          fontSize: 15,
          letterSpacing: 3.4,
          color: C.green,
          opacity: interpolate(frame, [0, 14], [0, 1], CLAMP),
        }}
      >
        SAFETY MODEL
      </div>

      <div
        style={{
          position: 'absolute',
          left: 120,
          top: 196,
          fontFamily: F.display,
          fontSize: 78,
          lineHeight: 1.02,
          fontWeight: 750,
          letterSpacing: '-0.04em',
          color: C.text,
          whiteSpace: 'pre-line',
        }}
      >
        {'Safe by\nconstruction.'}
      </div>

      <div
        style={{
          position: 'absolute',
          left: 120,
          top: 440,
          display: 'flex',
          flexDirection: 'column',
          gap: 50,
          width: 780,
        }}
      >
        <Row
          delay={60}
          title="Testnet host gate"
          sub="Exact hostname match. Lookalike domains rejected."
        />
        <Row
          delay={110}
          title="Keys server-side"
          sub="Never in the WebView, never in logs, never in git."
        />
        <Row
          delay={160}
          title="Explicit Yes, server-enforced"
          sub="App token, single-use preview, then swipe and tap."
        />
        <Row
          delay={210}
          title="Rate-limit aware"
          sub="WebSocket live; every REST call pauses during a ban."
        />
      </div>

      <Node x={1140} y={196} label="EVEN G2 · WEBVIEW" sub="HUD · microphone · gestures" />
      <Node
        x={1140}
        y={436}
        label="WICKSIGHT API"
        sub="Position cache · order guards · token"
        active
        badge="KEYS"
      />
      <Node
        x={1140}
        y={676}
        label="BINANCE FUTURES"
        sub="Testnet host only · user data stream"
        badge="TESTNET"
      />

      <div
        style={{
          position: 'absolute',
          left: 1438,
          top: 308,
          width: 2,
          height: 128,
          background: C.line,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 1438,
          top: 548,
          width: 2,
          height: 128,
          background: C.line,
        }}
      />
      <Packet x={1439} from={308} to={436} offset={0} />
      <Packet x={1439} from={548} to={676} offset={64} />

      <div
        style={{
          position: 'absolute',
          left: 1462,
          top: 344,
          fontFamily: F.mono,
          fontSize: 13,
          letterSpacing: 1.6,
          color: C.faint,
          opacity: line1,
        }}
      >
        bearer token · fetch
      </div>
      <div
        style={{
          position: 'absolute',
          left: 1462,
          top: 584,
          fontFamily: F.mono,
          fontSize: 13,
          letterSpacing: 1.6,
          color: C.faint,
          opacity: line2,
        }}
      >
        signed REST · WebSocket
      </div>

      <div
        style={{
          position: 'absolute',
          left: 120,
          right: 120,
          bottom: 176,
          display: 'flex',
          alignItems: 'center',
          gap: 18,
          opacity: business,
          transform: `translateY(${(1 - business) * 12}px)`,
        }}
      >
        <span
          style={{
            fontFamily: F.mono,
            fontSize: 13,
            letterSpacing: 2.6,
            color: C.green,
          }}
        >
          LAUNCH PATH
        </span>
        <span style={{ flex: 1, height: 1, background: C.line }} />
        <span
          style={{
            fontFamily: F.display,
            fontSize: 24,
            color: C.muted,
            letterSpacing: '-0.01em',
          }}
        >
          Catalogue → read-only mainnet → order writing after review. No custody.
        </span>
      </div>
    </div>
  )
}
