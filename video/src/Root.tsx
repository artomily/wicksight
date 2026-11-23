import { Composition } from 'remotion'
import { SessionGuard } from './SessionGuard'
import { defaultProps } from './config'
import { DURATION, FPS, HEIGHT, WIDTH } from './timeline'

export const RemotionRoot = () => {
  return (
    <Composition
      id="SessionGuard"
      component={SessionGuard}
      durationInFrames={DURATION}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
      defaultProps={defaultProps}
    />
  )
}
