import { interpolate } from 'remotion'
import { CLAMP } from '../anim'
import type { ProofSlot } from '../config'
import { formatEta } from '../format'
import {
  HudAlertArmed,
  HudAlertHit,
  HudConfirm,
  HudFilled,
  HudListening,
  HudPosition,
  HudThinking,
  type HudReceipt,
  snapshot,
} from './HudScreen'

const ENTRY = 61492.88
const LIQ = 58684.4
const BASE_MARK = 61486.88

/** Derived from the recorded pre-close position and the isolated-margin formula. */
const RECEIPT: HudReceipt = {
  liqBefore: '58,684',
  liqAfter: '55,591',
  bufferBefore: '4.6%',
  bufferAfter: '9.6%',
}

/** Deterministic walk around the captured mark price; stays inside the 4.6% bucket. */
const OFFSETS = [0, 8, -2, 12, 3, -4, 6, 1, 10, -3, 5, 14, 2, -2, 7, 0, 9, -4, 4, -1, 11, 1, 13, -3]

const fade = (frame: number, start: number, end: number, length = 8) =>
  Math.min(
    interpolate(frame, [start, start + length], [0, 1], CLAMP),
    interpolate(frame, [end - length, end], [1, 0], CLAMP),
  )

const Layer: React.FC<{ opacity: number; children: React.ReactNode }> = ({ opacity, children }) => (
  <div style={{ position: 'absolute', inset: 0, opacity }}>{children}</div>
)

const TapRipple: React.FC<{ frame: number; start: number; x: number; y: number }> = ({
  frame,
  start,
  x,
  y,
}) => {
  const p = interpolate(frame, [start, start + 28], [0, 1], CLAMP)
  if (p <= 0 || p >= 1) return null
  const r = 8 + p * 34
  return (
    <div
      style={{
        position: 'absolute',
        left: x - r,
        top: y - r,
        width: r * 2,
        height: r * 2,
        borderRadius: r,
        border: '2px solid #00ff00',
        opacity: (1 - p) * 0.65,
      }}
    />
  )
}

/** Replays the seven real HUD screens, driven by the values in the captures. */
export const HudReplay: React.FC<{ slot: ProofSlot['id']; localFrame: number }> = ({
  slot,
  localFrame,
}) => {
  if (slot === 'hud') {
    const tick = Math.floor(localFrame / 24)
    const mark = BASE_MARK + OFFSETS[tick % OFFSETS.length]
    const s = snapshot(mark, 0.01, ENTRY, LIQ)
    const pnlPulse = 1 + 0.16 * Math.max(0, 1 - (localFrame % 24) / 6)
    const bracket = interpolate(localFrame, [54, 78], [0, 1], CLAMP)
    const bracketPulse = 0.55 + 0.2 * Math.abs(Math.sin(localFrame / 19))

    return (
      <div style={{ position: 'absolute', inset: 0 }}>
        <HudPosition
          qty={s.qty}
          pnl={s.pnl}
          roe={s.roe}
          liq={s.liq}
          distance={s.distance}
          pnlPulse={pnlPulse}
          statusPulse={0.82 + 0.18 * Math.abs(Math.sin(localFrame / 22))}
        />
        <div
          style={{
            position: 'absolute',
            left: 24,
            top: 164,
            width: 312,
            height: 38,
            border: '1px solid #00ff00',
            borderRadius: 5,
            opacity: bracket * bracketPulse,
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: 26,
            top: 146,
            fontFamily: '"SF Mono", Menlo, monospace',
            fontSize: 11,
            letterSpacing: 1.6,
            color: '#00ff00',
            opacity: bracket,
          }}
        >
          DISTANCE TO LIQ
        </div>
      </div>
    )
  }

  if (slot === 'voice') {
    const base = snapshot(BASE_MARK, 0.01, ENTRY, LIQ)
    const listeningPulse = 0.55 + 0.45 * Math.abs(Math.sin(localFrame / 9))
    const armedFlash = Math.max(0, 1 - (localFrame - 204) / 18)

    return (
      <div style={{ position: 'absolute', inset: 0 }}>
        <Layer opacity={fade(localFrame, 0, 168)}>
          <HudListening
            pulse={listeningPulse}
            hintPulse={0.82 + 0.18 * Math.abs(Math.sin(localFrame / 13))}
          />
        </Layer>
        <Layer opacity={fade(localFrame, 160, 204)}>
          <HudThinking message="Transcribing" />
        </Layer>
        <Layer opacity={fade(localFrame, 204, 312)}>
          <HudAlertArmed price="61,500" direction="Fires below" flash={armedFlash} />
        </Layer>
        <Layer opacity={fade(localFrame, 312, 480)}>
          <HudPosition
            qty={base.qty}
            pnl={base.pnl}
            roe={base.roe}
            liq={base.liq}
            distance={base.distance}
            status="BINANCE TESTNET · ALERT 61,500"
            statusPulse={0.85 + 0.15 * Math.abs(Math.sin(localFrame / 18))}
          />
        </Layer>
      </div>
    )
  }

  if (slot === 'alert') {
    const base = snapshot(BASE_MARK, 0.01, ENTRY, LIQ)
    const flash = Math.max(0, 1 - localFrame / 34)

    return (
      <div style={{ position: 'absolute', inset: 0 }}>
        <Layer opacity={fade(localFrame, 0, 320)}>
          <HudAlertHit
            symbol="BTCUSDT"
            price={base.price}
            distance={base.distance}
            flash={flash}
            pulse={0.65 + 0.35 * Math.abs(Math.sin(localFrame / 10))}
          />
        </Layer>
        <Layer opacity={fade(localFrame, 316, 360)}>
          <HudPosition
            qty={base.qty}
            pnl={base.pnl}
            roe={base.roe}
            liq={base.liq}
            distance={base.distance}
            statusPulse={0.85 + 0.15 * Math.abs(Math.sin(localFrame / 16))}
          />
        </Layer>
        <TapRipple frame={localFrame} start={290} x={288} y={232} />
      </div>
    )
  }

  if (slot === 'eta') {
    // A clean 700 USDT/min fall toward the captured liq line. The ETA is what
    // the app's three-minute fit would show for this tape; no live data.
    const mark = BASE_MARK - (localFrame / 30) * (700 / 60)
    const s = snapshot(mark, 0.01, ENTRY, LIQ)
    const minutes = Math.max(0.5, (mark - LIQ) / 700)
    const hint = `LIQ IN ${formatEta(minutes)} at this pace · buffer ${s.distance}%`

    return (
      <div style={{ position: 'absolute', inset: 0 }}>
        <HudPosition
          qty={s.qty}
          pnl={s.pnl}
          roe={s.roe}
          liq={s.liq}
          distance={s.distance}
          hint={hint}
          hintTone="bright"
          statusPulse={0.85 + 0.15 * Math.abs(Math.sin(localFrame / 18))}
        />
      </div>
    )
  }

  if (slot === 'confirm') {
    return (
      <div style={{ position: 'absolute', inset: 0 }}>
        <Layer opacity={fade(localFrame, 0, 366)}>
          <HudConfirm selected="no" />
        </Layer>
        <Layer opacity={fade(localFrame, 360, 444)}>
          <HudConfirm selected="yes" />
        </Layer>
        <Layer opacity={fade(localFrame, 438, 480)}>
          <HudThinking message="Sending testnet order" />
        </Layer>
        <TapRipple frame={localFrame} start={420} x={500} y={207} />
      </div>
    )
  }

  // fill + receipt
  const flash = Math.max(0, 1 - localFrame / 24)
  const bracket = interpolate(localFrame, [20, 44], [0, 1], CLAMP)
  const bracketPulse = 0.55 + 0.2 * Math.abs(Math.sin(localFrame / 16))

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <HudFilled qty="0.005" price="61,502.9" left="0.005" flash={flash} receipt={RECEIPT} />
      {slot === 'receipt' ? (
        <div
          style={{
            position: 'absolute',
            left: 24,
            top: 104,
            width: 520,
            height: 34,
            border: '1px solid #00ff00',
            borderRadius: 5,
            opacity: bracket * bracketPulse,
          }}
        />
      ) : null}
    </div>
  )
}
