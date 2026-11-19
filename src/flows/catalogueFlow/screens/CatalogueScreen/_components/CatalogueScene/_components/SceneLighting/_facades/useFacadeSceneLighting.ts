import { useThree } from '@react-three/fiber/native'
import { useEffect } from 'react'
import { PMREMGenerator, type Scene, type WebGLRenderer } from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

import { ENVIRONMENT_INTENSITY } from '@flows/catalogueFlow/_config/sceneRenderConfig'

// Builds the reflection environment (a procedural "room" filtered into a PMREM cube map) and makes it
// the scene's environment. If the device cannot build it the scene is simply lit by the directional
// lights (flat, but never broken). Returns the cleanup.
const applyEnvironment = (renderer: WebGLRenderer, scene: Scene): (() => void) => {
  const pmremGenerator = new PMREMGenerator(renderer)
  const roomEnvironment = new RoomEnvironment()

  try {
    const renderTarget = pmremGenerator.fromScene(roomEnvironment, 0.04)

    scene.environment = renderTarget.texture

    scene.environmentIntensity = ENVIRONMENT_INTENSITY
  } catch (error) {
    console.warn('Environment map could not be built, using direct lights only.', error)
  }

  return () => {
    scene.environment?.dispose()

    scene.environment = null

    pmremGenerator.dispose()

    roomEnvironment.dispose()
  }
}

export const useFacadeSceneLighting = () => {
  const renderer = useThree(state => state.gl)
  const scene = useThree(state => state.scene)

  // ------------------- Side effects ----------------------- //
  useEffect(() => applyEnvironment(renderer, scene), [renderer, scene])
}
