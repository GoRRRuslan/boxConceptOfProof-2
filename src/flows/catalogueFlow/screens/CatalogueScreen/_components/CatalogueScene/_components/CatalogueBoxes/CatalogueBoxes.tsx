import { RenderOnDemand } from '@components/RenderOnDemand'
import type { ICatalogueCard, ICatalogueSceneSync, ICatalogueViewport } from '@flows/catalogueFlow/_types'
import { useFacadeCatalogueBoxes } from '@flows/catalogueFlow/screens/CatalogueScreen/_components/CatalogueScene/_components/CatalogueBoxes/_facades/useFacadeCatalogueBoxes'
import type { IOpeningPhaseKey } from '@flows/openingFlow/_types'

interface ICatalogueBoxesProps {
  cards: ICatalogueCard[]
  viewport: ICatalogueViewport
  sceneSync: ICatalogueSceneSync
  phaseKey: IOpeningPhaseKey
  isRenderContinuous: boolean
}

// Loads the box model, puts one instance per card into the scene and keeps them in sync with the
// list and with the opening experience.
export const CatalogueBoxes = ({ cards, viewport, sceneSync, phaseKey, isRenderContinuous }: ICatalogueBoxesProps) => {
  const { modelState, boxRoots } = useFacadeCatalogueBoxes({ cards, viewport, sceneSync })

  // Keeps the renderer running while something moves; a still screen stops rendering (battery).
  return (
    <>
      {boxRoots.map((boxRoot, cardIndex) => (
        <primitive key={cards[cardIndex].identifier} object={boxRoot} />
      ))}
      <RenderOnDemand
        activityKey={`${cards.length}|${viewport.width}x${viewport.height}|${modelState}|${phaseKey}`}
        warmupKey={modelState}
        isContinuous={isRenderContinuous}
      />
    </>
  )
}
