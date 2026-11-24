import { interpolate, spring, useCurrentFrame } from 'remotion'
import { CLAMP } from '../anim'
import { PROOF_SLOTS, type ProofSlot } from '../config'
import { HudReplay } from '../components/HudReplay'
import { C, F } from '../theme'
import { FPS } from '../timeline'

const IMG_W = 1152
const IMG_H = 576

/** A typed transcript of what the glasses heard, so the voice beat reads muted. */
const Heard: React.FC<{ localFrame: number; text: string }> = ({ localFrame, text }) => {
  const progress = interpolate(localFrame, [26, 78], [0, 1], CLAMP)
  const shown = text.slice(0, Math.floor(progress * text.length))
  const done = progress >= 1
  const cursor = localFrame % 30 < 16 ? 1 : 0
  const fadeIn = interpolate(localFrame, [20, 32], [0, 1], CLAMP)

  return (
    <div style={{ marginTop: 30, opacity: fadeIn }}>
      <div
        style={{
          fontFamily: F.mono,
          fontSize: 11,
          letterSpacing: 2.4,
          color: C.faint,
        }}
      >
        HEARD
      </div>
      <div
        style={{
          marginTop: 8,
          fontFamily: F.mono,
          fontSize: 17,
          letterSpacing: 0.4,
          color: C.green,
          whiteSpace: 'pre',
        }}
      >
        {`"${shown}`}
        {done ? '"' : <span style={{ opacity: cursor }}>|</span>}
      </div>
    </div>
  )
}

const ProofScene: React.FC<{ slot: ProofSlot; localFrame: number; index: number }> = ({
  slot,
  localFrame,
  index,
}) => {
  const enter = spring({
    frame: localFrame,
    fps: FPS,
    config: { damping: 200, mass: 0.6 },
  })
  const panelIn = spring({
    frame: localFrame - 10,
    fps: FPS,
    config: { damping: 200, mass: 0.6 },
  })

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      {/* simulator window — a replay of the glasses canvas, not a recording */}
      <div
        style={{
          position: 'absolute',
          left: 90,
          top: 168,
          width: 1220,
          height: 660,
          borderRadius: 18,
          background: C.panel,
          border: `1px solid ${C.line}`,
          boxShadow: '0 30px 90px rgba(0,0,0,0.55), 0 0 70px rgba(70,224,138,0.06)',
          opacity: enter,
          transform: `translateY(${(1 - enter) * 26}px)`,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: 44,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '0 18px',
            borderBottom: `1px solid ${C.line}`,
            background: 'rgba(255,255,255,0.015)',
          }}
        >
          {[0, 1, 2].map((dot) => (
            <span
              key={dot}
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                background: 'rgba(160, 210, 180, 0.22)',
              }}
            />
          ))}
          <span
            style={{
              marginLeft: 12,
              fontFamily: F.mono,
              fontSize: 12,
              letterSpacing: 1.8,
              color: C.faint,
            }}
          >
            EVEN HUB · HUD REPLAY · 576 × 288
          </span>
          <span
            style={{
              marginLeft: 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontFamily: F.mono,
              fontSize: 12,
              letterSpacing: 2,
              color: C.green,
              opacity: 0.85,
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: 4,
                background: C.green,
                boxShadow: `0 0 10px ${C.green}`,
              }}
            />
            REPLAY
          </span>
        </div>

        <div
          style={{
            position: 'absolute',
            left: 34,
            top: 62,
            width: IMG_W,
            height: IMG_H,
            overflow: 'hidden',
            background: '#000',
            borderRadius: 4,
          }}
        >
          <div
            style={{
              width: 576,
              height: 288,
              transform: 'scale(2)',
              transformOrigin: 'top left',
            }}
          >
            <HudReplay slot={slot.id} localFrame={localFrame} />
          </div>

          <div
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'repeating-linear-gradient(transparent 0 3px, rgba(0,0,0,0.10) 3px 4px)',
              pointerEvents: 'none',
            }}
          />
        </div>

        <div
          style={{
            position: 'absolute',
            left: 34,
            right: 34,
            bottom: 12,
            display: 'flex',
            justifyContent: 'space-between',
            fontFamily: F.mono,
            fontSize: 11,
            letterSpacing: 1.8,
            color: C.faint,
            opacity: 0.75,
          }}
        >
          <span>REPLAY · RECORDED TESTNET HUD · 23 NOV 2026</span>
          <span style={{ color: C.greenDim }}>NO LIVE MARKET DATA</span>
        </div>
      </div>

      {/* right panel */}
      <div
        style={{
          position: 'absolute',
          left: 1372,
          top: 196,
          width: 452,
          opacity: panelIn,
          transform: `translateY(${(1 - panelIn) * 24}px)`,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontFamily: F.mono,
            fontSize: 16,
            letterSpacing: 2.4,
          }}
        >
          <span style={{ color: C.green }}>{slot.step}</span>
          <span style={{ color: C.faint }}>TESTNET PROOF · REPLAY</span>
        </div>

        <div
          style={{
            width: 48,
            height: 2,
            background: C.green,
            marginTop: 16,
            marginBottom: 26,
          }}
        />

        <div
          style={{
            fontFamily: F.mono,
            fontSize: 13,
            letterSpacing: 3,
            color: C.faint,
          }}
        >
          {slot.kicker}
        </div>

        <div
          style={{
            fontFamily: F.display,
            fontSize: 58,
            lineHeight: 1.04,
            fontWeight: 750,
            letterSpacing: '-0.035em',
            color: C.text,
            whiteSpace: 'pre-line',
            marginTop: 16,
          }}
        >
          {slot.title}
        </div>

        <div style={{ marginTop: 40, display: 'flex', flexDirection: 'column', gap: 18 }}>
          {slot.chips.map((chip, chipIndex) => {
            const p = spring({
              frame: localFrame - 24 - chipIndex * 9,
              fps: FPS,
              config: { damping: 200, mass: 0.5 },
            })
            return (
              <div
                key={chip}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  opacity: p,
                  transform: `translateX(${(1 - p) * 16}px)`,
                }}
              >
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: 4,
                    background: C.green,
                    boxShadow: `0 0 12px ${C.green}`,
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    fontFamily: F.display,
                    fontSize: 24,
                    color: C.muted,
                    letterSpacing: '-0.01em',
                  }}
                >
                  {chip}
                </span>
              </div>
            )
          })}
        </div>

        {slot.id === 'voice' ? <Heard localFrame={localFrame} text="alert 61,500" /> : null}

        <div style={{ display: 'flex', gap: 6, marginTop: 40 }}>
          {PROOF_SLOTS.map((_, segment) => (
            <span
              key={segment}
              style={{
                width: 54,
                height: 3,
                borderRadius: 2,
                background: segment === index ? C.green : 'rgba(120,220,160,0.16)',
                boxShadow: segment === index ? `0 0 12px ${C.green}` : 'none',
              }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

export const Proof: React.FC = () => {
  const frame = useCurrentFrame()

  let cursor = 0
  for (let index = 0; index < PROOF_SLOTS.length; index++) {
    const slot = PROOF_SLOTS[index]
    if (frame >= cursor && frame < cursor + slot.durationInFrames) {
      return <ProofScene slot={slot} localFrame={frame - cursor} index={index} />
    }
    cursor += slot.durationInFrames
  }

  return null
}
