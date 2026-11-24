import { Composition } from 'remotion'
import { WickSight } from './WickSight'
import { OneMinute, DURATION_1MIN } from './OneMinute'
import { defaultProps } from './config'
import { DURATION, FPS, HEIGHT, WIDTH } from './timeline'

export const RemotionRoot = () => {
  return (
    <>
      <Composition
        id="WickSight"
        component={WickSight}
        durationInFrames={DURATION}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={defaultProps}
      />
      <Composition
        id="WickSight1Min"
        component={OneMinute}
        durationInFrames={DURATION_1MIN}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={defaultProps}
      />
    </>
  )
}
