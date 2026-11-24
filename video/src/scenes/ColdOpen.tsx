import { interpolate, useCurrentFrame } from 'remotion'
import { CLAMP } from '../anim'
import { HudConfirm, HudFilled, HudPosition, type HudReceipt } from '../components/HudScreen'
import { C, F } from '../theme'

const RECEIPT: HudReceipt = {
  liqBefore: '58,684',
  liqAfter: '55,591',
  bufferBefore: '4.6%',
  bufferAfter: '9.6%',
}

const fade = (frame: number, start: number, end: number, length = 8) =>
  Math.min(
    interpolate(frame, [start, start + length], [0, 1], CLAMP),
    interpolate(frame, [end - length, end], [1, 0], CLAMP),
  )

const Layer: React.FC<{ opacity: number; children: React.ReactNode }> = ({ opacity, children }) => (
  <div style={{ position: 'absolute', inset: 0, opacity }}>{children}</div>
)

/**
 * 10 s cold open: the danger, the spoken action, the explicit Yes, and the
 * receipt that proves the buffer moved. Every value is the recorded 23 Nov
 * testnet state; the frame is labelled REPLAY.
 */
export const ColdOpen: React.FC = () => {
  const frame = useCurrentFrame()

  const danger = 1
  const dangerPulse = 0.55 + 0.45 * Math.abs(Math.sin(frame / 9))
  const quoteIn = interpolate(frame, [86, 104], [0, 1], CLAMP)
  const quoteOut = interpolate(frame, [138, 154], [1, 0], CLAMP)
  const bufferIn = interpolate(frame, [214, 234], [0, 1], CLAMP)
  const endWipe = interpolate(frame, [286, 300], [0, 1], CLAMP)

  const dangerOpacity = 1 - interpolate(frame, [150, 190], [0, 1], CLAMP)
  const greenGlow = interpolate(frame, [200, 240], [0, 1], CLAMP)
  const positionOpacity = interpolate(frame, [120, 128], [1, 0], CLAMP)

  return (
    <div style={{ position: 'absolute', inset: 0, background: C.bg, overflow: 'hidden' }}>
      {/* danger red glow, then the green receipt glow */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(900px 620px at 50% 42%, rgba(255,106,92,0.16), transparent 65%)',
          opacity: dangerOpacity,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(900px 620px at 50% 42%, rgba(70,224,138,0.12), transparent 65%)',
          opacity: greenGlow,
        }}
      />

      <div
        style={{
          position: 'absolute',
          top: 48,
          left: 0,
          right: 0,
          textAlign: 'center',
          fontFamily: F.mono,
          fontSize: 13,
          letterSpacing: 3.2,
          color: C.faint,
          opacity: danger,
        }}
      >
        REPLAY · RECORDED 23 NOV 2026 · BINANCE FUTURES TESTNET
      </div>

      {/* danger label */}
      <div
        style={{
          position: 'absolute',
          top: 92,
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '9px 16px',
          borderRadius: 999,
          border: `1px solid ${C.red}`,
          background: 'rgba(20, 6, 4, 0.72)',
          color: C.red,
          fontFamily: F.mono,
          fontSize: 16,
          letterSpacing: 3,
          opacity: dangerOpacity * 0.9,
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            background: C.red,
            boxShadow: `0 0 14px ${C.red}`,
            opacity: dangerPulse,
          }}
        />
        DANGER · LIQ IN ~4m
      </div>

      {/* HUD */}
      <div
        style={{
          position: 'absolute',
          left: 442,
          top: 214,
          width: 1036,
          height: 518,
          borderRadius: 18,
          border: `1px solid ${dangerOpacity > 0.3 ? 'rgba(255,106,92,0.45)' : C.line}`,
          boxShadow: `0 0 90px ${dangerOpacity > 0.3 ? 'rgba(255,106,92,0.12)' : 'rgba(70,224,138,0.10)'}`,
          background: '#000',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: 576,
            height: 288,
            transform: 'scale(1.8)',
            transformOrigin: 'top left',
          }}
        >
          <Layer opacity={positionOpacity}>
            <HudPosition
              qty="0.01"
              pnl="-0.06"
              roe="-0.2%"
              liq="58,684.4"
              distance="4.6"
              hint="LIQ IN ~4m at this pace · buffer 4.6%"
              hintTone="bright"
              statusPulse={0.65 + 0.35 * Math.abs(Math.sin(frame / 9))}
            />
          </Layer>
          <Layer opacity={fade(frame, 120, 196, 8)}>
            <HudConfirm selected={frame >= 160 ? 'yes' : 'no'} />
          </Layer>
          <Layer opacity={fade(frame, 190, 300, 8)}>
            <HudFilled qty="0.005" price="61,502.9" left="0.005" receipt={RECEIPT} />
          </Layer>
        </div>
      </div>

      {/* voice command */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 790,
          textAlign: 'center',
          opacity: quoteIn * quoteOut,
          transform: `translateY(${(1 - quoteIn) * 18}px)`,
        }}
      >
        <div
          style={{
            fontFamily: F.mono,
            fontSize: 12,
            letterSpacing: 3.4,
            color: C.green,
            marginBottom: 10,
          }}
        >
          HOLD THE TEMPLE · SPEAK
        </div>
        <div
          style={{
            fontFamily: F.display,
            fontSize: 74,
            fontWeight: 750,
            letterSpacing: '-0.04em',
            color: C.text,
          }}
        >
          “close half”
        </div>
      </div>

      {/* confirm hint while the confirm screen is up */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 800,
          textAlign: 'center',
          opacity: fade(frame, 124, 196, 8) * (1 - bufferIn),
          fontFamily: F.mono,
          fontSize: 16,
          letterSpacing: 3,
          color: frame >= 160 ? C.green : C.faint,
        }}
      >
        {frame >= 160 ? 'SWIPED TO YES · TAP TO CONFIRM' : 'DEFAULT IS NO · SWIPE TO YES'}
      </div>

      {/* receipt callout */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 790,
          textAlign: 'center',
          opacity: bufferIn,
          transform: `translateY(${(1 - bufferIn) * 16}px)`,
        }}
      >
        <div
          style={{
            fontFamily: F.mono,
            fontSize: 13,
            letterSpacing: 3.2,
            color: C.green,
            marginBottom: 10,
          }}
        >
          AFTER ACTION · RECEIPT
        </div>
        <div
          style={{
            fontFamily: F.display,
            fontSize: 68,
            fontWeight: 750,
            letterSpacing: '-0.04em',
            color: C.text,
          }}
        >
          buffer <span style={{ color: C.green }}>4.6% → 9.6%</span>
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 40,
          textAlign: 'center',
          fontFamily: F.mono,
          fontSize: 12,
          letterSpacing: 2.6,
          color: C.faint,
          opacity: danger,
        }}
      >
        REPLAY · NO LIVE MARKET DATA
      </div>

      {/* green wipe into the existing hook */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          bottom: 0,
          height: 3,
          width: `${endWipe * 100}%`,
          background: C.green,
          boxShadow: `0 0 24px ${C.green}`,
        }}
      />
    </div>
  )
}
