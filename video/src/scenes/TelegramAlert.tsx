import { interpolate, spring, useCurrentFrame } from 'remotion'
import { C, F } from '../theme'
import { FPS } from '../timeline'

/**
 * Background-alert beat: phone in another app, Telegram notification, then the
 * full message in Telegram. The message text is the real `etaMessage` format
 * from server/telegram.ts, with the captured BTC position values.
 */
const MESSAGE = [
  '⚠ WickSight: liquidation ETA',
  '',
  'BTCUSDT LONG 0.01 · 20x',
  'Liq 58,684.4 · buffer 4.6%',
  'LIQ IN ~4m at this pace',
  '',
  'Close half on glasses: wicksight://close-half?symbol=BTCUSDT',
  'No order is sent from this message.',
]

const MapApp: React.FC = () => (
  <div style={{ position: 'absolute', inset: 0, background: '#0a1511', overflow: 'hidden' }}>
    <div
      style={{
        position: 'absolute',
        inset: -40,
        backgroundImage:
          'linear-gradient(rgba(120,200,160,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(120,200,160,0.08) 1px, transparent 1px)',
        backgroundSize: '44px 44px',
        transform: 'rotate(-8deg)',
      }}
    />
    <div style={{ position: 'absolute', left: -20, top: 260, width: 520, height: 16, background: '#182a22', transform: 'rotate(18deg)' }} />
    <div style={{ position: 'absolute', left: -30, top: 560, width: 540, height: 11, background: '#15241d', transform: 'rotate(-12deg)' }} />
    <div style={{ position: 'absolute', left: 120, top: 80, width: 12, height: 900, background: '#15241d', transform: 'rotate(22deg)' }} />
    <svg width="440" height="916" style={{ position: 'absolute', inset: 0 }}>
      <path d="M 70 760 C 120 640, 150 620, 190 520 S 250 340, 340 240" fill="none" stroke="#46e08a" strokeWidth="7" strokeLinecap="round" opacity="0.9" />
      <path d="M 70 760 C 120 640, 150 620, 190 520 S 250 340, 340 240" fill="none" stroke="#b8ffd5" strokeWidth="2" strokeLinecap="round" opacity="0.8" />
    </svg>
    <div style={{ position: 'absolute', left: 38, top: 44, right: 38, height: 46, borderRadius: 14, background: 'rgba(10,22,17,0.92)', border: '1px solid rgba(120,200,160,0.2)', display: 'flex', alignItems: 'center', padding: '0 16px', gap: 10, fontFamily: F.display, fontSize: 14, color: C.muted }}>
      <span style={{ color: C.green, fontSize: 16 }}>⌕</span> Where to?
    </div>
    <div style={{ position: 'absolute', left: 330, top: 226, width: 20, height: 20, borderRadius: 10, background: C.green, boxShadow: `0 0 24px ${C.green}` }} />
    <div style={{ position: 'absolute', left: 36, right: 36, bottom: 30, borderRadius: 18, background: 'rgba(10,22,17,0.94)', border: '1px solid rgba(120,200,160,0.2)', padding: '16px 18px', fontFamily: F.display }}>
      <div style={{ fontSize: 11, letterSpacing: 1.6, color: C.faint, fontFamily: F.mono }}>CITY RIDE</div>
      <div style={{ fontSize: 19, color: C.text, marginTop: 4 }}>Docklands → City · 12 min</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, fontSize: 12, color: C.muted }}>
        <span style={{ width: 6, height: 6, borderRadius: 3, background: C.green }} /> Driver 3 min away
      </div>
    </div>
  </div>
)

const TelegramChat: React.FC<{ glasses: number }> = ({ glasses }) => (
  <div style={{ position: 'absolute', inset: 0, background: '#0e1621', display: 'flex', flexDirection: 'column' }}>
    <div style={{ height: 62, display: 'flex', alignItems: 'center', gap: 10, padding: '0 14px', background: '#17212b', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      <span style={{ color: '#6ab3ff', fontSize: 26, lineHeight: 1 }}>‹</span>
      <div style={{ width: 34, height: 34, borderRadius: 17, background: '#229ED9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 16 }}>➤</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: F.display, fontSize: 14, color: '#fff', fontWeight: 600 }}>WickSight</div>
        <div style={{ fontFamily: F.mono, fontSize: 9, color: '#7d8f9e', letterSpacing: 1.2 }}>BOT</div>
      </div>
      <span style={{ color: '#7d8f9e', fontSize: 18 }}>⋮</span>
    </div>
    <div style={{ flex: 1, padding: '16px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ alignSelf: 'center', fontFamily: F.mono, fontSize: 9, letterSpacing: 1.2, color: '#6f8392', background: 'rgba(23,33,43,0.9)', padding: '3px 8px', borderRadius: 8 }}>TODAY</div>
      <div style={{ alignSelf: 'flex-start', maxWidth: 380, background: '#182b3a', border: '1px solid rgba(106,179,255,0.16)', borderRadius: '14px 14px 14px 4px', padding: '12px 14px' }}>
        {MESSAGE.map((line, i) => {
          const link = line.startsWith('Close half')
          return (
            <div
              key={`${i}-${line}`}
              style={{
                fontFamily: F.mono,
                fontSize: 11,
                lineHeight: 1.55,
                whiteSpace: 'pre-wrap',
                color: link ? '#6ab3ff' : '#e6f1ff',
                minHeight: line === '' ? 8 : undefined,
              }}
            >
              {line}
            </div>
          )
        })}
        <div style={{ marginTop: 8, textAlign: 'right', fontFamily: F.mono, fontSize: 8.5, color: '#7d8f9e' }}>5:40 PM · bot</div>
      </div>
      <div style={{ alignSelf: 'flex-start', fontFamily: F.mono, fontSize: 9, color: '#6f8392' }}>Telegram</div>
    </div>
    <div style={{ height: 54, borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', padding: '0 12px', gap: 10 }}>
      <div style={{ flex: 1, height: 34, borderRadius: 17, background: '#17212b', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', padding: '0 12px', fontFamily: F.display, fontSize: 12, color: '#7d8f9e' }}>Message</div>
      <div style={{ width: 34, height: 34, borderRadius: 17, background: '#229ED9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 14 }}>➤</div>
    </div>
    <div
      style={{
        position: 'absolute',
        left: 16,
        right: 16,
        bottom: 66,
        opacity: glasses,
        transform: `translateY(${(1 - glasses) * 10}px)`,
        borderRadius: 12,
        background: 'rgba(70,224,138,0.12)',
        border: '1px solid rgba(70,224,138,0.45)',
        padding: '9px 12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontFamily: F.mono,
        fontSize: 10,
        letterSpacing: 1.2,
        color: C.green,
      }}
    >
      <span>GLANCE AT GLASSES</span>
      <span>CLOSE HALF →</span>
    </div>
  </div>
)

export const TelegramAlert: React.FC = () => {
  const frame = useCurrentFrame()
  const enter = spring({ frame, fps: FPS, config: { damping: 200, mass: 0.7 } })
  const notify = interpolate(frame, [46, 60], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const chat = interpolate(frame, [92, 98], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const glasses = interpolate(frame, [144, 158], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const tilt = -1.4 + Math.sin(frame / 42) * 0.25

  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: 40,
          top: 60,
          width: 760,
          height: 980,
          background: 'radial-gradient(closest-side, rgba(34,158,217,0.16), transparent 72%)',
          filter: 'blur(8px)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 170,
          top: 70,
          width: 460,
          height: 940,
          borderRadius: 58,
          background: '#0a0f0d',
          border: '1px solid #26352f',
          boxShadow: '0 50px 140px rgba(0,0,0,0.75), 0 0 90px rgba(34,158,217,0.12)',
          opacity: enter,
          transform: `translateY(${(1 - enter) * 24}px) rotate(${tilt}deg) scale(0.92)`,
          transformOrigin: 'top left',
        }}
      >
        <div style={{ position: 'absolute', left: 10, top: 10, width: 440, height: 916, borderRadius: 48, overflow: 'hidden', background: '#07100b' }}>
          <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 22px', fontFamily: F.mono, fontSize: 10, color: '#d7e6de', zIndex: 4 }}>
            <span>5:40</span>
            <span style={{ letterSpacing: 1.5 }}>5G ▮▮▮</span>
          </div>
          <div style={{ position: 'absolute', inset: 0, opacity: 1 - chat }}>
            <MapApp />
          </div>
          <div style={{ position: 'absolute', inset: 0, opacity: chat }}>
            <TelegramChat glasses={glasses} />
          </div>
          <div
            style={{
              position: 'absolute',
              left: 12,
              right: 12,
              top: 44,
              opacity: notify * (1 - chat),
              transform: `translateY(${(1 - notify) * -110}px)`,
              borderRadius: 18,
              background: 'rgba(18,28,34,0.98)',
              border: '1px solid rgba(255,255,255,0.08)',
              boxShadow: '0 18px 50px rgba(0,0,0,0.55)',
              padding: '12px 14px',
              display: 'flex',
              gap: 11,
              zIndex: 5,
            }}
          >
            <div style={{ width: 34, height: 34, borderRadius: 17, background: '#229ED9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 16, flexShrink: 0 }}>➤</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: F.mono, fontSize: 8.5, letterSpacing: 1.2, color: '#8fa3b2' }}>
                <span>TELEGRAM</span>
                <span>now</span>
              </div>
              <div style={{ fontFamily: F.display, fontSize: 13, color: '#fff', fontWeight: 600, marginTop: 1 }}>WickSight</div>
              <div style={{ fontFamily: F.display, fontSize: 11.5, color: '#d4e2ec', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                ⚠ LIQ IN ~4m · BTCUSDT LONG 0.01 · 20x
              </div>
            </div>
          </div>
          <div style={{ position: 'absolute', left: 190, top: 14, width: 60, height: 6, borderRadius: 3, background: '#0a0f0d', zIndex: 6 }} />
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          left: 860,
          top: 170,
          width: 880,
          opacity: enter,
          transform: `translateY(${(1 - enter) * 18}px)`,
        }}
      >
        <div style={{ fontFamily: F.mono, fontSize: 13, letterSpacing: 3.4, color: C.green }}>BACKGROUND ALERT · TELEGRAM</div>
        <div style={{ fontFamily: F.display, fontSize: 64, lineHeight: 1.03, fontWeight: 750, letterSpacing: '-0.045em', color: C.text, marginTop: 10, whiteSpace: 'pre-line' }}>
          {'In your pocket.\nStill finds you.'}
        </div>
        <div style={{ fontFamily: F.display, fontSize: 24, color: C.muted, marginTop: 12, letterSpacing: '-0.01em' }}>
          Right in Telegram. No order from the chat.
        </div>
        <div style={{ marginTop: 30, display: 'flex', gap: 10 }}>
          {['DELIVERED IN TELEGRAM', 'NO APP TO OPEN', 'GLASSES STILL ACTION'].map((chip) => (
            <span key={chip} style={{ fontFamily: F.mono, fontSize: 11, letterSpacing: 1.5, color: C.green, border: '1px solid rgba(70,224,138,0.3)', borderRadius: 999, padding: '8px 12px', background: 'rgba(70,224,138,0.05)' }}>{chip}</span>
          ))}
        </div>
        <div style={{ position: 'absolute', top: 360, left: 0, fontFamily: F.mono, fontSize: 10, letterSpacing: 1.6, color: C.faint }}>
          MOCK ALERT · REAL TELEGRAM MESSAGE FORMAT
        </div>
      </div>
    </>
  )
}
