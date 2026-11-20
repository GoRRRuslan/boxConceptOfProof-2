import { IS_SHADOWS_ENABLED, SCENE_LIGHTS, SHADOW_BIAS, SHADOW_FRUSTUM_HALF_SIZE, SHADOW_MAP_SIZE, SHADOW_NORMAL_BIAS } from '@flows/catalogueFlow/_config/sceneRenderConfig'
import { useFacadeSceneLighting } from '@flows/catalogueFlow/screens/CatalogueScreen/_components/CatalogueScene/_components/SceneLighting/_facades/useFacadeSceneLighting'

// The light rig (key with shadows, rim, fill) plus the reflection environment.
export const SceneLighting = () => {
  useFacadeSceneLighting()

  return (
    <>
      {SCENE_LIGHTS.map(light => (
        <directionalLight
          key={light.position.join()}
          position={light.position}
          color={light.colorHex}
          intensity={light.intensity}
          castShadow={IS_SHADOWS_ENABLED && light.castShadows}
          shadow-mapSize={[SHADOW_MAP_SIZE, SHADOW_MAP_SIZE]}
          shadow-camera-left={-SHADOW_FRUSTUM_HALF_SIZE}
          shadow-camera-right={SHADOW_FRUSTUM_HALF_SIZE}
          shadow-camera-top={SHADOW_FRUSTUM_HALF_SIZE}
          shadow-camera-bottom={-SHADOW_FRUSTUM_HALF_SIZE}
          shadow-camera-near={1}
          shadow-camera-far={25}
          shadow-bias={SHADOW_BIAS}
          shadow-normalBias={SHADOW_NORMAL_BIAS}
        />
      ))}
    </>
  )
}
