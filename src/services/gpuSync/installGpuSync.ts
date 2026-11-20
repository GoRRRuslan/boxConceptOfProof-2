// expo-gl queues the OpenGL commands of a frame and runs them on its own thread, so JS can run many
// frames ahead of the GPU: on a slow GPU (the iOS Simulator renders with Apple's software OpenGL ES)
// the queue grows, the picture lags behind the fingers and a JS-side frame counter reports a frame
// rate that was never on screen. Reading back ONE pixel is a sync point: it returns only when the GPU
// has finished everything queued before it. Doing it after every Nth frame gives back-pressure (the JS
// frame loop is paced by the real GPU) and makes the frame meter truthful.

interface IReadbackContext {
  RGBA: number
  UNSIGNED_BYTE: number
  readPixels: (x: number, y: number, width: number, height: number, format: number, type: number, pixels: Uint8Array) => void
}

interface IRenderer {
  render: (...renderArguments: never[]) => void
  getContext: () => unknown
}

// How many frames pass between two sync points: 0 = never, 1 = after every frame.
export const shouldSyncAfterFrame = (frameNumber: number, intervalFrames: number): boolean =>
  intervalFrames > 0 && frameNumber % intervalFrames === 0

export const installGpuSync = (renderer: IRenderer, intervalFrames: number): void => {
  if (intervalFrames <= 0) {
    return
  }

  const context = renderer.getContext() as IReadbackContext
  const pixel = new Uint8Array(4)
  const render = renderer.render.bind(renderer)
  let frameNumber = 0

  let renderMilliseconds = 0

  renderer.render = (...renderArguments) => {
    const startedAt = performance.now()

    render(...renderArguments)

    renderMilliseconds += performance.now() - startedAt

    frameNumber += 1

    if (frameNumber % 60 === 0) {
      console.info(`[render] avg render() ${(renderMilliseconds / 60).toFixed(1)} ms`)

      renderMilliseconds = 0
    }

    if (shouldSyncAfterFrame(frameNumber, intervalFrames)) {
      context.readPixels(0, 0, 1, 1, context.RGBA, context.UNSIGNED_BYTE, pixel)
    }
  }
}
