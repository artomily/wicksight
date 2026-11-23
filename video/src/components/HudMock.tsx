import { F } from '../theme'

interface HudMockProps {
  pnl?: string
  roe?: string
  qty?: string
  mark?: string
  distance?: string
  hint?: string
  showHint?: boolean
}

/**
 * A faithful recreation of the 576×288 glasses HUD, used for the product
 * reveal. The later proof section uses the real simulator captures.
 */
export const HudMock: React.FC<HudMockProps> = ({
  pnl = '+9.64',
  roe = '+30.5',
  qty = '0.01',
  mark = '58,684.4',
  distance = '4.6',
  hint = 'Hold: speak · 2x exit',
  showHint = true,
}) => {
  const bright = 'rgba(141, 255, 184, 0.95)'
  const dim = 'rgba(141, 255, 184, 0.52)'

  return (
    <div
      style={{
        width: 576,
        height: 288,
        position: 'relative',
        background: '#000',
        overflow: 'hidden',
        fontFamily: F.display,
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 28,
          top: 2,
          fontSize: 15,
          lineHeight: '27px',
          color: dim,
          letterSpacing: 0.2,
          whiteSpace: 'pre',
        }}
      >
        {'● BINANCE TESTNET · 20x'}
      </div>

      <div
        style={{
          position: 'absolute',
          left: 28,
          top: 58,
          fontSize: 19,
          lineHeight: '27px',
          color: bright,
          whiteSpace: 'pre',
          letterSpacing: 0.1,
        }}
      >
        {`BTCUSDT LONG ${qty} · 20x\n\nPnL ${pnl} USDT · ROE ${roe}%\n\nLiq ${mark} · ${distance}% away`}
      </div>

      {showHint ? (
        <div
          style={{
            position: 'absolute',
            left: 28,
            top: 240,
            fontSize: 15,
            lineHeight: '27px',
            color: dim,
            whiteSpace: 'pre',
          }}
        >
          {hint}
        </div>
      ) : null}
    </div>
  )
}
