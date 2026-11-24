import { AbsoluteFill, Audio, Sequence, interpolate, spring, staticFile, useCurrentFrame } from 'remotion'
import { Backdrop } from './components/Backdrop'
import { CaptionTrack } from './components/CaptionTrack'
import {
  HudAlertHit,
  HudConfirm,
  HudFilled,
  HudListening,
  HudPosition,
  HudThinking,
  type HudReceipt,
} from './components/HudScreen'
import { CAPTIONS_1MIN } from './captions1min'
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

const SECTIONS_1MIN = {
  cold: { from: 0, duration: 150 },
  glance: { from: 150, duration: 300 },
  alert: { from: 450, duration: 300 },
  close: { from: 750, duration: 510 },
  receipt: { from: 1260, duration: 240 },
  end: { from: 1500, duration: 300 },
} as const

export const DURATION_1MIN = 1800

/**
 * Voiceover beats, measured from the ElevenLabs renders in `public/vo/`
 * (30 fps). Each clip starts just after its section begins and is ducked
 * into the music bed; see `vo/lines.json` for the script.
 */
const VO_CLIPS = [
  { file: 'vo/beat-1.mp3', from: 6, frames: 112 },
  { file: 'vo/beat-2.mp3', from: 162, frames: 251 },
  { file: 'vo/beat-3.mp3', from: 462, frames: 257 },
  { file: 'vo/beat-4.mp3', from: 759, frames: 493 },
  { file: 'vo/beat-5.mp3', from: 1275, frames: 205 },
  { file: 'vo/beat-6.mp3', from: 1512, frames: 285 },
] as const

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


const fade = (frame: number, start: number, end: number, length = 8) =>
  Math.min(
    interpolate(frame, [start, start + length], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }),
    interpolate(frame, [end - length, end], [1, 0], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }),
  )

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
          fontSize: 68,
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
}> = ({ children, frame, badge = '● REPLAY · 23 NOV 2026', danger = false }) => {
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
        <span>RECORDED 23 NOV 2026 · BINANCE FUTURES TESTNET</span>
        <span>NO LIVE MARKET DATA</span>
      </div>
    </div>
  )
}

const Cold: React.FC = () => {
  const frame = useCurrentFrame()
  const pulse = 0.6 + 0.4 * Math.abs(Math.sin(frame / 9))

  return (
    <>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(900px 620px at 50% 34%, rgba(255,106,92,0.14), transparent 66%)',
          opacity: pulse,
        }}
      />
      <Head
        frame={frame + 12}
        kick="DANGER · LIQ IN ~4m"
        title="The clock is the risk."
        sub="Four minutes to liquidation at this pace."
        danger
      />
      <HudFrame frame={frame + 12} danger badge="● DANGER · REPLAY">
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
      </HudFrame>
    </>
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
        kick="GLANCE · POSITION / PNL / LIQ"
        title="One screen. The whole risk."
        sub="Distance, and time."
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
  const phase = frame < 120 ? 'listen' : frame < 180 ? 'think' : 'hit'
  const flash = frame < 174 ? 0 : Math.max(0, 1 - (frame - 174) / 28)

  const head =
    phase === 'listen'
      ? { kick: 'VOICE · ALERT', title: '"Alert 61,500."', sub: 'Hold the temple. Speak.' }
      : phase === 'think'
        ? { kick: 'VOICE · TRANSCRIBING', title: 'No typing.', sub: 'No app switching.' }
        : { kick: 'ALERT HIT', title: '61,486.88', sub: 'Liq 4.6% away. One tap back.' }

  return (
    <>
      <Head frame={frame} {...head} />
      <HudFrame frame={frame} badge="● ALERT · REPLAY">
        <div style={{ position: 'absolute', inset: 0 }}>
          <div style={{ position: 'absolute', inset: 0, opacity: fade(frame, 0, 120) }}>
            <HudListening pulse={0.55 + 0.45 * Math.abs(Math.sin(frame / 9))} />
          </div>
          <div style={{ position: 'absolute', inset: 0, opacity: fade(frame, 108, 180) }}>
            <HudThinking message="Transcribing" />
          </div>
          <div style={{ position: 'absolute', inset: 0, opacity: fade(frame, 174, 300) }}>
            <HudAlertHit
              symbol="BTCUSDT"
              price="61,486.88"
              distance="4.6"
              flash={flash}
              pulse={0.65 + 0.35 * Math.abs(Math.sin(frame / 10))}
            />
          </div>
        </div>
      </HudFrame>
    </>
  )
}

const Close: React.FC = () => {
  const frame = useCurrentFrame()
  const phase =
    frame < 84 ? 'listen' : frame < 150 ? 'check' : frame < 330 ? 'no' : frame < 450 ? 'yes' : 'send'

  const head =
    phase === 'listen'
      ? { kick: 'ACT · CLOSE HALF', title: '"Close half."', sub: 'Hold the temple. Speak.' }
      : phase === 'check'
        ? { kick: 'ACT · CHECKING', title: 'One moment.', sub: 'Reading the position before the order.' }
        : phase === 'no'
          ? { kick: 'CONFIRM · WRITE', title: 'Default No.', sub: 'Swipe to Yes, then tap.' }
          : phase === 'yes'
            ? { kick: 'CONFIRM · YES', title: 'Yes, sell 0.005.', sub: 'Two gestures. One single-use preview.' }
            : { kick: 'SENDING · TESTNET', title: 'Reduce-only.', sub: 'Nothing else changes.' }

  return (
    <>
      <Head frame={frame} {...head} />
      <HudFrame frame={frame} badge="● CONFIRM · REPLAY">
        <div style={{ position: 'absolute', inset: 0 }}>
          <div style={{ position: 'absolute', inset: 0, opacity: fade(frame, 0, 84) }}>
            <HudListening pulse={0.55 + 0.45 * Math.abs(Math.sin(frame / 9))} />
          </div>
          <div style={{ position: 'absolute', inset: 0, opacity: fade(frame, 84, 150) }}>
            <HudThinking message="Checking position" />
          </div>
          <div style={{ position: 'absolute', inset: 0, opacity: fade(frame, 150, 330) }}>
            <HudConfirm selected="no" />
          </div>
          <div style={{ position: 'absolute', inset: 0, opacity: fade(frame, 330, 450) }}>
            <HudConfirm selected="yes" />
          </div>
          <div style={{ position: 'absolute', inset: 0, opacity: fade(frame, 450, 510) }}>
            <HudThinking message="Sending testnet order" />
          </div>
        </div>
      </HudFrame>
    </>
  )
}

const Receipt: React.FC = () => {
  const frame = useCurrentFrame()
  const bracket = interpolate(frame, [18, 42], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const bracketPulse = 0.55 + 0.2 * Math.abs(Math.sin(frame / 16))

  return (
    <>
      <Head
        frame={frame}
        kick="PROOF · RECEIPT"
        title="4.6% → 9.6%."
        sub="The buffer moved. The risk did."
      />
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

const WickMark: React.FC<{ size?: number }> = ({ size = 108 }) => (
  <svg width={size} height={size} viewBox="0 0 1024 1024" fill="none">
    <circle cx="512" cy="512" r="300" stroke={C.green} strokeWidth="44" />
    <path
      d="M 300 300 A 300 300 0 0 1 392 238"
      stroke={C.greenBright}
      strokeWidth="18"
      strokeLinecap="round"
      opacity="0.55"
    />
    <line x1="512" y1="300" x2="512" y2="430" stroke={C.greenBright} strokeWidth="22" strokeLinecap="round" />
    <rect x="466" y="430" width="92" height="250" rx="46" fill={C.green} />
    <line x1="512" y1="680" x2="512" y2="740" stroke={C.greenDim} strokeWidth="18" strokeLinecap="round" />
  </svg>
)

const End: React.FC<{ repo: string }> = ({ repo }) => {
  const frame = useCurrentFrame()
  const word = spring({ frame, fps: FPS, config: { damping: 200, mass: 0.7 } })
  const tag = interpolate(frame, [20, 46], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const chips = interpolate(frame, [36, 60], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const links = interpolate(frame, [54, 80], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })

  return (
    <>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(900px 560px at 50% 28%, rgba(70,224,138,0.10), transparent 66%)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 170,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 26,
          opacity: word,
          transform: `translateY(${(1 - word) * 18}px)`,
        }}
      >
        <WickMark size={112} />
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
          top: 310,
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
          top: 348,
          textAlign: 'center',
          fontFamily: F.display,
          fontSize: 34,
          color: C.muted,
          letterSpacing: '-0.02em',
          opacity: tag,
        }}
      >
        See the liquidation coming. Get out of it — from your glasses.
      </div>

      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 446,
          display: 'flex',
          justifyContent: 'center',
          gap: 12,
          opacity: chips,
        }}
      >
        {['TESTNET ONLY', 'KEYS SERVER-SIDE', 'EXPLICIT YES'].map((chip) => (
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
          top: 600,
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
    </>
  )
}

export const OneMinute: React.FC<VideoProps> = ({ repo, music, voiceover }) => {
  return (
    <AbsoluteFill style={{ backgroundColor: C.bg }}>
      <Backdrop />

      <Sequence from={SECTIONS_1MIN.cold.from} durationInFrames={SECTIONS_1MIN.cold.duration} name="Cold">
        <Cold />
      </Sequence>
      <Sequence from={SECTIONS_1MIN.glance.from} durationInFrames={SECTIONS_1MIN.glance.duration} name="Glance">
        <Glance />
      </Sequence>
      <Sequence from={SECTIONS_1MIN.alert.from} durationInFrames={SECTIONS_1MIN.alert.duration} name="Alert">
        <Alert />
      </Sequence>
      <Sequence from={SECTIONS_1MIN.close.from} durationInFrames={SECTIONS_1MIN.close.duration} name="Close">
        <Close />
      </Sequence>
      <Sequence from={SECTIONS_1MIN.receipt.from} durationInFrames={SECTIONS_1MIN.receipt.duration} name="Receipt">
        <Receipt />
      </Sequence>
      <Sequence from={SECTIONS_1MIN.end.from} durationInFrames={SECTIONS_1MIN.end.duration} name="End">
        <End repo={repo} />
      </Sequence>

      <CaptionTrack captions={CAPTIONS_1MIN} />

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
