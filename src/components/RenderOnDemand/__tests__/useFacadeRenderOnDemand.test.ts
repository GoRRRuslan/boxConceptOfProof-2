import { act, renderHook } from '@testing-library/react-native'
import { AppState, type AppStateStatus } from 'react-native'

import { useFacadeRenderOnDemand } from '@components/RenderOnDemand/_facades/useFacadeRenderOnDemand'

const mockSetFrameloop = jest.fn()
const mockInvalidate = jest.fn()
let mockFrameCallback: (() => void) | undefined
let appStateHandler: ((state: AppStateStatus) => void) | undefined

jest.mock('@react-three/fiber/native', () => ({
  useThree: (selector: (state: unknown) => unknown) => selector({ setFrameloop: mockSetFrameloop, invalidate: mockInvalidate }),
  useFrame: (callback: () => void) => {
    mockFrameCallback = callback
  },
}))

const renderParams = (activityKey: string, warmupKey = 'ready') => ({
  activityKey,
  warmupKey,
  warmupMilliseconds: 3000,
  minimumMilliseconds: 500,
  minimumFrames: 12,
  maximumMilliseconds: 10_000,
  isContinuous: false,
})

// Pretends the renderer draws `framesPerStep` frames while `milliseconds` pass.
const runFrames = async (milliseconds: number, framesPerStep = 4) => {
  for (let elapsed = 0; elapsed < milliseconds; elapsed += 100) {
    for (let frame = 0; frame < framesPerStep; frame += 1) {
      mockFrameCallback?.()
    }

    await jest.advanceTimersByTimeAsync(100)
  }
}

const lastFrameloop = () => mockSetFrameloop.mock.calls.at(-1)?.[0] as string | undefined

describe('useFacadeRenderOnDemand', () => {
  beforeEach(() => {
    jest.useFakeTimers()

    mockSetFrameloop.mockClear()

    mockInvalidate.mockClear()

    mockFrameCallback = undefined

    appStateHandler = undefined

    jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, handler) => {
      appStateHandler = handler

      return { remove: jest.fn() }
    })
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('renders at once and keeps going through the startup window, then rests', async () => {
    await renderHook(() => {
      useFacadeRenderOnDemand(renderParams('a'))
    })

    expect(lastFrameloop()).toBe('always')

    expect(mockInvalidate).toHaveBeenCalled()

    await runFrames(2900)

    expect(lastFrameloop()).toBe('always')

    await runFrames(400)

    expect(lastFrameloop()).toBe('demand')
  })

  it('after the startup window it rests once enough frames AND the minimum time passed', async () => {
    const { rerender } = await renderHook(
      (activityKey: string) => {
        useFacadeRenderOnDemand(renderParams(activityKey))
      },
      { initialProps: 'a' },
    )

    await runFrames(4000)

    expect(lastFrameloop()).toBe('demand')

    await rerender('b')

    expect(lastFrameloop()).toBe('always')

    await runFrames(300)

    expect(lastFrameloop()).toBe('always')

    await runFrames(400)

    expect(lastFrameloop()).toBe('demand')
  })

  it('keeps rendering on a slow device until the required number of frames was drawn', async () => {
    const { rerender } = await renderHook(
      (activityKey: string) => {
        useFacadeRenderOnDemand(renderParams(activityKey))
      },
      { initialProps: 'a' },
    )

    await runFrames(4000)

    await rerender('b')

    // One frame per 100 ms: 12 frames need 1.2 s although the minimum time is 0.5 s.
    await runFrames(1000, 1)

    expect(lastFrameloop()).toBe('always')

    await runFrames(400, 1)

    expect(lastFrameloop()).toBe('demand')
  })

  it('gives up at the maximum time even if no frame is ever rendered', async () => {
    await renderHook(() => {
      useFacadeRenderOnDemand(renderParams('a'))
    })

    await runFrames(10_500, 0)

    expect(lastFrameloop()).toBe('demand')
  })

  it('never rests a continuous scene', async () => {
    await renderHook(() => {
      useFacadeRenderOnDemand({ ...renderParams('a'), isContinuous: true })
    })

    await runFrames(30_000)

    expect(mockSetFrameloop).not.toHaveBeenCalledWith('demand')
  })

  it('does not rest while activity keeps arriving', async () => {
    const { rerender } = await renderHook(
      (activityKey: string) => {
        useFacadeRenderOnDemand(renderParams(activityKey))
      },
      { initialProps: 'a' },
    )

    await runFrames(4000)

    mockSetFrameloop.mockClear()

    for (const key of ['b', 'c', 'd']) {
      await runFrames(200)

      await rerender(key)
    }

    expect(mockSetFrameloop).not.toHaveBeenCalledWith('demand')
  })

  it('uses the long warm-up window again when the warm-up key changes (model finished loading)', async () => {
    const { rerender } = await renderHook(
      (warmupKey: string) => {
        useFacadeRenderOnDemand(renderParams(`activity-${warmupKey}`, warmupKey))
      },
      { initialProps: 'loading' },
    )

    await runFrames(4000)

    await rerender('loaded')

    await runFrames(2800)

    expect(lastFrameloop()).toBe('always')

    await runFrames(400)

    expect(lastFrameloop()).toBe('demand')
  })

  it('redraws for one more window when the app comes back to the foreground', async () => {
    await renderHook(() => {
      useFacadeRenderOnDemand(renderParams('a'))
    })

    await runFrames(4000)

    expect(lastFrameloop()).toBe('demand')

    await act(() => {
      appStateHandler?.('background')
    })

    expect(lastFrameloop()).toBe('demand')

    await act(() => {
      appStateHandler?.('active')
    })

    expect(lastFrameloop()).toBe('always')

    await runFrames(1000)

    expect(lastFrameloop()).toBe('demand')
  })
})
