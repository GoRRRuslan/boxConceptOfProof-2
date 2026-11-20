import { useFrame, useThree } from '@react-three/fiber/native'
import { useEffect, useRef, useState } from 'react'
import { AppState } from 'react-native'

interface IUseFacadeRenderOnDemandParams {
  activityKey: string
  warmupKey: string
  warmupMilliseconds: number
  minimumMilliseconds: number
  minimumFrames: number
  maximumMilliseconds: number
  isContinuous: boolean
}

const FRAME_POLL_INTERVAL_MILLISECONDS = 120
// A frame that takes longer than this (first frames compile shaders and upload textures) does not
// count as a "good" frame: the renderer only rests after a run of quick frames.
const STALLED_FRAME_MILLISECONDS = 100

// React Three Fiber's `frameloop="always"` renders every display refresh, even for a static scene.
// This switches the loop to "always" whenever `activityKey` changes and back to "demand" (no frames
// at all: the GPU and the JS thread rest, the last picture stays on screen) after ENOUGH FRAMES HAVE
// ACTUALLY BEEN RENDERED since then (and a minimum time).
//
// Why frames and not just a timer: after an update the scene needs a few frames before the final
// picture is on screen (shader compilation, first presented buffer, slow devices). A fixed timer
// froze half-updated scenes on slow hardware; counting QUICK rendered frames (a stalled frame resets
// the count) adapts to the real frame rate. `maximumMilliseconds` is a safety cap. `warmupKey` marks changes after which the first
// frames are not yet representative (model finished loading): those get a longer window.
//
// Back in the foreground the loop is restarted for one more window, so a context that was paused by
// the OS gets redrawn.
export const useFacadeRenderOnDemand = ({
  activityKey,
  warmupKey,
  warmupMilliseconds,
  minimumMilliseconds,
  minimumFrames,
  maximumMilliseconds,
  isContinuous,
}: IUseFacadeRenderOnDemandParams) => {
  const setFrameloop = useThree(state => state.setFrameloop)
  const invalidate = useThree(state => state.invalidate)
  const quickFrameCount = useRef<number>(0)
  const lastFrameTimestamp = useRef<number>(0)
  const lastWarmupKey = useRef<string | null>(null)
  const [foregroundResyncCount, setForegroundResyncCount] = useState<number>(0)

  // ------------------- Side effects ----------------------- //
  useFrame(() => {
    const now = performance.now()

    // A stall (shader compilation, a big upload) restarts the count of quick frames.
    quickFrameCount.current = now - lastFrameTimestamp.current > STALLED_FRAME_MILLISECONDS ? 0 : quickFrameCount.current + 1

    lastFrameTimestamp.current = now
  })

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextState => {
      if (nextState === 'active') {
        setForegroundResyncCount(previous => previous + 1)
      }
    })

    return () => {
      subscription.remove()
    }
  }, [])

  useEffect(() => {
    // When the warm-up key changed (first mount, the model finished loading...) the first frames are
    // spent compiling shaders and look empty, so keep rendering longer.
    const isWarmingUp = lastWarmupKey.current !== warmupKey
    const requiredMilliseconds = isWarmingUp ? Math.max(warmupMilliseconds, minimumMilliseconds) : minimumMilliseconds
    const startedAt = Date.now()

    lastWarmupKey.current = warmupKey

    quickFrameCount.current = 0

    setFrameloop('always')

    invalidate()

    // Continuous scenes (scrolling, an animation running) never stop: no start/stop churn at all.
    if (isContinuous) {
      return undefined
    }

    const pollTimer = setInterval(() => {
      const elapsedMilliseconds = Date.now() - startedAt
      const isEnough = quickFrameCount.current >= minimumFrames && elapsedMilliseconds >= requiredMilliseconds

      if (isEnough || elapsedMilliseconds >= maximumMilliseconds) {
        clearInterval(pollTimer)

        setFrameloop('demand')
      }
    }, FRAME_POLL_INTERVAL_MILLISECONDS)

    return () => {
      clearInterval(pollTimer)
    }
  }, [
    setFrameloop,
    invalidate,
    activityKey,
    warmupKey,
    warmupMilliseconds,
    minimumMilliseconds,
    minimumFrames,
    maximumMilliseconds,
    isContinuous,
    foregroundResyncCount,
  ])
}
