import type { FlashListRef } from '@shopify/flash-list'
import type { RefObject } from 'react'
import type { LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent } from 'react-native'
import type { ISharedValue } from '@services/sceneSync/createSharedValue'

import type { IPressState } from '@flows/catalogueFlow/_facadesLogic/computeCardAnimation'
import type { IDragState, IOpeningFacade, IOpeningPhaseKey, IOpeningSceneState } from '@flows/openingFlow/_types'
import type { EBoxIdentifier } from '@networking/api/MysteryBoxApi/_types'
import type { IRenderFrameStats } from '@services/performance/summarizeFrameDeltas'

// Linear RGBA, each channel 0..1.
export type TColorRgba = [number, number, number, number]

export interface IBoxFinish {
  roughness: number
  metallic: number
  clearCoat: number
}

export interface ICatalogueCard {
  identifier: EBoxIdentifier
  name: string
  priceText: string
  prizeText: string
  // Shown only when the balance is too low for this box; null otherwise.
  affordabilityText: string | null
  isAffordable: boolean
  colorLinearRgba: TColorRgba
  finish: IBoxFinish
}

// Shared values written by React (list, finger, sensors) and read by the 3D scene on every frame.
export interface ICatalogueSceneSync {
  scrollOffset: ISharedValue<number>
  openingScene: ISharedValue<IOpeningSceneState>
  dragState: ISharedValue<IDragState>
  // Device tilt, each axis -1..1 (zero without a gyroscope).
  tilt: ISharedValue<[number, number]>
  // Which card the finger is on (it is squeezed a little).
  pressState: ISharedValue<IPressState>
  // Set by the scene itself once it is ready to be shown (model loaded, boxes popped in, effects warmed up, frames steady).
  sceneReadiness: ISharedValue<boolean>
}

export interface ICatalogueViewport {
  width: number
  height: number
}

export interface ICatalogueFacade {
  titleText: string
  balanceLabelText: string
  balanceInCents: number
  loadingText: string
  errorText: string
  retryLabelText: string
  isLoadingBoxes: boolean
  // False until the 3D scene is ready to be shown: the loader stays up until then, the list is hidden.
  isSceneReady: boolean
  // Changes when the 3D scene has to be built anew (back from the background).
  sceneEpoch: number
  isErrorBoxes: boolean
  cards: ICatalogueCard[]
  viewport: ICatalogueViewport | null
  listRef: RefObject<FlashListRef<ICatalogueCard> | null>
  // Written by the list, the finger and the sensors, read by the 3D scene on every frame.
  sceneSync: ICatalogueSceneSync
  opening: IOpeningFacade
  phaseKey: IOpeningPhaseKey
  // True while anything moves (scroll, drag, opening): the renderer must keep drawing.
  isRenderContinuous: boolean
  // False while the Boxes tab is not shown: the 3D scene is not drawn then, and must be redrawn when the tab comes back.
  isScreenFocused: boolean
  isPerformanceOverlayVisible: boolean
  onRenderedFrame: (timestampMilliseconds: number) => void
  renderFrameStats: IRenderFrameStats | null
  isRenderPaused: boolean
  handleListLayout: (event: LayoutChangeEvent) => void
  handleScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void
  handleRetryPress: () => void
  handleCardPressIn: (boxIdentifier: EBoxIdentifier) => void
  handleCardPressOut: () => void
}
