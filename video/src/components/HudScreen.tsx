import type { CSSProperties, ReactNode } from 'react'
import { fmtPct, fmtPrice, fmtQty, fmtSigned } from '../format'

/**
 * Faithful 576×288 recreation of the WickSight HUD.
 *
 * Geometry comes from the real captures in `public/` (text at x=28, status at
 * y=4, 54 px between main lines, hint at y=242). Colours are sampled from the
 * captures: main text is #00ff00, status/hint are 197/255 green.
 *
 * This is used as a labelled replay, not as live footage.
 */
export const HUD_W = 576
export const HUD_H = 288

const GREEN = '#00ff00'
const MID = 'rgb(0, 230, 0)'
const DIM = 'rgb(0, 197, 0)'
const FONT = '"Arial Narrow", "Helvetica Neue", Arial, sans-serif'

const Line: React.FC<{
  top: number
  left?: number
  color?: string
  size?: number
  weight?: number
  children: ReactNode
  style?: CSSProperties
}> = ({ top, left = 28, color = GREEN, size = 23, weight = 500, children, style }) => (
  <div
    style={{
      position: 'absolute',
      left,
      top,
      fontFamily: FONT,
      fontSize: size,
      fontWeight: weight,
      lineHeight: 1,
      letterSpacing: '-0.2px',
      color,
      whiteSpace: 'pre',
      ...style,
    }}
  >
    {children}
  </div>
)

const Status: React.FC<{ text: string; pulse?: number }> = ({ text, pulse = 1 }) => (
  <>
    <div
      style={{
        position: 'absolute',
        left: 28,
        top: 11,
        width: 12,
        height: 12,
        borderRadius: 6,
        background: DIM,
        opacity: pulse,
      }}
    />
    <Line top={3} left={47} color={DIM} size={22}>
      {text}
    </Line>
  </>
)

export interface HudPositionProps {
  qty?: string
  pnl?: string
  roe?: string
  liq?: string
  distance?: string
  hint?: string
  hintTone?: 'dim' | 'bright'
  status?: string
  statusPulse?: number
  showHint?: boolean
  pnlPulse?: number
  pnlHighlight?: boolean
}

/** The position screen, exactly as it looks on the glasses. */
export const HudPosition: React.FC<HudPositionProps> = ({
  qty = '0.01',
  pnl = '-0.06',
  roe = '-0.2%',
  liq = '58,684.4',
  distance = '4.6',
  hint = 'Hold: speak · 2x exit',
  hintTone = 'dim',
  status = 'BINANCE TESTNET · 20x',
  statusPulse = 1,
  showHint = true,
  pnlPulse = 1,
  pnlHighlight = false,
}) => (
  <div style={{ position: 'absolute', inset: 0, background: '#000' }}>
    <Status text={status} pulse={statusPulse} />
    <Line top={64}>BTCUSDT LONG {qty} · 20x</Line>
    <div
      style={{
        position: 'absolute',
        inset: 0,
        filter: `brightness(${pnlPulse})`,
      }}
    >
      <Line top={118}>PnL {pnl} USDT · ROE {roe}</Line>
    </div>
    <Line top={172}>
      Liq {liq} · {distance}% away
    </Line>
    {pnlHighlight ? (
      <div
        style={{
          position: 'absolute',
          left: 25,
          top: 114,
          width: 352,
          height: 32,
          border: `1px solid ${GREEN}`,
          borderRadius: 3,
          opacity: 0.55,
        }}
      />
    ) : null}
    {showHint ? (
      <Line top={242} color={hintTone === 'bright' ? GREEN : DIM} size={22}>
        {hint}
      </Line>
    ) : null}
  </div>
)

export const HudListening: React.FC<{ pulse: number; hintPulse?: number }> = ({
  pulse,
  hintPulse = 1,
}) => (
  <div style={{ position: 'absolute', inset: 0, background: '#000' }}>
    <Status text="MIC ON" pulse={pulse} />
    <Line top={56}>Listening</Line>
    <Line top={110}>Speak now</Line>
    <Line top={242} color={DIM} size={22} style={{ opacity: hintPulse }}>
      alert 62,000 · close half
    </Line>
  </div>
)

export const HudThinking: React.FC<{ message: string }> = ({ message }) => (
  <div style={{ position: 'absolute', inset: 0, background: '#000' }}>
    <Status text="MIC OFF" pulse={0.55} />
    <Line top={64}>{message}</Line>
    <Line top={118}>One moment</Line>
    <Line top={242} color={DIM} size={22}>
      {' '}
    </Line>
  </div>
)

export const HudAlertArmed: React.FC<{ price: string; direction: string; flash?: number }> = ({
  price,
  direction,
  flash = 0,
}) => (
  <div style={{ position: 'absolute', inset: 0, background: '#000' }}>
    <Status text="ALERT ARMED" />
    <Line top={56}>Alert set</Line>
    <Line top={110} style={{ filter: `brightness(${1 + flash * 0.35})` }}>
      {price}
    </Line>
    <Line top={164}>{direction}</Line>
    <Line top={242} color={DIM} size={22}>
      While app is open
    </Line>
  </div>
)

export const HudAlertHit: React.FC<{
  symbol: string
  price: string
  distance: string
  flash: number
  pulse: number
}> = ({ symbol, price, distance, flash, pulse }) => (
  <div style={{ position: 'absolute', inset: 0, background: '#000' }}>
    <Status text="ALERT HIT" pulse={pulse} />
    <Line top={48}>{symbol}</Line>
    <Line top={102} style={{ filter: `brightness(${1 + flash * 0.4})` }}>
      {price}
    </Line>
    <Line top={156}>Liq {distance}% away</Line>
    <Line top={242} color={DIM} size={22}>
      Tap to dismiss
    </Line>
  </div>
)

export const HudConfirm: React.FC<{ selected: 'no' | 'yes'; qty?: string; open?: string }> = ({
  selected,
  qty = '0.005',
  open = '0.01',
}) => {
  const row = (label: string, top: number, active: boolean) => (
    <div
      style={{
        position: 'absolute',
        left: 28,
        top,
        width: 520,
        height: 50,
        display: 'flex',
        alignItems: 'center',
        paddingLeft: 8,
        border: active ? `1px solid ${GREEN}` : '1px solid transparent',
        borderRadius: 4,
        color: active ? GREEN : DIM,
        fontFamily: FONT,
        fontSize: 23,
        fontWeight: 500,
        letterSpacing: '-0.2px',
      }}
    >
      {label}
    </div>
  )

  return (
    <div style={{ position: 'absolute', inset: 0, background: '#000' }}>
      <Status text="CONFIRM" />
      <Line top={34}>Close half?</Line>
      <Line top={72} color={MID} size={22}>
        BTCUSDT LONG · {open} open
      </Line>
      {row(`No, keep ${open}`, 124, selected === 'no')}
      {row(`Yes, sell ${qty}`, 182, selected === 'yes')}
      <Line top={242} color={DIM} size={22}>
        Swipe to change · tap to confirm
      </Line>
    </div>
  )
}

export interface HudReceipt {
  liqBefore: string
  liqAfter: string
  bufferBefore: string
  bufferAfter: string
}

export const HudFilled: React.FC<{
  qty: string
  price: string
  left: string
  flash?: number
  receipt?: HudReceipt
}> = ({ qty, price, left, flash = 0, receipt }) => (
  <div style={{ position: 'absolute', inset: 0, background: '#000' }}>
    <Status text="FILLED" pulse={0.8 + 0.2 * Math.abs(Math.sin(flash * Math.PI))} />
    <Line top={56}>Closed half</Line>
    {receipt ? (
      <>
        <Line top={110} size={22}>
          {`Liq ${receipt.liqBefore} → ${receipt.liqAfter} · buffer ${receipt.bufferBefore} → ${receipt.bufferAfter}`}
        </Line>
        <Line top={164}>
          Sold {qty} BTCUSDT @ {price}
        </Line>
      </>
    ) : (
      <>
        <Line top={110}>Sold {qty} BTCUSDT</Line>
        <Line top={137}>@ {price}</Line>
      </>
    )}
    <Line top={242} color={DIM} size={22}>
      Left {left}
    </Line>
  </div>
)

export interface HudSnapshot {
  mark: number
  entry: number
  qty: number
  liq: number
}

export const snapshot = (mark: number, qty: number, entry = 61492.88, liq = 58684.4) => {
  const pnl = (mark - entry) * qty
  const margin = (entry * qty) / 20
  const roe = margin > 0 ? (pnl / margin) * 100 : 0
  const distance = mark > 0 ? ((mark - liq) / mark) * 100 : 0
  return {
    pnl: fmtSigned(pnl),
    roe: fmtPct(roe),
    qty: fmtQty(qty, 3),
    liq: fmtPrice(liq, 1),
    distance: distance.toFixed(1),
    price: fmtPrice(mark, 2),
  }
}

export const HUD_COLORS = { green: GREEN, dim: DIM, font: FONT }
