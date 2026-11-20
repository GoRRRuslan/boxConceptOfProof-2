import { useFrame } from '@react-three/fiber/native'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Group } from 'three'

import boxModelSource from '@assets/models/box.glb'
import { ENTRANCE_STAGGER_MILLISECONDS } from '@flows/catalogueFlow/_config/catalogueLayoutConfig'
import { computeBoxPose } from '@flows/catalogueFlow/_facadesLogic/computeBoxPose'
import { computeEntranceScale, computePressScale } from '@flows/catalogueFlow/_facadesLogic/computeCardAnimation'
import type { ICatalogueCard, ICatalogueSceneSync, ICatalogueViewport } from '@flows/catalogueFlow/_types'
import { TILT_PITCH_RADIANS, TILT_YAW_RADIANS } from '@flows/openingFlow/_config/openingConfig'
import { computeOpeningPose } from '@flows/openingFlow/_facadesLogic/computeOpeningPose'
import { easeInOutCubic, easeOutBack } from '@flows/openingFlow/_facadesLogic/openingEasing'
import {
  computeAnticipationEffect,
  computeGlowStrength,
  getAnticipationProgress,
  getFocusProgress,
  getLidProgress,
  getTuckProgress,
} from '@flows/openingFlow/_facadesLogic/openingSceneState'
import { isDragStateAnimating, stepDragInertia } from '@flows/openingFlow/_facadesLogic/stepDragInertia'
import { type IBoxInstance, createBoxInstance } from '@services/boxModel/createBoxInstance'
import { EStartupMark, markStartup } from '@services/performance/startupTimeline'
import { loadBoxModel } from '@services/boxModel/loadBoxModel'
import { computeLidHingeTransform, LID_FULLY_OPEN_ANGLE_DEGREES } from '@services/lidHinge/computeLidHingeTransform'

interface IUseFacadeCatalogueBoxesParams {
  cards: ICatalogueCard[]
  viewport: ICatalogueViewport
  sceneSync: ICatalogueSceneSync
}

type TModelState = 'loading' | 'loaded' | 'error'

const MAXIMUM_FRAME_SECONDS = 0.05
const PARKED_HEIGHT = -1000
// Smaller than this the box is invisible anyway; hiding it avoids a singular matrix.
const MINIMUM_VISIBLE_SCALE = 0.0005
// Before the first frame with boxes the entrance has not started: the boxes are invisible until it does.
const ENTRANCE_NOT_STARTED = Number.MAX_SAFE_INTEGER

// One GLB loaded once, one instance per card. Every frame (React Three Fiber's `useFrame`, on the JS
// thread) each instance is placed for the current scroll offset and opening state: in its card
// (popping in on first appearance, squeezed while pressed), or (for the opened box) centred and pushed
// towards the camera, turned by the finger / device tilt / auto-rotation, zoomed, shaking before the lid
// swings open, with light glowing from inside.
export const useFacadeCatalogueBoxes = ({ cards, viewport, sceneSync }: IUseFacadeCatalogueBoxesParams) => {
  const { width: viewportWidth, height: viewportHeight } = viewport
  const { scrollOffset, openingScene, dragState, tilt, pressState } = sceneSync

  // --------------------------- State ------------------------- //
  const [template, setTemplate] = useState<Group | null>(null)
  const [modelState, setModelState] = useState<TModelState>('loading')

  // -------------------------- Values ------------------------- //
  const entranceStartedAt = useRef<number>(ENTRANCE_NOT_STARTED)
  // Last glow strength written to the boxes (so a material is only touched when the strength really changes).
  const lastGlowStrength = useRef<number>(0)
  const lastGlowCardIndex = useRef<number>(-1)
  const instances: IBoxInstance[] = useMemo(
    () =>
      template
        ? cards.map(card =>
            createBoxInstance(
              template,
              {
                color: [card.colorLinearRgba[0], card.colorLinearRgba[1], card.colorLinearRgba[2]],
                roughness: card.finish.roughness,
                metallic: card.finish.metallic,
                clearCoat: card.finish.clearCoat,
              },
              true,
            ))
        : [],
    [template, cards],
  )
  const boxRoots = useMemo(() => instances.map(instance => instance.root), [instances])

  // ------------------- Side effects ----------------------- //
  useEffect(() => {
    let isCancelled = false

    loadBoxModel(boxModelSource)
      .then(loadedModel => {
        if (!isCancelled) {
          setTemplate(loadedModel)

          setModelState('loaded')

          markStartup(EStartupMark.ModelLoaded)
        }
      })
      .catch((error: unknown) => {
        console.warn('The box model could not be loaded.', error)

        if (!isCancelled) {
          setModelState('error')
        }
      })

    return () => {
      isCancelled = true
    }
  }, [])

  // Runs right before every rendered frame.
  useFrame((_, deltaSecondsRaw) => {
    if (viewportHeight === 0 || instances.length === 0) {
      return
    }

    const nowMilliseconds = Date.now()

    const deltaSeconds = Math.min(deltaSecondsRaw, MAXIMUM_FRAME_SECONDS)
    const scene = openingScene.getBlocking()
    const currentScrollOffset = scrollOffset.getBlocking()
    const focusLinearProgress = getFocusProgress(scene, nowMilliseconds)
    const focusProgress = easeInOutCubic(focusLinearProgress)
    const dollyProgress = easeOutBack(focusLinearProgress)
    const lidProgress = getLidProgress(scene, nowMilliseconds)
    const tuckProgress = easeInOutCubic(getTuckProgress(scene, nowMilliseconds))
    const anticipation = computeAnticipationEffect(getAnticipationProgress(scene, nowMilliseconds), nowMilliseconds)
    const lidAngleDegrees = LID_FULLY_OPEN_ANGLE_DEGREES * (scene.lidTarget === 1 ? easeOutBack(lidProgress) : easeInOutCubic(lidProgress))

    // Inspection physics: inertia after a flick, gliding back after a double tap, slow auto-rotation when left alone.
    const isAutoRotateAllowed = scene.focusTarget === 1 && scene.lidTarget === 0 && focusLinearProgress >= 1
    let drag = dragState.getBlocking()

    if (isDragStateAnimating(drag, isAutoRotateAllowed)) {
      drag = stepDragInertia(drag, deltaSeconds, nowMilliseconds, isAutoRotateAllowed)

      dragState.setBlocking(drag)
    }

    const [tiltX, tiltY] = scene.focusTarget === 1 ? tilt.getBlocking() : [0, 0]
    const press = pressState.getBlocking()
    const pressScale = computePressScale(press, nowMilliseconds)
    const entranceStart = entranceStartedAt.current

    instances.forEach(({ root }, cardIndex) => {
      const listPose = computeBoxPose({ cardIndex, scrollOffset: currentScrollOffset, viewportHeight })
      const entranceScale = computeEntranceScale(nowMilliseconds - entranceStart - cardIndex * ENTRANCE_STAGGER_MILLISECONDS)
      const squeeze = press.cardIndex === cardIndex ? pressScale : 1
      const pose = computeOpeningPose({
        listPose: { ...listPose, scale: listPose.scale * entranceScale * squeeze },
        isFocusedCard: cardIndex === scene.focusedCardIndex,
        lidProgress,
        focusProgress,
        dollyProgress,
        viewportWidth,
        viewportHeight,
        dragYawRadians: drag.yawRadians,
        dragPitchRadians: drag.pitchRadians,
        zoom: drag.zoom,
        autoYawRadians: drag.autoYawRadians,
        tiltYawRadians: tiltX * TILT_YAW_RADIANS,
        tiltPitchRadians: tiltY * TILT_PITCH_RADIANS,
        anticipation,
        tuckProgress,
      })
      const isShown = pose.isVisible && pose.scale > MINIMUM_VISIBLE_SCALE

      // Scale, then pitch, then yaw, then place: the same order as the Filament version's matrix chain.
      root.visible = isShown

      root.rotation.set(pose.pitchRadians, pose.yawRadians, 0, 'YXZ')

      root.position.set(0, isShown ? pose.translateY : PARKED_HEIGHT, pose.translateZ)

      root.scale.setScalar(pose.scale)
    })

    // The lid (and its wordmark) of the opened box swings about the hinge pivot.
    const focusedInstance = instances[scene.focusedCardIndex]

    if (focusedInstance) {
      const { rotate, translate } = computeLidHingeTransform(lidAngleDegrees)

      focusedInstance.lidParts.forEach(lidPart => {
        lidPart.rotation.set(rotate[0], rotate[1], rotate[2])

        lidPart.position.set(translate[0], translate[1], translate[2])
      })

      // Light from inside the opened box: the cushion and the inner side of the lid glow in the colour of the prize.
      const glowStrength = computeGlowStrength(lidProgress, nowMilliseconds)

      if (
        scene.focusedCardIndex !== lastGlowCardIndex.current ||
        Math.abs(glowStrength - lastGlowStrength.current) > 0.002
      ) {
        const [red, green, blue] = scene.glowColorLinear

        focusedInstance.glowMaterials.forEach(material => {
          material.emissive.setRGB(red * glowStrength, green * glowStrength, blue * glowStrength)
        })

        lastGlowStrength.current = glowStrength

        lastGlowCardIndex.current = scene.focusedCardIndex
      }
    }
  })

  return { modelState, boxRoots }
}
