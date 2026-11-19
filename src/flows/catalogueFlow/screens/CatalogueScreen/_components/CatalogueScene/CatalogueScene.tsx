import { Canvas } from '@react-three/fiber/native'
import { useMemo } from 'react'
import { ACESFilmicToneMapping, type PerspectiveCamera } from 'three'

import { FrameMeter } from '@components/FrameMeter'
import { CAMERA_DISTANCE } from '@flows/catalogueFlow/_config/catalogueLayoutConfig'
import { IS_ANTIALIASING_ENABLED, TONE_MAPPING_EXPOSURE } from '@flows/catalogueFlow/_config/sceneRenderConfig'
import { computeCameraFieldOfView } from '@flows/catalogueFlow/_facadesLogic/computeCameraFieldOfView'
import type { ICatalogueCard, ICatalogueSceneSync, ICatalogueViewport } from '@flows/catalogueFlow/_types'
import { CatalogueBoxes } from '@flows/catalogueFlow/screens/CatalogueScreen/_components/CatalogueScene/_components/CatalogueBoxes/CatalogueBoxes'
import { SceneLighting } from '@flows/catalogueFlow/screens/CatalogueScreen/_components/CatalogueScene/_components/SceneLighting/SceneLighting'
import { makeStyles } from '@flows/catalogueFlow/screens/CatalogueScreen/_components/CatalogueScene/CatalogueScene.styles'
import type { IOpeningPhaseKey } from '@flows/openingFlow/_types'

interface ICatalogueSceneProps {
  cards: ICatalogueCard[]
  viewport: ICatalogueViewport | null
  sceneSync: ICatalogueSceneSync
  phaseKey: IOpeningPhaseKey
  isRenderContinuous: boolean
  onRenderedFrame: (timestampMilliseconds: number) => void
}

// The ONE 3D canvas of the app (one GL context); it fills the list area and sits behind the transparent cards.
export const CatalogueScene = ({
  cards,
  viewport,
  sceneSync,
  phaseKey,
  isRenderContinuous,
  onRenderedFrame,
}: ICatalogueSceneProps) => {
  const styles = useMemo(() => makeStyles(), [])
  const camera = useMemo(
    () => ({ fov: computeCameraFieldOfView(), near: 0.1, far: 60, position: [0, 0, CAMERA_DISTANCE] as [number, number, number] }),
    [],
  )

  const handleCreated = (state: { gl: { setClearColor: (color: number, alpha: number) => void; toneMappingExposure: number }; camera: unknown }) => {
    // Transparent: the list's cards and the app background show through.
    state.gl.setClearColor(0x000000, 0)

    state.gl.toneMappingExposure = TONE_MAPPING_EXPOSURE

    ;(state.camera as PerspectiveCamera).lookAt(0, 0, 0)
  }

  return (
    <Canvas
      style={styles.canvas}
      frameloop="always"
      shadows
      camera={camera}
      gl={{ alpha: true, antialias: IS_ANTIALIASING_ENABLED, toneMapping: ACESFilmicToneMapping }}
      onCreated={handleCreated}
      pointerEvents="none"
      testID="catalogueCanvas"
    >
      <SceneLighting />
      <FrameMeter onRenderedFrame={onRenderedFrame} />
      {cards.length > 0 && viewport ? (
        <CatalogueBoxes
          key={cards.length}
          cards={cards}
          viewport={viewport}
          sceneSync={sceneSync}
          phaseKey={phaseKey}
          isRenderContinuous={isRenderContinuous}
        />
      ) : null}
    </Canvas>
  )
}
