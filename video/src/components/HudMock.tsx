import { HudPosition } from './HudScreen'

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
 * The product reveal uses the same faithful HUD as the replay, so the video
 * never shows two different versions of the same screen.
 */
export const HudMock: React.FC<HudMockProps> = ({
  pnl = '-0.06',
  roe = '-0.2%',
  qty = '0.01',
  mark = '58,684.4',
  distance = '4.6',
  hint = 'Hold: speak · 2x exit',
  showHint = true,
}) => (
  <div style={{ width: 576, height: 288, position: 'relative', background: '#000', overflow: 'hidden' }}>
    <HudPosition
      pnl={pnl}
      roe={roe}
      qty={qty}
      liq={mark}
      distance={distance}
      hint={hint}
      showHint={showHint}
    />
  </div>
)
