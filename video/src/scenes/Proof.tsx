import { Img, OffthreadVideo, interpolate, spring, staticFile, useCurrentFrame } from 'remotion'
import { CLAMP } from '../anim'
import { PROOF_SLOTS, type ProofSlot } from '../config'
import { C, F } from '../theme'
import { FPS } from '../timeline'

const IMG_W = 1152
const IMG_H = 576

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
  const ken = interpolate(localFrame, [0, slot.durationInFrames], [1.02, 1], CLAMP)
  const panelIn = spring({
    frame: localFrame - 10,
    fps: FPS,
    config: { damping: 200, mass: 0.6 },
  })

  const highlightIn = interpolate(localFrame, [20, 34], [0, 1], CLAMP)
  const pulse = 0.55 + 0.3 * Math.abs(Math.sin(localFrame / 14))

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      {/* simulator window */}
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
            EVEN HUB SIMULATOR · 576 × 288
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
              color: C.red,
              opacity: 0.8,
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: 4,
                background: C.red,
                boxShadow: `0 0 10px ${C.red}`,
              }}
            />
            REC
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
              width: '100%',
              height: '100%',
              transform: `scale(${ken})`,
              transformOrigin: 'center center',
            }}
          >
            {slot.kind === 'video' ? (
              <OffthreadVideo
                src={staticFile(slot.src)}
                muted
                style={{ width: IMG_W, height: IMG_H, objectFit: 'cover' }}
              />
            ) : (
              <Img
                src={staticFile(slot.src)}
                style={{ width: IMG_W, height: IMG_H, imageRendering: 'pixelated' }}
              />
            )}
          </div>

          {slot.highlight ? (
            <div
              style={{
                position: 'absolute',
                left: slot.highlight.x * 2,
                top: slot.highlight.y * 2,
                width: slot.highlight.w * 2,
                height: slot.highlight.h * 2,
                border: `2px solid ${C.green}`,
                borderRadius: 8,
                boxShadow: `0 0 24px rgba(70,224,138,0.45)`,
                opacity: highlightIn * pulse,
              }}
            >
              {slot.highlight.label ? (
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: -30,
                    padding: '3px 10px',
                    background: 'rgba(4,12,8,0.92)',
                    border: `1px solid ${C.green}`,
                    borderRadius: 4,
                    fontFamily: F.mono,
                    fontSize: 12,
                    letterSpacing: 2,
                    color: C.green,
                    whiteSpace: 'nowrap',
                    opacity: highlightIn,
                  }}
                >
                  {slot.highlight.label}
                </div>
              ) : null}
            </div>
          ) : null}

          {slot.waveform ? (
            <div
              style={{
                position: 'absolute',
                right: 40,
                top: 196,
                width: 420,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end',
                gap: 12,
              }}
            >
              <div
                style={{
                  fontFamily: F.mono,
                  fontSize: 11,
                  letterSpacing: 2.4,
                  color: C.green,
                  opacity: 0.7,
                }}
              >
                16 kHz · LIVE
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height: 92 }}>
                {Array.from({ length: 24 }).map((_, i) => {
                  const h =
                    10 +
                    Math.abs(Math.sin(localFrame / 3.2 + i * 0.55)) *
                      (24 + 52 * Math.abs(Math.sin(i * 0.7)))
                  return (
                    <span
                      key={i}
                      style={{
                        width: 5,
                        height: h,
                        borderRadius: 3,
                        background: C.green,
                        opacity: 0.35 + 0.5 * Math.abs(Math.sin(localFrame / 5 + i * 0.4)),
                      }}
                    />
                  )
                })}
              </div>
            </div>
          ) : null}

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
            bottom: 12,
            fontFamily: F.mono,
            fontSize: 11,
            letterSpacing: 2,
            color: C.faint,
            opacity: 0.7,
          }}
        >
          REAL SIMULATOR CAPTURE · BINANCE FUTURES TESTNET
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
          <span style={{ color: C.faint }}>REAL PROOF</span>
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

        <div style={{ marginTop: 44, display: 'flex', flexDirection: 'column', gap: 18 }}>
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

        <div style={{ display: 'flex', gap: 6, marginTop: 54 }}>
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
