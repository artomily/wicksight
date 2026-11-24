import { Composition } from 'remotion'
import { WickSight } from './WickSight'
import { defaultProps } from './config'
import { DURATION, FPS, HEIGHT, WIDTH } from './timeline'

export const RemotionRoot = () => {
  return (
    <Composition
      id="WickSight"
      component={WickSight}
      durationInFrames={DURATION}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
      defaultProps={defaultProps}
    />
  )
}
