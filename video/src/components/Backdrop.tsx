import { AbsoluteFill, useCurrentFrame } from 'remotion'
import { C } from '../theme'

export const Backdrop: React.FC = () => {
  const frame = useCurrentFrame()
  const drift = Math.sin(frame / 120) * 30

  return (
    <AbsoluteFill style={{ backgroundColor: C.bg, overflow: 'hidden' }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(1000px 680px at ${50 + drift / 40}% -8%, rgba(70,224,138,0.16), transparent 64%)`,
        }}
      />
      <AbsoluteFill
        style={{
          background: 'radial-gradient(760px 560px at 94% 108%, rgba(70,224,138,0.075), transparent 62%)',
        }}
      />
      <AbsoluteFill
        style={{
          opacity: 0.05,
          backgroundImage:
            'linear-gradient(rgba(150,255,190,0.55) 1px, transparent 1px), linear-gradient(90deg, rgba(150,255,190,0.55) 1px, transparent 1px)',
          backgroundSize: '96px 96px',
          maskImage: 'radial-gradient(circle at 50% 42%, black 10%, transparent 78%)',
          WebkitMaskImage: 'radial-gradient(circle at 50% 42%, black 10%, transparent 78%)',
        }}
      />
      <AbsoluteFill
        style={{
          background: 'radial-gradient(circle at 50% 50%, transparent 52%, rgba(0,0,0,0.72) 100%)',
        }}
      />
    </AbsoluteFill>
  )
}
