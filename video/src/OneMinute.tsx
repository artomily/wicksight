import {
  AbsoluteFill,
  Audio,
  Img,
  OffthreadVideo,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
} from 'remotion'
import { Backdrop } from './components/Backdrop'
import { CaptionTrack1Min } from './components/CaptionTrack1Min'
import {
  HudAlertArmed,
  HudConfirm,
  HudFilled,
  HudListening,
  HudMulti,
  HudPosition,
  HudThinking,
  type HudReceipt,
} from './components/HudScreen'
import { TelegramAlert } from './scenes/TelegramAlert'
import { SimulatorShot } from './scenes/SimulatorShot'
import { CAPTIONS_1MIN, CUES, VO_CLIPS } from './voV4.generated'
import { fmtPct, fmtSigned } from './format'
import { C, F } from './theme'
import type { VideoProps } from './config'
import { FPS } from './timeline'

const RECEIPT: HudReceipt = {
  liqBefore: '58,684',
  liqAfter: '55,591',
  bufferBefore: '4.6%',
  bufferAfter: '9.6%',
}

/**
 * v4 timeline, 60 s at 30 fps. The section boundaries follow the spoken
 * voice: the first four lines run a little long, so the multi-position beat
 * is trimmed and the close-half starts at 25.0 s while the last multi words
 * finish. The receipt/simulator/end beats start on their spoken cues so the
 * last line still ends before 60 s.
 */
const SECTIONS_1MIN = {
  concept: { from: 0, duration: 240 }, // 0.0-8.0
  telegram: { from: 240, duration: 198 }, // 8.0-14.6
  glance: { from: 438, duration: 120 }, // 14.6-18.6
  alert: { from: 558, duration: 120 }, // 18.6-22.6
  multi: { from: 678, duration: 72 }, // 22.6-25.0
  close: { from: 750, duration: 480 }, // 25.0-41.0
  receipt: { from: 1230, duration: 162 }, // 41.0-46.4
  simulator: { from: 1392, duration: 105 }, // 46.4-49.9
  end: { from: 1497, duration: 303 }, // 49.9-60.0
} as const

export const DURATION_1MIN = 1800

const DUCK_RAMP = 8
const MUSIC_LEVEL = 0.25
const MUSIC_DUCKED = 0.09

/** 25% bed, ducked to 9% under each VO clip with an 8-frame ramp. */
const musicVolume = (frame: number) => {
  let duck = 0
  for (const clip of VO_CLIPS) {
    const start = clip.from - DUCK_RAMP
    const end = clip.from + clip.frames + DUCK_RAMP
    if (frame >= start && frame <= end) {
      const inRamp = Math.min(1, (frame - start) / DUCK_RAMP)
      const outRamp = Math.min(1, (end - frame) / DUCK_RAMP)
      duck = Math.max(duck, Math.min(inRamp, outRamp))
    }
  }
  return MUSIC_LEVEL - (MUSIC_LEVEL - MUSIC_DUCKED) * duck
}

const ramp = (frame: number, start: number, end: number) =>
  interpolate(frame, [start, end], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

const fade = (frame: number, start: number, end: number, length = 8) =>
  Math.min(ramp(frame, start, start + length), 1 - ramp(frame, end - length, end))

const Head: React.FC<{
  frame: number
  kick: string
  title: string
  sub?: string
  danger?: boolean
}> = ({ frame, kick, title, sub, danger = false }) => {
  const p = spring({ frame: frame - 3, fps: FPS, config: { damping: 200, mass: 0.55 } })
  return (
    <div
      style={{
        position: 'absolute',
        left: 380,
        top: 82,
        width: 1160,
        opacity: p,
        transform: `translateY(${(1 - p) * 16}px)`,
      }}
    >
      <div
        style={{
          fontFamily: F.mono,
          fontSize: 13,
          letterSpacing: 3.4,
          color: danger ? C.red : C.green,
        }}
      >
        {kick}
      </div>
      <div
        style={{
          fontFamily: F.display,
          fontSize: 66,
          lineHeight: 1.02,
          fontWeight: 750,
          letterSpacing: '-0.045em',
          color: C.text,
          marginTop: 10,
          whiteSpace: 'pre-line',
        }}
      >
        {title}
      </div>
      {sub ? (
        <div
          style={{
            fontFamily: F.display,
            fontSize: 24,
            color: C.muted,
            marginTop: 10,
            letterSpacing: '-0.01em',
          }}
        >
          {sub}
        </div>
      ) : null}
    </div>
  )
}

const HudFrame: React.FC<{
  children: React.ReactNode
  frame: number
  badge?: string
  danger?: boolean
  footerLeft?: string
  footerRight?: string
}> = ({
  children,
  frame,
  badge = '● REPLAY · 23 NOV 2026',
  danger = false,
  footerLeft = 'RECORDED 23 NOV 2026 · BINANCE FUTURES TESTNET',
  footerRight = 'NO LIVE MARKET DATA',
}) => {
  const p = spring({ frame, fps: FPS, config: { damping: 200, mass: 0.6 } })
  return (
    <div
      style={{
        position: 'absolute',
        left: 380,
        top: 270,
        width: 1160,
        height: 590,
        borderRadius: 18,
        background: C.panel,
        border: `1px solid ${danger ? 'rgba(255,106,92,0.5)' : C.line}`,
        boxShadow: danger
          ? '0 30px 90px rgba(0,0,0,0.55), 0 0 80px rgba(255,106,92,0.10)'
          : '0 30px 90px rgba(0,0,0,0.55), 0 0 70px rgba(70,224,138,0.08)',
        opacity: p,
        transform: `translateY(${(1 - p) * 18}px)`,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          height: 42,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 22px',
          borderBottom: `1px solid ${C.line}`,
          fontFamily: F.mono,
          fontSize: 11,
          letterSpacing: 2,
          color: C.faint,
        }}
      >
        <span>EVEN G2 · HUD · 576 × 288</span>
        <span style={{ color: danger ? C.red : C.green }}>{badge}</span>
      </div>
      <div
        style={{
          position: 'absolute',
          left: 62,
          top: 46,
          width: 1036,
          height: 518,
          overflow: 'hidden',
          background: '#000',
        }}
      >
        <div style={{ width: 576, height: 288, transform: 'scale(1.8)', transformOrigin: 'top left' }}>
          {children}
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          left: 22,
          right: 22,
          bottom: 8,
          display: 'flex',
          justifyContent: 'space-between',
          fontFamily: F.mono,
          fontSize: 10,
          letterSpacing: 1.6,
          color: C.faint,
        }}
      >
        <span>{footerLeft}</span>
        <span>{footerRight}</span>
      </div>
    </div>
  )
}

/**
 * A large, glass-styled G2 lens frame. Used for the close-half close-ups:
 * the screen is the whole frame, the way it fills the lens.
 */
const LensFrame: React.FC<{
  children: React.ReactNode
  frame: number
  badge: string
  footerLeft?: string
  footerRight?: string
  flash?: number
}> = ({
  children,
  frame,
  badge,
  footerLeft = 'HUD REPLAY · RECORDED 23 NOV 2026 · BINANCE FUTURES TESTNET',
  footerRight = 'NO LIVE MARKET DATA',
  flash = 0,
}) => {
  const p = spring({ frame, fps: FPS, config: { damping: 200, mass: 0.55 } })
  const float = Math.sin(frame / 28) * 1.6
  const bracket = 'rgba(70,224,138,0.75)'
  return (
    <div
      style={{
        position: 'absolute',
        left: 290,
        top: 196,
        width: 1340,
        height: 700,
        opacity: p,
        transform: `translateY(${(1 - p) * 18 + float}px)`,
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: -34,
          fontFamily: F.mono,
          fontSize: 10,
          letterSpacing: 2.6,
          color: 'rgba(70,224,138,0.8)',
        }}
      >
        POV · WHAT HE SEES
      </div>
      {[
        { left: -12, top: -12, borderTop: `2px solid ${bracket}`, borderLeft: `2px solid ${bracket}` },
        { right: -12, top: -12, borderTop: `2px solid ${bracket}`, borderRight: `2px solid ${bracket}` },
        { left: -12, bottom: -12, borderBottom: `2px solid ${bracket}`, borderLeft: `2px solid ${bracket}` },
        { right: -12, bottom: -12, borderBottom: `2px solid ${bracket}`, borderRight: `2px solid ${bracket}` },
      ].map((s, i) => (
        <div key={i} style={{ position: 'absolute', width: 28, height: 28, ...s }} />
      ))}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 20,
          background: C.panel,
          border: '1px solid rgba(70,224,138,0.34)',
          boxShadow: `0 46px 130px rgba(0,0,0,0.7), 0 0 ${60 + flash * 90}px rgba(70,224,138,${0.1 + flash * 0.22})`,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: 46,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 26px',
            borderBottom: `1px solid ${C.line}`,
            fontFamily: F.mono,
            fontSize: 11,
            letterSpacing: 2.2,
            color: C.faint,
          }}
        >
          <span>EVEN G2 · LENS · 576 × 288</span>
          <span style={{ color: C.green }}>{badge}</span>
        </div>
        <div
          style={{
            position: 'absolute',
            left: 90,
            top: 58,
            width: 1160,
            height: 580,
            overflow: 'hidden',
            background: '#000',
            border: '1px solid rgba(70,224,138,0.12)',
          }}
        >
          <div style={{ width: 576, height: 288, transform: 'scale(2.014)', transformOrigin: 'top left' }}>
            {children}
          </div>
        </div>
        <div
          style={{
            position: 'absolute',
            left: 26,
            right: 26,
            bottom: 10,
            display: 'flex',
            justifyContent: 'space-between',
            fontFamily: F.mono,
            fontSize: 9,
            letterSpacing: 1.6,
            color: C.faint,
          }}
        >
          <span>{footerLeft}</span>
          <span>{footerRight}</span>
        </div>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(116deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0) 34%, rgba(255,255,255,0.025) 72%, rgba(255,255,255,0) 100%)',
            pointerEvents: 'none',
          }}
        />
      </div>
    </div>
  )
}

/**
 * Full-bleed concept footage with the real HUD as a small lens panel on the
 * left, so the action reads as what he sees through the G2.
 */
const PovShot: React.FC<{
  trim: number
  badge: string
  children: React.ReactNode
  panelLeft?: number
  panelTop?: number
  rate?: number
}> = ({ trim, badge, children, panelLeft = 58, panelTop = 286, rate = 1 }) => {
  const frame = useCurrentFrame()
  const push = 1.05 + (frame / 120) * 0.012
  const float = Math.sin(frame / 24) * 2
  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <OffthreadVideo
        src={staticFile('gemini-concept.mp4')}
        muted
        volume={0}
        trimBefore={Math.round(trim * FPS)}
        playbackRate={rate}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: `scale(${push})`,
          filter: 'contrast(1.03) saturate(0.92) brightness(0.84)',
        }}
      />
      <AbsoluteFill
        style={{
          background:
            'linear-gradient(90deg, rgba(3,7,5,0.82) 0%, rgba(3,7,5,0.42) 34%, rgba(3,7,5,0.04) 62%), linear-gradient(0deg, rgba(3,7,5,0.55) 0%, rgba(3,7,5,0) 30%)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: panelLeft,
          top: panelTop,
          width: 820,
          height: 450,
          transform: `translateY(${float}px) perspective(1600px) rotateY(1.4deg)`,
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: -30,
            fontFamily: F.mono,
            fontSize: 9,
            letterSpacing: 2.4,
            color: 'rgba(70,224,138,0.72)',
          }}
        >
          POV · WHAT HE SEES
        </div>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 14,
            background: 'rgba(4,10,7,0.97)',
            border: '1px solid rgba(70,224,138,0.45)',
            boxShadow: '0 24px 80px rgba(0,0,0,0.6), 0 0 70px rgba(70,224,138,0.14)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: 36,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 16px',
              borderBottom: `1px solid ${C.line}`,
              fontFamily: F.mono,
              fontSize: 10,
              letterSpacing: 1.8,
              color: C.faint,
            }}
          >
            <span>POV · EVEN G2 LENS</span>
            <span style={{ color: C.green }}>{badge}</span>
          </div>
          <div
            style={{
              position: 'absolute',
              left: 26,
              top: 36,
              width: 768,
              height: 384,
              overflow: 'hidden',
              background: '#000',
            }}
          >
            <div style={{ width: 576, height: 288, transform: 'scale(1.3333)', transformOrigin: 'top left' }}>
              {children}
            </div>
          </div>
          <div
            style={{
              position: 'absolute',
              left: 26,
              right: 26,
              bottom: 5,
              display: 'flex',
              justifyContent: 'space-between',
              fontFamily: F.mono,
              fontSize: 8,
              letterSpacing: 1.4,
              color: C.faint,
            }}
          >
            <span>HUD REPLAY · TESTNET</span>
            <span>NO LIVE MARKET DATA</span>
          </div>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'linear-gradient(118deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0) 40%, rgba(255,255,255,0.03) 76%, rgba(255,255,255,0) 100%)',
              pointerEvents: 'none',
            }}
          />
        </div>
      </div>
    </AbsoluteFill>
  )
}

/** The close-half interaction rail: what leaves the glasses, in order. */
const GestureRail: React.FC<{ frame: number; say: number; preview: number; yes: number; fill: number }> = ({
  frame,
  say,
  preview,
  yes,
  fill,
}) => {
  const steps = [
    { label: 'voice: close half', at: say, until: preview },
    { label: 'swipe on temple → Yes', at: preview, until: yes },
    { label: 'tap to confirm', at: yes, until: fill },
  ]
  const result = frame >= fill
  return (
    <>
      <div
        style={{
          position: 'absolute',
          right: 64,
          top: 54,
          display: 'flex',
          gap: 8,
          zIndex: 20,
        }}
      >
        {steps.map((step, i) => {
          const done = frame >= step.until
          const active = frame >= step.at && frame < step.until
          return (
            <div
              key={step.label}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '9px 13px 9px 10px',
                borderRadius: 7,
                border: `1px solid ${
                  active ? 'rgba(70,224,138,0.65)' : done ? 'rgba(70,224,138,0.30)' : 'rgba(120,220,160,0.18)'
                }`,
                background: active ? 'rgba(70,224,138,0.10)' : 'rgba(4,10,7,0.55)',
                boxShadow: active ? '0 0 26px rgba(70,224,138,0.12)' : 'none',
                fontFamily: F.mono,
                fontSize: 11,
                letterSpacing: 1.2,
                color: active ? C.greenBright : done ? 'rgba(70,224,138,0.62)' : 'rgba(139,167,151,0.78)',
              }}
            >
              <span
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 4,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: active ? 'rgba(70,224,138,0.18)' : 'rgba(255,255,255,0.04)',
                  color: active ? C.greenBright : done ? C.green : C.faint,
                  fontSize: 10,
                }}
              >
                {done ? '✓' : `0${i + 1}`}
              </span>
              {step.label}
            </div>
          )
        })}
      </div>
      {result ? (
        <div
          style={{
            position: 'absolute',
            right: 64,
            top: 104,
            padding: '7px 12px',
            borderRadius: 6,
            border: '1px solid rgba(70,224,138,0.5)',
            background: 'rgba(70,224,138,0.10)',
            fontFamily: F.mono,
            fontSize: 10,
            letterSpacing: 2,
            color: C.greenBright,
            zIndex: 20,
          }}
        >
          FILLED · REDUCE-ONLY · TESTNET
        </div>
      ) : null}
    </>
  )
}

const conceptFade = (frame: number, start: number, end: number) =>
  Math.min(ramp(frame, start, start + 10), 1 - ramp(frame, end - 12, end))

const LensPanel: React.FC<{ frame: number; children: React.ReactNode }> = ({ frame, children }) => {
  const p = spring({ frame, fps: FPS, config: { damping: 200, mass: 0.7 } })
  const float = Math.sin(frame / 22) * 3
  const bracket = 'rgba(70,224,138,0.8)'
  return (
    <div
      style={{
        position: 'absolute',
        left: 24,
        top: 300,
        width: 620,
        height: 340,
        opacity: p,
        transform: `translateY(${(1 - p) * 20 + float}px) perspective(1400px) rotateY(3deg)`,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 18,
          background: 'rgba(2,8,5,0.46)',
          border: '1px solid rgba(70,224,138,0.45)',
          boxShadow: '0 0 90px rgba(0,255,120,0.16), inset 0 0 60px rgba(0,255,120,0.05)',
          backdropFilter: 'blur(8px)',
        }}
      />
      <div style={{ position: 'absolute', left: 10, top: 10, width: 24, height: 24, borderTop: `2px solid ${bracket}`, borderLeft: `2px solid ${bracket}` }} />
      <div style={{ position: 'absolute', right: 10, top: 10, width: 24, height: 24, borderTop: `2px solid ${bracket}`, borderRight: `2px solid ${bracket}` }} />
      <div style={{ position: 'absolute', left: 10, bottom: 10, width: 24, height: 24, borderBottom: `2px solid ${bracket}`, borderLeft: `2px solid ${bracket}` }} />
      <div style={{ position: 'absolute', right: 10, bottom: 10, width: 24, height: 24, borderBottom: `2px solid ${bracket}`, borderRight: `2px solid ${bracket}` }} />
      <div
        style={{
          position: 'absolute',
          left: 22,
          top: 18,
          width: 576,
          height: 288,
          transform: 'scale(1)',
          transformOrigin: 'top left',
          mixBlendMode: 'screen',
        }}
      >
        {children}
      </div>
      <div
        style={{
          position: 'absolute',
          left: 22,
          bottom: 12,
          fontFamily: F.mono,
          fontSize: 8,
          letterSpacing: 1.8,
          color: 'rgba(70,224,138,0.55)',
        }}
      >
        EVEN G2 · LENS FEED · 576×288
      </div>
    </div>
  )
}

const ConceptOpen: React.FC = () => {
  const frame = useCurrentFrame()
  const total = SECTIONS_1MIN.concept.duration
  const fadeIn = ramp(frame, 0, 12)
  const fadeOut = 1 - ramp(frame, total - 6, total)
  const position = conceptFade(frame, 0, 84)
  const confirm = conceptFade(frame, 78, 162)
  const filled = conceptFade(frame, 156, 240)
  const selected: 'no' | 'yes' = frame < 120 ? 'no' : 'yes'

  return (
    <AbsoluteFill style={{ opacity: fadeIn * fadeOut, backgroundColor: '#000' }}>
      <OffthreadVideo
        src={staticFile('ai-concept-1080.mp4')}
        muted
        volume={0}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: `scale(${1 + (frame / total) * 0.03})`,
          filter: 'contrast(1.02) saturate(0.94)',
        }}
      />
      <AbsoluteFill
        style={{
          background:
            'linear-gradient(90deg, rgba(4,7,6,0.66) 0%, rgba(4,7,6,0.22) 40%, rgba(4,7,6,0) 64%), linear-gradient(0deg, rgba(4,7,6,0.7) 0%, rgba(4,7,6,0) 34%)',
        }}
      />
      <LensPanel frame={frame}>
        <div style={{ position: 'absolute', inset: 0, opacity: position }}>
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
        </div>
        <div style={{ position: 'absolute', inset: 0, opacity: confirm }}>
          <HudConfirm selected={selected} />
        </div>
        <div style={{ position: 'absolute', inset: 0, opacity: filled }}>
          <HudFilled qty="0.005" price="61,502.9" left="0.005" receipt={RECEIPT} />
        </div>
      </LensPanel>
      <div
        style={{
          position: 'absolute',
          left: 64,
          top: 54,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '7px 10px',
          borderRadius: 4,
          background: 'rgba(4,7,6,0.55)',
          border: '1px solid rgba(70,224,138,0.18)',
          fontFamily: F.mono,
          fontSize: 10,
          letterSpacing: 2,
          color: 'rgba(233,247,238,0.62)',
          zIndex: 20,
        }}
      >
        <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'rgba(70,224,138,0.8)' }} />
        CONCEPT VISUALIZATION · AI-GENERATED · NOT LIVE FOOTAGE
      </div>
    </AbsoluteFill>
  )
}

const Glance: React.FC = () => {
  const frame = useCurrentFrame()
  const pnl = -0.06 + Math.sin(frame / 16) * 0.02
  const roe = (pnl / 30.74644) * 100

  return (
    <>
      <Head
        frame={frame}
        kick="GLANCE · SIZE / P&L / LIQ"
        title="One glance. The whole risk."
        sub="Size. P&L. Liquidation."
      />
      <HudFrame frame={frame}>
        <HudPosition
          qty="0.01"
          pnl={fmtSigned(pnl)}
          roe={fmtPct(roe)}
          liq="58,684.4"
          distance="4.6"
          hint="LIQ IN ~4m at this pace · buffer 4.6%"
          hintTone="bright"
          statusPulse={0.82 + 0.18 * Math.abs(Math.sin(frame / 18))}
        />
      </HudFrame>
    </>
  )
}

const Alert: React.FC = () => {
  const frame = useCurrentFrame()
  const phase = frame < 50 ? 'listen' : frame < 95 ? 'think' : 'armed'
  const head =
    phase === 'listen'
      ? { kick: 'VOICE · ALERT', title: '"Alert 61,500."', sub: 'Hold the temple. Speak.' }
      : phase === 'think'
        ? { kick: 'VOICE · TRANSCRIBING', title: 'No typing.', sub: 'No app switching.' }
        : { kick: 'ALERT ARMED', title: 'Set at 61,500.', sub: 'Fires while the app is open.' }

  return (
    <>
      <Head frame={frame} {...head} />
      <HudFrame frame={frame} badge="● ALERT · REPLAY">
        <div style={{ position: 'absolute', inset: 0 }}>
          <div style={{ position: 'absolute', inset: 0, opacity: fade(frame, 0, 52) }}>
            <HudListening pulse={0.55 + 0.45 * Math.abs(Math.sin(frame / 9))} />
          </div>
          <div style={{ position: 'absolute', inset: 0, opacity: fade(frame, 48, 97) }}>
            <HudThinking message="Transcribing" />
          </div>
          <div style={{ position: 'absolute', inset: 0, opacity: ramp(frame, 95, 101) }}>
            <HudAlertArmed
              price="61,500"
              direction="Price below"
              flash={0.2 + 0.2 * Math.abs(Math.sin(frame / 12))}
            />
          </div>
        </div>
      </HudFrame>
    </>
  )
}

const MULTI_SOL = {
  header: '3 positions · riskiest SOL ~10m',
  symbol: 'SOLUSDT',
  side: 'LONG',
  qty: '4',
  leverage: '25',
  pnl: '+2.84',
  roe: '+11.7%',
  liq: '146.680',
  distance: '3.9',
  hint: 'LIQ IN ~10m at this pace · buffer 3.9%',
  cycle: '1/3',
}

const MULTI_BTC = {
  header: '3 positions · riskiest SOL ~10m',
  symbol: 'BTCUSDT',
  side: 'LONG',
  qty: '0.01',
  leverage: '20',
  pnl: '+9.29',
  roe: '+29.4%',
  liq: '60,279.60',
  distance: '5.9',
  hint: 'LIQ IN ~41m at this pace · buffer 5.9%',
  cycle: '2/3',
}

const MultiPosition: React.FC = () => {
  const frame = useCurrentFrame()
  const cross = ramp(frame, 58, 72)
  return (
    <>
      <Head
        frame={frame}
        kick="MULTI-POSITION · RISK ORDER"
        title="Every position. Risk first."
        sub="Three open · riskiest first."
      />
      <HudFrame
        frame={frame}
        badge="● MULTI · SIMULATOR"
        footerLeft="SIMULATOR · NO NETWORK · NO ORDERS"
        footerRight="NOT FINANCIAL ADVICE"
      >
        <div style={{ position: 'absolute', inset: 0, opacity: 1 - cross }}>
          <HudMulti {...MULTI_SOL} />
        </div>
        <div style={{ position: 'absolute', inset: 0, opacity: cross }}>
          <HudMulti {...MULTI_BTC} />
        </div>
      </HudFrame>
    </>
  )
}

/** Confirm screen with the swipe/tap overlays used in the close-half beat. */
const ConfirmScreen: React.FC<{
  f: number
  yesAt: number
  swipeAt: number
  tapAt: number
  focus?: boolean
  tap?: boolean
}> = ({ f, yesAt, swipeAt, tapAt, focus = false, tap = false }) => {
  const selected: 'no' | 'yes' = f >= yesAt ? 'yes' : 'no'
  const focusPulse = 0.55 + 0.25 * Math.abs(Math.sin(f / 9))
  const swipe = ramp(f, swipeAt, yesAt)
  const tapPulse = tap ? ramp(f, tapAt, tapAt + 10) : 0
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <HudConfirm selected={selected} />
      {selected === 'no' && focus ? (
        <div
          style={{
            position: 'absolute',
            left: 24,
            top: 119,
            width: 528,
            height: 60,
            border: '1px solid #00ff00',
            borderRadius: 5,
            opacity: focusPulse,
          }}
        />
      ) : null}
      {selected === 'no' && f >= swipeAt ? (
        <div
          style={{
            position: 'absolute',
            left: 300,
            top: 178 - swipe * 34,
            fontFamily: '"Arial Narrow", "Helvetica Neue", Arial, sans-serif',
            fontSize: 26,
            color: '#00ff00',
            opacity: 0.9 * (1 - swipe * 0.35),
          }}
        >
          ↑
        </div>
      ) : null}
      {selected === 'yes' && tapPulse > 0 ? (
        <>
          <div
            style={{
              position: 'absolute',
              left: 28,
              top: 182,
              width: 520,
              height: 50,
              border: '1px solid #00ff00',
              borderRadius: 4,
              opacity: 0.35 + tapPulse * 0.65,
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: 500 - tapPulse * 34,
              top: 207 - tapPulse * 34,
              width: 68 * tapPulse,
              height: 68 * tapPulse,
              borderRadius: '50%',
              border: '2px solid #00ff00',
              opacity: (1 - tapPulse) * 0.9,
            }}
          />
        </>
      ) : null}
    </div>
  )
}

const Close: React.FC = () => {
  const f = useCurrentFrame()
  const CLOSE = SECTIONS_1MIN.close.from
  const cue = (abs: number) => abs - CLOSE
  const say = cue(CUES.closeSay)
  const preview = cue(CUES.closePreview)
  const focusNo = cue(CUES.closeDefaultNo)
  const swipe = cue(CUES.closeSwipe)
  const yes = cue(CUES.closeYes)
  const tap = cue(CUES.closeTap)
  const fill = cue(CUES.closeFill)

  const badge =
    f >= fill
      ? '● FILLED · TESTNET'
      : f >= tap
        ? '● YES · TAP'
        : f >= swipe
          ? '● YES · SWIPE'
          : f >= focusNo
            ? '● DEFAULT · NO'
            : f >= preview
              ? '● PREVIEW · NOTHING SENT'
              : f >= say
                ? '● LISTENING'
                : '● POSITION · REPLAY'

  return (
    <AbsoluteFill>
      <div
        style={{
          position: 'absolute',
          left: 64,
          top: 54,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '7px 10px',
          borderRadius: 4,
          background: 'rgba(4,7,6,0.55)',
          border: '1px solid rgba(70,224,138,0.18)',
          fontFamily: F.mono,
          fontSize: 10,
          letterSpacing: 2,
          color: 'rgba(233,247,238,0.62)',
          zIndex: 20,
        }}
      >
        <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'rgba(70,224,138,0.8)' }} />
        CONCEPT VISUALIZATION · AI-GENERATED · NOT LIVE FOOTAGE
      </div>
      <GestureRail frame={f} say={say} preview={preview} yes={yes} fill={fill} />

      {/* POV: glance at the position, then speak the command. */}
      <Sequence from={0} durationInFrames={preview} name="Close · POV listen">
        <PovShot trim={7.5} badge={badge}>
          <div style={{ position: 'absolute', inset: 0, opacity: 1 - ramp(f, 22, 27) }}>
            <HudPosition
              qty="0.01"
              pnl="-0.06"
              roe="-0.2%"
              liq="58,684.4"
              distance="4.6"
              hint="LIQ IN ~4m at this pace · buffer 4.6%"
              hintTone="bright"
              statusPulse={0.7 + 0.3 * Math.abs(Math.sin(f / 8))}
            />
          </div>
          <div style={{ position: 'absolute', inset: 0, opacity: fade(f, say - 2, say + 26, 4) }}>
            <HudListening pulse={0.55 + 0.45 * Math.abs(Math.sin(f / 6))} />
          </div>
          <div style={{ position: 'absolute', inset: 0, opacity: ramp(f, say + 26, say + 30) }}>
            <HudThinking message="Checking position" />
          </div>
        </PovShot>
      </Sequence>

      {/* Lens close-up: the exact order, default No. */}
      <Sequence from={preview} durationInFrames={focusNo - preview} name="Close · preview No">
        <LensFrame frame={f - preview} badge="● PREVIEW · NOTHING SENT">
          <ConfirmScreen f={f} yesAt={yes} swipeAt={swipe} tapAt={tap} focus={false} />
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: 0,
              height: 2,
              background: '#00ff00',
              opacity: 0.35,
              transform: `translateY(${((f - preview) % 70) * 4}px)`,
            }}
          />
        </LensFrame>
      </Sequence>

      {/* Back to the POV: he reads the order before touching anything. */}
      <Sequence from={focusNo - 55} durationInFrames={55} name="Close · POV read order">
        <PovShot trim={9.6} badge="● PREVIEW · NOTHING SENT">
          <ConfirmScreen f={f} yesAt={yes} swipeAt={swipe} tapAt={tap} focus={f >= focusNo} />
        </PovShot>
      </Sequence>

      {/* Default No, held while the voice says it. */}
      <Sequence from={focusNo} durationInFrames={swipe - focusNo} name="Close · default No">
        <LensFrame frame={f - focusNo} badge="● DEFAULT · NO">
          <ConfirmScreen f={f} yesAt={yes} swipeAt={swipe} tapAt={tap} focus />
        </LensFrame>
      </Sequence>

      {/* Swipe on the temple, and the screen flips to Yes. */}
      <Sequence from={swipe} durationInFrames={tap - swipe} name="Close · swipe Yes">
        <PovShot trim={13.3} badge="● YES · SWIPE">
          <ConfirmScreen f={f} yesAt={yes} swipeAt={swipe} tapAt={tap} />
        </PovShot>
      </Sequence>

      {/* Tap to confirm. */}
      <Sequence from={tap} durationInFrames={fill - 52 - tap} name="Close · tap confirm">
        <PovShot trim={15.2} badge="● YES · TAP">
          <ConfirmScreen f={f} yesAt={yes} swipeAt={swipe} tapAt={tap} tap />
        </PovShot>
      </Sequence>

      {/* Reduce-only order in flight. */}
      <Sequence from={fill - 52} durationInFrames={52} name="Close · sending">
        <PovShot trim={18.4} badge="● SENDING · TESTNET">
          <HudThinking message="Sending testnet order" />
        </PovShot>
      </Sequence>

      {/* Filled: the payoff, on the lens. */}
      <Sequence from={fill} durationInFrames={480 - fill} name="Close · filled">
        <LensFrame
          frame={f - fill}
          badge="● FILLED · TESTNET"
          flash={Math.max(0, 1 - (f - fill) / 12)}
        >
          <HudFilled qty="0.005" price="61,502.9" left="0.005" />
        </LensFrame>
      </Sequence>
    </AbsoluteFill>
  )
}

const Receipt: React.FC = () => {
  const frame = useCurrentFrame()
  const swap = ramp(frame, 78, 86)
  const bracket = interpolate(frame, [78, 96], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const bracketPulse = 0.55 + 0.2 * Math.abs(Math.sin(frame / 12))

  return (
    <>
      <div style={{ opacity: 1 - swap }}>
        <Head
          frame={frame}
          kick="PROOF · RECEIPT"
          title={'Liquidation\npushed back.'}
        />
      </div>
      <div style={{ opacity: swap }}>
        <Head
          frame={frame}
          kick="PROOF · BUFFER"
          title="4.6% → 9.6%."
          sub="The buffer more than doubled."
        />
      </div>
      <HudFrame frame={frame} badge="● RECEIPT · REPLAY">
        <div style={{ position: 'absolute', inset: 0 }}>
          <HudFilled qty="0.005" price="61,502.9" left="0.005" receipt={RECEIPT} />
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
        </div>
      </HudFrame>
    </>
  )
}

const End: React.FC<{ repo: string }> = ({ repo }) => {
  const frame = useCurrentFrame()
  const card = ramp(frame, 186, 198)
  const ledger = 1 - ramp(frame, 178, 186)
  const word = spring({ frame: frame - 186, fps: FPS, config: { damping: 200, mass: 0.7 } })
  const tag = ramp(frame, 196, 208)
  const chips = ramp(frame, 208, 228)
  const links = ramp(frame, 222, 242)

  const rows = [
    { at: 0, no: '01', text: 'TRADE-ONLY KEYS', tag: 'PLACE / CANCEL ONLY' },
    { at: 45, no: '02', text: 'WITHDRAWALS REFUSED', tag: 'NOT IN THE KEY SCOPE' },
    { at: 108, no: '03', text: 'NOTHING MOVES\nWITHOUT YOUR YES', tag: 'PREVIEW, THEN TAP' },
  ]

  return (
    <>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(900px 560px at 50% 28%, rgba(70,224,138,0.10), transparent 66%)',
        }}
      />

      {/* Phase A: the safety terms, timed to the last VO line. */}
      <div style={{ position: 'absolute', inset: 0, opacity: ledger }}>
        <div
          style={{
            position: 'absolute',
            left: 250,
            top: 168,
            fontFamily: F.mono,
            fontSize: 12,
            letterSpacing: 3.4,
            color: C.green,
          }}
        >
          SAFETY · WHAT THE KEY CAN DO
        </div>
        {rows.map((row, i) => {
          const p = spring({ frame: frame - row.at, fps: FPS, config: { damping: 200, mass: 0.65 } })
          return (
            <div
              key={row.no}
              style={{
                position: 'absolute',
                left: 250,
                top: 252 + i * 178,
                width: 1420,
                display: 'flex',
                alignItems: 'flex-start',
                gap: 28,
                opacity: p,
                transform: `translateY(${(1 - p) * 22}px)`,
              }}
            >
              <div
                style={{
                  fontFamily: F.mono,
                  fontSize: 12,
                  letterSpacing: 2,
                  color: C.green,
                  paddingTop: 18,
                }}
              >
                {row.no}
              </div>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  border: '1px solid rgba(70,224,138,0.55)',
                  background: 'rgba(70,224,138,0.10)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: C.greenBright,
                  fontSize: 22,
                  marginTop: 6,
                  flexShrink: 0,
                }}
              >
                ✓
              </div>
              <div>
                <div
                  style={{
                    fontFamily: F.display,
                    fontSize: i === 2 ? 54 : 62,
                    lineHeight: 1.04,
                    fontWeight: 750,
                    letterSpacing: '-0.04em',
                    color: C.text,
                    whiteSpace: 'pre-line',
                  }}
                >
                  {row.text}
                </div>
                <div
                  style={{
                    marginTop: 10,
                    fontFamily: F.mono,
                    fontSize: 11,
                    letterSpacing: 2.4,
                    color: C.faint,
                  }}
                >
                  {row.tag}
                </div>
              </div>
            </div>
          )
        })}
        <Img
          src={staticFile('voxel-lens.svg')}
          style={{ position: 'absolute', right: 120, top: 120, width: 130, height: 116, objectFit: 'contain', opacity: 0.5 }}
        />
      </div>

      {/* Phase B: the wordmark card. */}
      <div style={{ position: 'absolute', inset: 0, opacity: card }}>
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 138,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 26,
            opacity: word,
            transform: `translateY(${(1 - word) * 18}px)`,
          }}
        >
          <Img src={staticFile('voxel-lens.svg')} style={{ width: 170, height: 150, objectFit: 'contain' }} />
          <div
            style={{
              fontFamily: F.display,
              fontSize: 102,
              fontWeight: 800,
              letterSpacing: '-0.055em',
              color: C.text,
            }}
          >
            WICKSIGHT
          </div>
        </div>

        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 306,
            display: 'flex',
            justifyContent: 'center',
            opacity: tag,
          }}
        >
          <div style={{ width: 260, height: 2, background: C.green, boxShadow: `0 0 20px ${C.green}` }} />
        </div>

        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 334,
            textAlign: 'center',
            fontFamily: F.display,
            fontSize: 38,
            color: C.muted,
            letterSpacing: '-0.02em',
            opacity: tag,
          }}
        >
          See it coming. Get out in time.
        </div>

        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 420,
            display: 'flex',
            justifyContent: 'center',
            gap: 12,
            opacity: chips,
          }}
        >
          {['TRADE-ONLY KEYS', 'WITHDRAWALS REFUSED', 'EXPLICIT YES'].map((chip) => (
            <span
              key={chip}
              style={{
                fontFamily: F.mono,
                fontSize: 13,
                letterSpacing: 2,
                color: C.green,
                border: `1px solid rgba(70,224,138,0.35)`,
                borderRadius: 999,
                padding: '10px 16px',
                background: 'rgba(70,224,138,0.06)',
              }}
            >
              {chip}
            </span>
          ))}
        </div>

        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 512,
            display: 'flex',
            justifyContent: 'center',
            gap: 18,
            opacity: links,
            transform: `translateY(${(1 - links) * 14}px)`,
          }}
        >
          <span
            style={{
              fontFamily: F.mono,
              fontSize: 22,
              color: C.text,
              border: `1px solid ${C.line}`,
              borderRadius: 10,
              padding: '14px 22px',
              background: 'rgba(8,18,12,0.85)',
            }}
          >
            ↘ {repo}
          </span>
          <span
            style={{
              fontFamily: F.mono,
              fontSize: 22,
              color: C.green,
              border: `1px solid rgba(70,224,138,0.4)`,
              borderRadius: 10,
              padding: '14px 22px',
              background: 'rgba(70,224,138,0.06)',
            }}
          >
            ↗ wicksight.vercel.app
          </span>
        </div>

        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 862,
            textAlign: 'center',
            fontFamily: F.mono,
            fontSize: 10,
            letterSpacing: 1.8,
            lineHeight: 1.9,
            color: C.faint,
            opacity: links,
          }}
        >
          DEMO · REPLAY · NOT FINANCIAL ADVICE
          <br />
          MUSIC: “VOLATILE REACTION” — KEVIN MACLEOD (INCOMPETECH.COM) · CC BY 4.0
        </div>
      </div>
    </>
  )
}

export const OneMinute: React.FC<VideoProps> = ({ repo, music, voiceover }) => {
  return (
    <AbsoluteFill style={{ backgroundColor: C.bg }}>
      <Backdrop />

      <Sequence from={SECTIONS_1MIN.concept.from} durationInFrames={SECTIONS_1MIN.concept.duration} name="Concept">
        <ConceptOpen />
      </Sequence>
      <Sequence from={SECTIONS_1MIN.telegram.from} durationInFrames={SECTIONS_1MIN.telegram.duration} name="Telegram">
        <TelegramAlert />
      </Sequence>
      <Sequence from={SECTIONS_1MIN.glance.from} durationInFrames={SECTIONS_1MIN.glance.duration} name="Glance">
        <Glance />
      </Sequence>
      <Sequence from={SECTIONS_1MIN.alert.from} durationInFrames={SECTIONS_1MIN.alert.duration} name="Alert">
        <Alert />
      </Sequence>
      <Sequence from={SECTIONS_1MIN.multi.from} durationInFrames={SECTIONS_1MIN.multi.duration} name="Multi">
        <MultiPosition />
      </Sequence>
      <Sequence from={SECTIONS_1MIN.close.from} durationInFrames={SECTIONS_1MIN.close.duration} name="Close">
        <Close />
      </Sequence>
      <Sequence from={SECTIONS_1MIN.receipt.from} durationInFrames={SECTIONS_1MIN.receipt.duration} name="Receipt">
        <Receipt />
      </Sequence>
      <Sequence from={SECTIONS_1MIN.simulator.from} durationInFrames={SECTIONS_1MIN.simulator.duration} name="Simulator">
        <SimulatorShot duration={SECTIONS_1MIN.simulator.duration} />
      </Sequence>
      <Sequence from={SECTIONS_1MIN.end.from} durationInFrames={SECTIONS_1MIN.end.duration} name="End">
        <End repo={repo} />
      </Sequence>

      <CaptionTrack1Min captions={CAPTIONS_1MIN} />

      {music ? <Audio src={staticFile('music-60s.mp3')} volume={musicVolume} /> : null}
      {voiceover
        ? VO_CLIPS.map((clip) => (
            <Sequence
              key={clip.file}
              from={clip.from}
              durationInFrames={clip.frames}
              name={`VO ${clip.file}`}
            >
              <Audio src={staticFile(clip.file)} volume={1} />
            </Sequence>
          ))
        : null}
    </AbsoluteFill>
  )
}
