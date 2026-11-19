import { useFrame } from '@react-three/fiber/native'

interface IFrameMeterProps {
  onRenderedFrame: (timestampMilliseconds: number) => void
}

// Renders nothing; place it inside a <Canvas>. Reports the time of every frame that is rendered.
export const FrameMeter = ({ onRenderedFrame }: IFrameMeterProps) => {
  useFrame(() => {
    onRenderedFrame(performance.now())
  })

  return null
}
