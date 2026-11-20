import { WebGpuCanvas } from '@components/WebGpuCanvas/WebGpuCanvas'
import { useEffect, useMemo, useState } from 'react'
import { View } from 'react-native'
import { ACESFilmicToneMapping, NoToneMapping, type PerspectiveCamera } from 'three'

import { FrameMeter } from '@components/FrameMeter'
import { CAMERA_DISTANCE } from '@flows/catalogueFlow/_config/catalogueLayoutConfig'
import { IS_ANTIALIASING_ENABLED, isSoftwareSaving, IS_SHADOWS_ENABLED, RENDER_RESOLUTION_SCALE, SHADOW_WARMUP_MILLISECONDS, TONE_MAPPING_EXPOSURE } from '@flows/catalogueFlow/_config/sceneRenderConfig'
import { installCheapColorOutput } from '@services/softwareRenderer/installCheapColorOutput'
import { computeCameraFieldOfView } from '@flows/catalogueFlow/_facadesLogic/computeCameraFieldOfView'
import type { ICatalogueCard, ICatalogueSceneSync, ICatalogueViewport } from '@flows/catalogueFlow/_types'
import { CatalogueBoxes } from '@flows/catalogueFlow/screens/CatalogueScreen/_components/CatalogueScene/_components/CatalogueBoxes/CatalogueBoxes'
import { SceneLighting } from '@flows/catalogueFlow/screens/CatalogueScreen/_components/CatalogueScene/_components/SceneLighting/SceneLighting'
import { makeStyles } from '@flows/catalogueFlow/screens/CatalogueScreen/_components/CatalogueScene/CatalogueScene.styles'
import type { IOpeningPhaseKey } from '@flows/openingFlow/_types'

// Must happen before the first shader is compiled.
if (isSoftwareSaving('cheapColorOutput')) {
  installCheapColorOutput()
}

interface ICatalogueSceneProps {
  cards: ICatalogueCard[]
  viewport: ICatalogueViewport | null
  sceneSync: ICatalogueSceneSync
  phaseKey: IOpeningPhaseKey
  // A box is inspected, opened or revealed: shadows are rendered only then (they cost a depth pass).
  isInspecting: boolean
  isRenderContinuous: boolean
  onRenderedFrame: (timestampMilliseconds: number) => void
}

// The ONE 3D canvas of the app (one GL context); it fills the list area and sits behind the transparent cards.
export const CatalogueScene = ({
  cards,
  viewport,
  sceneSync,
  phaseKey,
  isInspecting,
  isRenderContinuous,
  onRenderedFrame,
}: ICatalogueSceneProps) => {
  const styles = useMemo(() => makeStyles(RENDER_RESOLUTION_SCALE), [])
  const [isWarmingUp, setIsWarmingUp] = useState<boolean>(true)
  // Shadows are on while a box is inspected and during the warm-up right after the start.
  const isShadowActive = !isSoftwareSaving('noShadows') && (isInspecting || isWarmingUp)
  const camera = useMemo(
    () => ({ fov: computeCameraFieldOfView(), near: 0.1, far: 60, position: [0, 0, CAMERA_DISTANCE] as [number, number, number] }),
    [],
  )

  useEffect(() => {
    const warmUpTimer = setTimeout(() => {
      setIsWarmingUp(false)
    }, SHADOW_WARMUP_MILLISECONDS)

    return () => {
      clearTimeout(warmUpTimer)
    }
  }, [])

  const handleCreated = (state: { gl: { setClearColor: (color: number, alpha: number) => void; toneMappingExposure: number }; camera: unknown }) => {
    // Transparent: the list's cards and the app background show through.
    state.gl.setClearColor(0x000000, 0)

    state.gl.toneMappingExposure = TONE_MAPPING_EXPOSURE

    ;(state.camera as PerspectiveCamera).lookAt(0, 0, 0)
  }

  return (
    <View style={styles.scaledLayer}>
    <WebGpuCanvas
      style={styles.canvas}
      camera={camera}
      isShadowEnabled={IS_SHADOWS_ENABLED && isShadowActive}
      isAntialiased={IS_ANTIALIASING_ENABLED}
      toneMapping={isSoftwareSaving('noToneMapping') ? NoToneMapping : ACESFilmicToneMapping}
      onCreated={handleCreated}
      testID="catalogueCanvas"
    >
      <SceneLighting isShadowActive={isShadowActive} />
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
    </WebGpuCanvas>
    </View>
  )
}
