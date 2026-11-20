import { useFrame } from '@react-three/fiber/native'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Group } from 'three'

import boxModelSource from '@assets/models/box.glb'
import { ENTRANCE_DURATION_MILLISECONDS, ENTRANCE_STAGGER_MILLISECONDS } from '@flows/catalogueFlow/_config/catalogueLayoutConfig'
import { SCENE_READY_MINIMUM_FRAMES, SCENE_READY_SETTLE_MILLISECONDS } from '@flows/catalogueFlow/_config/sceneRenderConfig'
import { computeBoxPose } from '@flows/catalogueFlow/_facadesLogic/computeBoxPose'
import { ENTRANCE_NOT_STARTED, resolveEntranceStart } from '@flows/catalogueFlow/_facadesLogic/resolveEntranceStart'
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
import {
  computeCameraPunch,
  computeIridescenceTint,
  computeJitterScale,
  computeLidSettleDegrees,
  computeSeamIntensity,
  getIridescenceStrength,
  getPopElapsedMilliseconds,
  getRarityProfile,
  extrapolateScrollOffset,
  stepParallaxOffset,
  stepScrollSway,
  stepScrollVelocity,
} from '@flows/openingFlow/_facadesLogic/computeSceneEffects'
import type { IOpeningPose } from '@flows/openingFlow/_types'
import { logDiagnostic } from '@services/performance/diagnosticLog'
import { WARM_UP_MILLISECONDS as SCENE_EFFECTS_WARM_UP_MILLISECONDS, applySceneEffects } from '@services/sceneEffects/applySceneEffects'
import { useFacadeSceneEffects } from '@flows/catalogueFlow/screens/CatalogueScreen/_components/CatalogueScene/_components/CatalogueBoxes/_facades/useFacadeSceneEffects'
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

// Diagnostics: how often the scene reports what it shows.
const SCENE_STATE_LOG_INTERVAL_MILLISECONDS = 1000
const MAXIMUM_FRAME_SECONDS = 0.05
const PARKED_HEIGHT = -1000
// Smaller than this the box is invisible anyway; hiding it avoids a singular matrix.
const MINIMUM_VISIBLE_SCALE = 0.0005

// One GLB loaded once, one instance per card. Every frame (React Three Fiber's `useFrame`, on the JS
// thread) each instance is placed for the current scroll offset and opening state: in its card
// (popping in on first appearance, squeezed while pressed), or (for the opened box) centred and pushed
// towards the camera, turned by the finger / device tilt / auto-rotation, zoomed, shaking before the lid
// swings open, with light glowing from inside.
export const useFacadeCatalogueBoxes = ({ cards, viewport, sceneSync }: IUseFacadeCatalogueBoxesParams) => {
  const { width: viewportWidth, height: viewportHeight } = viewport
  const { scrollOffset, openingScene, dragState, tilt, pressState, sceneReadiness } = sceneSync

  // --------------------------- State ------------------------- //
  const [template, setTemplate] = useState<Group | null>(null)
  const [modelState, setModelState] = useState<TModelState>('loading')

  // -------------------------- Values ------------------------- //
  const entranceStartedAt = useRef<number>(ENTRANCE_NOT_STARTED)
  const lastSceneLogAt = useRef<number>(0)
  // Frames drawn since the entrance started: the scene is ready (and says so) only after enough of them.
  const framesSinceEntrance = useRef<number>(0)
  // Last glow strength written to the boxes (so a material is only touched when the strength really changes).
  const lastGlowStrength = useRef<number>(0)
  const lastGlowCardIndex = useRef<number>(-1)
  const lastSeamIntensity = useRef<number>(-1)
  // The last iridescence tint written to every box (so a material is only touched when the shimmer really moved).
  const lastIridescenceTints = useRef<number[][]>([])
  // Scroll speed -> sway of the boxes: [last offset, time it changed, smoothed scroll speed], the filtered sway, and the smoothed offset
  // the parallax turn of the boxes is computed from.
  const scrollVelocityState = useRef<[number, number, number]>([0, 0, 0])
  const swayState = useRef<number>(0)
  const parallaxOffsetState = useRef<number | null>(null)
  const { effectsRoot, effects, auraColors, tintCache } = useFacadeSceneEffects(cards, viewportWidth / Math.max(1, viewportHeight))
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
    const popElapsed = getPopElapsedMilliseconds(scene, nowMilliseconds)
    // The shake dies away in the last moment before the lid is let go (the box holds its breath).
    const jitterScale = computeJitterScale(popElapsed)
    const rawAnticipation = computeAnticipationEffect(getAnticipationProgress(scene, nowMilliseconds), nowMilliseconds)
    const anticipation = {
      ...rawAnticipation,
      jitterYawRadians: rawAnticipation.jitterYawRadians * jitterScale,
      jitterPitchRadians: rawAnticipation.jitterPitchRadians * jitterScale,
    }
    const punch = computeCameraPunch(popElapsed, scene.rarityLevel)
    const seamIntensity = computeSeamIntensity(scene, nowMilliseconds, focusLinearProgress, tuckProgress)
    const lidAngleDegrees =
      LID_FULLY_OPEN_ANGLE_DEGREES * (scene.lidTarget === 1 ? easeOutBack(lidProgress) : easeInOutCubic(lidProgress)) +
      (scene.lidTarget === 1 ? computeLidSettleDegrees(popElapsed) : 0)

    // The boxes sway against the direction of a fast scroll.
    const frameSeconds = Math.min(deltaSeconds, MAXIMUM_FRAME_SECONDS)
    const scrollVelocity = stepScrollVelocity(scrollVelocityState.current, currentScrollOffset, nowMilliseconds, frameSeconds)
    const sway = stepScrollSway(swayState.current, scrollVelocity[2], frameSeconds)
    const listScrollOffset = extrapolateScrollOffset(currentScrollOffset, scrollVelocity[2], scrollVelocity[1], nowMilliseconds)
    const parallaxOffset =
      parallaxOffsetState.current === null ? listScrollOffset : stepParallaxOffset(parallaxOffsetState.current, listScrollOffset, frameSeconds)

    scrollVelocityState.current = scrollVelocity

    swayState.current = sway

    parallaxOffsetState.current = parallaxOffset

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

    if (entranceStartedAt.current === ENTRANCE_NOT_STARTED) {
      entranceStartedAt.current = resolveEntranceStart(entranceStartedAt.current, nowMilliseconds, instances.length)

      markStartup(EStartupMark.FirstBoxFrame)
    }

    const entranceStart = entranceStartedAt.current

    // Ready to be shown: the model is loaded, every box has popped in, the effects were warmed up (their pipelines compiled), enough frames
    // were drawn since and the picture has settled. The list and the loader wait for this flag.
    if (!sceneReadiness.getBlocking()) {
      framesSinceEntrance.current += 1

      const entranceEnd = entranceStart + (instances.length - 1) * ENTRANCE_STAGGER_MILLISECONDS + ENTRANCE_DURATION_MILLISECONDS
      const effectsWarmedUpAt = tintCache.startedAtMilliseconds === 0 ? Number.MAX_SAFE_INTEGER : tintCache.startedAtMilliseconds + SCENE_EFFECTS_WARM_UP_MILLISECONDS

      if (
        framesSinceEntrance.current >= SCENE_READY_MINIMUM_FRAMES &&
        nowMilliseconds >= Math.max(entranceEnd, effectsWarmedUpAt) + SCENE_READY_SETTLE_MILLISECONDS
      ) {
        sceneReadiness.setBlocking(true)
      }
    }

    const poses: IOpeningPose[] = []
    let focusedPose: IOpeningPose | null = null
    let shakeX = 0

    instances.forEach(({ root }, cardIndex) => {
      const baseListPose = computeBoxPose({ cardIndex, scrollOffset: listScrollOffset, viewportHeight })
      // Where the box is (and how big) follows the list at once; how it TURNS with its place on the screen follows a smoothed offset.
      const parallaxYawRadians = computeBoxPose({ cardIndex, scrollOffset: parallaxOffset, viewportHeight }).yawRadians
      const listPose = { ...baseListPose, yawRadians: parallaxYawRadians + sway, pitchRadians: baseListPose.pitchRadians + sway * 0.5 }
      const entranceScale = computeEntranceScale(nowMilliseconds - entranceStart - cardIndex * ENTRANCE_STAGGER_MILLISECONDS)
      const squeeze = press.cardIndex === cardIndex ? pressScale : 1
      const openingPose = computeOpeningPose({
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
      const isFocusedCard = cardIndex === scene.focusedCardIndex
      // Camera punch: the focused box swells and shakes for a moment when the lid is let go.
      const pose = isFocusedCard
        ? {
            ...openingPose,
            scale: openingPose.scale * (1 + punch.scaleBoost),
            translateY: openingPose.translateY + punch.shakeY * openingPose.scale,
          }
        : openingPose
      const poseShakeX = isFocusedCard ? punch.shakeX * openingPose.scale : 0
      const isShown = pose.isVisible && pose.scale > MINIMUM_VISIBLE_SCALE

      poses.push(pose)

      // Iridescence: the glossy boxes shimmer with the turn of the box (colour added to the base colour).
      const iridescenceStrength = getIridescenceStrength(cards[cardIndex].finish.metallic)

      if (iridescenceStrength > 0 && isShown) {
        const tint = computeIridescenceTint(iridescenceStrength, pose.yawRadians, pose.pitchRadians, nowMilliseconds)
        const previousTint = lastIridescenceTints.current[cardIndex] as number[] | undefined

        if (!previousTint || Math.abs(previousTint[0] - tint[0]) + Math.abs(previousTint[1] - tint[1]) + Math.abs(previousTint[2] - tint[2]) > 0.006) {
          const [baseRed, baseGreen, baseBlue] = cards[cardIndex].colorLinearRgba

          instances[cardIndex].bodyMaterials.forEach(material => {
            material.color.setRGB(Math.max(0, baseRed + tint[0]), Math.max(0, baseGreen + tint[1]), Math.max(0, baseBlue + tint[2]))
          })

          lastIridescenceTints.current[cardIndex] = tint
        }
      }

      if (isFocusedCard) {
        focusedPose = pose

        shakeX = poseShakeX
      }

      // Scale, then pitch, then yaw, then place: the same order as the Filament version's matrix chain.
      root.visible = isShown

      root.rotation.set(pose.pitchRadians, pose.yawRadians, 0, 'YXZ')

      root.position.set(poseShakeX, isShown ? pose.translateY : PARKED_HEIGHT, pose.translateZ)

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

      // The seams of the focused box light up in the colour of the prize.
      if (Math.abs(seamIntensity - lastSeamIntensity.current) > 0.004) {
        const [red, green, blue] = scene.glowColorLinear
        const strength = seamIntensity * getRarityProfile(scene.rarityLevel).emissiveBoost

        focusedInstance.seamMaterials.forEach(material => {
          material.emissive.setRGB(red * strength, green * strength, blue * strength)
        })

        lastSeamIntensity.current = seamIntensity
      }
    }

    // Diagnostics: once a second, what the scene believes it shows (how many boxes are visible and how big the first one is).
    if (nowMilliseconds - lastSceneLogAt.current > SCENE_STATE_LOG_INTERVAL_MILLISECONDS) {
      lastSceneLogAt.current = nowMilliseconds

      logDiagnostic('scene.boxes', {
        visible: poses.filter(pose => pose.isVisible && pose.scale > MINIMUM_VISIBLE_SCALE).length,
        firstScale: Math.round((poses[0]?.scale ?? 0) * 1000) / 1000,
        focusedCardIndex: scene.focusedCardIndex,
        focusProgress: Math.round(focusProgress * 100) / 100,
        scrollOffset: Math.round(currentScrollOffset),
        viewport: `${viewportWidth}x${Math.round(viewportHeight)}`,
      })
    }

    applySceneEffects(effects, auraColors, tintCache, { scene, nowMilliseconds, focusProgress, tuckProgress, seamIntensity, poses, focusedPose, shakeX })
  })

  return { modelState, boxRoots, effectsRoot }
}
