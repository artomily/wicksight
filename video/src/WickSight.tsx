import { AbsoluteFill, Audio, Sequence, staticFile } from 'remotion'
import { Backdrop } from './components/Backdrop'
import { CaptionTrack } from './components/CaptionTrack'
import type { VideoProps } from './config'
import { ColdOpen } from './scenes/ColdOpen'
import { CTA } from './scenes/CTA'
import { Hook } from './scenes/Hook'
import { Proof } from './scenes/Proof'
import { Reveal } from './scenes/Reveal'
import { Safety } from './scenes/Safety'
import { SECTIONS } from './timeline'

export const WickSight: React.FC<VideoProps> = ({ repo, music, voiceover }) => {
  return (
    <AbsoluteFill style={{ backgroundColor: '#040706' }}>
      <Backdrop />

      <Sequence from={SECTIONS.cold.from} durationInFrames={SECTIONS.cold.duration} name="Cold open">
        <ColdOpen />
      </Sequence>

      <Sequence from={SECTIONS.hook.from} durationInFrames={SECTIONS.hook.duration} name="Hook">
        <Hook />
      </Sequence>

      <Sequence from={SECTIONS.reveal.from} durationInFrames={SECTIONS.reveal.duration} name="Reveal">
        <Reveal />
      </Sequence>

      <Sequence from={SECTIONS.proof.from} durationInFrames={SECTIONS.proof.duration} name="Proof">
        <Proof />
      </Sequence>

      <Sequence from={SECTIONS.safety.from} durationInFrames={SECTIONS.safety.duration} name="Safety">
        <Safety />
      </Sequence>

      <Sequence from={SECTIONS.cta.from} durationInFrames={SECTIONS.cta.duration} name="CTA">
        <CTA repo={repo} />
      </Sequence>

      <CaptionTrack />

      {music ? <Audio src={staticFile('music.mp3')} volume={0.32} /> : null}
      {voiceover ? <Audio src={staticFile('vo.mp3')} /> : null}
    </AbsoluteFill>
  )
}
