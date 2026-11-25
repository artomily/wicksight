import { Img, interpolate, staticFile, useCurrentFrame } from 'remotion'
import { C, F } from '../theme'

/** One real Even Hub simulator screen, shown large and unedited. */
export const SimulatorShot: React.FC<{ duration?: number }> = ({ duration = 105 }) => {
  const frame = useCurrentFrame()
  const enter = interpolate(frame, [0, 10], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const exit = interpolate(frame, [duration - 8, duration], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const scale = 1 + (frame / duration) * 0.025

  return (
    <div style={{ position: 'absolute', inset: 0, opacity: Math.min(enter, exit) }}>
      <div
        style={{
          position: 'absolute',
          left: 120,
          top: 60,
          width: 1680,
          height: 940,
          background: 'radial-gradient(closest-side, rgba(70,224,138,0.14), transparent 72%)',
          filter: 'blur(10px)',
        }}
      />
      <div style={{ position: 'absolute', left: 60, top: 38, fontFamily: F.mono, fontSize: 13, letterSpacing: 3.4, color: C.green }}>
        EVEN HUB SIMULATOR · REAL G2 SCREEN
      </div>
      <div style={{ position: 'absolute', right: 60, top: 40, fontFamily: F.mono, fontSize: 11, letterSpacing: 1.8, color: C.faint }}>
        RECORDED 25 NOV 2026
      </div>
      <div
        style={{
          position: 'absolute',
          left: 153,
          top: 110,
          width: 1613,
          height: 806,
          transform: `scale(${scale})`,
          transformOrigin: 'center',
          borderRadius: 26,
          border: '1px solid rgba(120,240,170,0.3)',
          boxShadow: '0 40px 140px rgba(0,0,0,0.7), 0 0 100px rgba(70,224,138,0.16)',
          overflow: 'hidden',
          background: '#000',
        }}
      >
        <Img src={staticFile('evenhub-cycle.png')} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
      <div style={{ position: 'absolute', left: 60, top: 972, fontFamily: F.mono, fontSize: 11, letterSpacing: 1.8, color: C.muted }}>
        3 POSITIONS · RISKIEST SOL · 2/3 · 576 × 288
      </div>
    </div>
  )
}
