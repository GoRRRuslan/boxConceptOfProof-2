import { installGpuSync, shouldSyncAfterFrame } from '@services/gpuSync/installGpuSync'

describe('shouldSyncAfterFrame', () => {
  it('never syncs when the interval is 0', () => {
    expect([1, 2, 3, 4].map(frame => shouldSyncAfterFrame(frame, 0))).toEqual([false, false, false, false])
  })

  it('syncs after every frame when the interval is 1', () => {
    expect([1, 2, 3].map(frame => shouldSyncAfterFrame(frame, 1))).toEqual([true, true, true])
  })

  it('syncs after every 3rd frame when the interval is 3', () => {
    expect([1, 2, 3, 4, 5, 6].map(frame => shouldSyncAfterFrame(frame, 3))).toEqual([false, false, true, false, false, true])
  })
})

describe('installGpuSync', () => {
  const makeRenderer = () => {
    const readPixels = jest.fn()
    const render = jest.fn()
    const renderer = { render, getContext: () => ({ RGBA: 6408, UNSIGNED_BYTE: 5121, readPixels }) }

    return { renderer, render, readPixels }
  }

  it('does nothing for interval 0', () => {
    const { renderer, render, readPixels } = makeRenderer()
    const originalRender = renderer.render

    installGpuSync(renderer, 0)

    expect(renderer.render).toBe(originalRender)

    renderer.render()

    expect(render).toHaveBeenCalledTimes(1)

    expect(readPixels).not.toHaveBeenCalled()
  })

  it('reads one pixel back after the render call, every Nth frame', () => {
    const { renderer, render, readPixels } = makeRenderer()

    installGpuSync(renderer, 2)

    renderer.render()

    renderer.render()

    renderer.render()

    renderer.render()

    expect(render).toHaveBeenCalledTimes(4)

    expect(readPixels).toHaveBeenCalledTimes(2)

    expect(readPixels).toHaveBeenCalledWith(0, 0, 1, 1, 6408, 5121, expect.any(Uint8Array))
  })
})
