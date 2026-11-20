import { useCallback, useEffect, useRef, useState } from 'react'
import { Platform } from 'react-native'

import { type IRenderFrameStats, summarizeFrameDeltas } from '@services/performance/summarizeFrameDeltas'

// Optional: measurement builds POST every 1-second summary to a local collector (see scripts/perf/perfSink.py).
// Needed for iOS release builds, whose JS console is not forwarded anywhere.
const PERF_SINK_URL: string | undefined = process.env.EXPO_PUBLIC_PERF_SINK_URL
const REPORT_WINDOW_MILLISECONDS = 1000
const PAUSE_DETECTION_MILLISECONDS = 2500
const RESUME_GAP_MILLISECONDS = 1000

// Measures the real renderer frame rate: it counts the frames React Three Fiber renders (one
// `useFrame` call per rendered frame) and reports a summary roughly once per second.
export const useRenderFpsMeter = (scenarioLabel = '') => {
  const [renderFrameStats, setRenderFrameStats] = useState<IRenderFrameStats | null>(null)
  const [isRenderPaused, setIsRenderPaused] = useState<boolean>(false)
  const lastReportTimestamp = useRef<number | null>(null)
  const scenarioLabelRef = useRef<string>(scenarioLabel)
  const windowsInScenario = useRef<number>(0)
  const lastFrameTimestamp = useRef<number | null>(null)
  const windowStartMilliseconds = useRef<number>(0)
  const frameDeltasMilliseconds = useRef<number[]>([])

  const handleReportStats = useCallback((stats: IRenderFrameStats) => {
    windowsInScenario.current += 1

    const report = { ...stats, scenario: scenarioLabelRef.current, windowInScenario: windowsInScenario.current }

    console.info(`[perf:${Platform.OS}] ${JSON.stringify(report)}`)

    if (PERF_SINK_URL) {
      fetch(PERF_SINK_URL, { method: 'POST', body: JSON.stringify(report) }).catch(() => undefined)
    }

    lastReportTimestamp.current = Date.now()

    setIsRenderPaused(false)

    setRenderFrameStats(stats)
  }, [])

  // Called once per rendered frame (from inside the Canvas) with the time of that frame.
  const onRenderedFrame = useCallback(
    (timestampMilliseconds: number) => {
      const previousTimestamp = lastFrameTimestamp.current

      lastFrameTimestamp.current = timestampMilliseconds

      // The very first frame has no predecessor.
      if (previousTimestamp === null) {
        windowStartMilliseconds.current = timestampMilliseconds

        return
      }

      const frameMilliseconds = timestampMilliseconds - previousTimestamp

      // A frame that arrives this long after the previous one is the renderer waking up from rest
      // (render on demand), not a frame time: it must not count as a slow frame.
      if (frameMilliseconds > RESUME_GAP_MILLISECONDS) {
        windowStartMilliseconds.current = timestampMilliseconds

        frameDeltasMilliseconds.current = []

        return
      }

      frameDeltasMilliseconds.current.push(frameMilliseconds)

      if (timestampMilliseconds - windowStartMilliseconds.current < REPORT_WINDOW_MILLISECONDS) {
        return
      }

      const stats = summarizeFrameDeltas(frameDeltasMilliseconds.current)

      windowStartMilliseconds.current = timestampMilliseconds

      frameDeltasMilliseconds.current = []

      handleReportStats(stats)
    },
    [handleReportStats],
  )

  // ------------------- Side effects ----------------------- //
  useEffect(() => {
    scenarioLabelRef.current = scenarioLabel

    windowsInScenario.current = 0
  }, [scenarioLabel])

  useEffect(() => {
    // No frame reports for a while means rendering is on hold (render on demand).
    const pauseWatcher = setInterval(() => {
      const now = Date.now()

      lastReportTimestamp.current ??= now

      setIsRenderPaused(now - lastReportTimestamp.current > PAUSE_DETECTION_MILLISECONDS)
    }, 1000)

    return () => {
      clearInterval(pauseWatcher)
    }
  }, [])

  return { onRenderedFrame, renderFrameStats, isRenderPaused }
}
