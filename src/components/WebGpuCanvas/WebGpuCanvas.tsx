import { createRoot, extend } from '@react-three/fiber/native'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import { PixelRatio, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native'
import { Canvas, type CanvasRef, type NativeCanvas, type RNCanvasContext } from 'react-native-webgpu'
import * as THREE from 'three/webgpu'

// A react-three-fiber canvas that draws with WebGPU (Dawn: Metal on iOS, Vulkan on Android) through react-native-webgpu,
// instead of OpenGL ES through expo-gl. The renderer is created here and handed to fiber as `gl`.

// What fiber and the renderer expect of a DOM canvas, on top of the native canvas.
class ReactNativeCanvas {
  style = {}

  constructor(private readonly nativeCanvas: NativeCanvas) {}

  get width(): number {
    return this.nativeCanvas.width
  }

  set width(value: number) {
    this.nativeCanvas.width = value
  }

  get height(): number {
    return this.nativeCanvas.height
  }

  set height(value: number) {
    this.nativeCanvas.height = value
  }

  get clientWidth(): number {
    return this.nativeCanvas.clientWidth
  }

  get clientHeight(): number {
    return this.nativeCanvas.clientHeight
  }

  addEventListener() {
    // Nothing to listen to: touches are handled by React Native.
  }

  removeEventListener() {
    // Nothing to listen to: touches are handled by React Native.
  }

  dispatchEvent(): boolean {
    return false
  }

  setPointerCapture() {
    // Nothing to listen to: touches are handled by React Native.
  }

  releasePointerCapture() {
    // Nothing to listen to: touches are handled by React Native.
  }
}

interface ICameraSettings {
  fov: number
  near: number
  far: number
  position: [number, number, number]
}

interface IWebGpuCanvasProps {
  children: ReactNode
  style?: StyleProp<ViewStyle>
  camera: ICameraSettings
  isAntialiased: boolean
  isShadowEnabled: boolean
  toneMapping: THREE.ToneMapping
  onCreated?: (state: { gl: THREE.WebGPURenderer; camera: unknown }) => void
  testID?: string
}

export const WebGpuCanvas = ({ children, style, camera, isAntialiased, isShadowEnabled, toneMapping, onCreated, testID }: IWebGpuCanvasProps) => {
  const canvasRef = useRef<CanvasRef>(null)
  const rootRef = useRef<ReturnType<typeof createRoot> | null>(null)
  const childrenRef = useRef<ReactNode>(children)
  const [hasLayout, setHasLayout] = useState<boolean>(false)

  const handleLayout = (event: LayoutChangeEvent) => {
    if (event.nativeEvent.layout.width > 0 && event.nativeEvent.layout.height > 0) {
      setHasLayout(true)
    }
  }

  useEffect(() => {
    if (!hasLayout) {
      return undefined
    }

    const context: RNCanvasContext | null = canvasRef.current?.getContext('webgpu') ?? null

    if (!context) {
      console.warn('[webgpu] no context')

      return undefined
    }

    let isCancelled = false
    const nativeCanvas = context.canvas as unknown as NativeCanvas

    nativeCanvas.width = nativeCanvas.clientWidth * PixelRatio.get()

    nativeCanvas.height = nativeCanvas.clientHeight * PixelRatio.get()

    const reactNativeCanvas = new ReactNativeCanvas(nativeCanvas)
    const renderer = new THREE.WebGPURenderer({ antialias: isAntialiased, alpha: true, canvas: reactNativeCanvas as never, context: context })

    const start = async () => {
      await renderer.init()

      if (isCancelled) {
        return
      }

      renderer.toneMapping = toneMapping

      const root = createRoot(reactNativeCanvas as never)

      rootRef.current = root

      await root.configure({
        size: { width: nativeCanvas.clientWidth, height: nativeCanvas.clientHeight, top: 0, left: 0 },
        gl: renderer as never,
        dpr: 1,
        frameloop: 'always',
        camera,
        shadows: isShadowEnabled,
        onCreated: state => {
          const render = state.gl.render.bind(state.gl)

          // React Native needs an explicit present after every frame.
          state.gl.render = (...renderArguments: Parameters<typeof render>) => {
            render(...renderArguments)

            context.present()
          }

          onCreated?.({ gl: renderer, camera: state.camera })
        },
      })

      root.render(childrenRef.current as never)
    }

    void start()

    return () => {
      isCancelled = true

      rootRef.current?.unmount()

      rootRef.current = null

      void renderer.setAnimationLoop(null)

      void renderer.dispose()
    }
    // The canvas is set up once, when it first has a size.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasLayout])

  useEffect(() => {
    childrenRef.current = children

    rootRef.current?.render(children as never)
  })

  useEffect(() => {
    extend(THREE as never)
  }, [])

  return <Canvas ref={canvasRef} style={style} onLayout={handleLayout} testID={testID} />
}
