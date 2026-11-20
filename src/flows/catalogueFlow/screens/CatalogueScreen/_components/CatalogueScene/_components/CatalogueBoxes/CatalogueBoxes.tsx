import { RenderOnDemand } from '@components/RenderOnDemand'
import { IDLE_RENDER_HOLD_MILLISECONDS, IDLE_RENDER_MAXIMUM_MILLISECONDS } from '@flows/catalogueFlow/_config/sceneRenderConfig'
import type { ICatalogueCard, ICatalogueSceneSync, ICatalogueViewport } from '@flows/catalogueFlow/_types'
import { useFacadeCatalogueBoxes } from '@flows/catalogueFlow/screens/CatalogueScreen/_components/CatalogueScene/_components/CatalogueBoxes/_facades/useFacadeCatalogueBoxes'
import type { IOpeningPhaseKey } from '@flows/openingFlow/_types'

interface ICatalogueBoxesProps {
  cards: ICatalogueCard[]
  viewport: ICatalogueViewport
  sceneSync: ICatalogueSceneSync
  phaseKey: IOpeningPhaseKey
  isRenderContinuous: boolean
  // False while the Boxes tab is hidden. Passed in as a prop: the navigation context does not reach into the 3D tree.
  isScreenFocused: boolean
}

// Loads the box model, puts one instance per card into the scene and keeps them in sync with the
// list and with the opening experience.
export const CatalogueBoxes = ({ cards, viewport, sceneSync, phaseKey, isRenderContinuous, isScreenFocused }: ICatalogueBoxesProps) => {
  const { modelState, boxRoots, effectsRoot } = useFacadeCatalogueBoxes({ cards, viewport, sceneSync })

  // Keeps the renderer running while something moves; a still screen stops rendering (battery).
  return (
    <>
      {boxRoots.map((boxRoot, cardIndex) => (
        <primitive key={cards[cardIndex].identifier} object={boxRoot} />
      ))}
      <primitive object={effectsRoot} />
      <RenderOnDemand
        activityKey={`${cards.length}|${viewport.width}x${viewport.height}|${modelState}|${phaseKey}`}
        warmupKey={modelState}
        minimumMilliseconds={IDLE_RENDER_HOLD_MILLISECONDS}
        maximumMilliseconds={IDLE_RENDER_MAXIMUM_MILLISECONDS}
        isContinuous={isRenderContinuous}
        isScreenFocused={isScreenFocused}
      />
    </>
  )
}
