import { type Mesh, type MeshBasicMaterial } from 'three'

import { BOX_CENTER_HEIGHT_UNITS, BOX_WIDTH_UNITS } from '@flows/catalogueFlow/_config/catalogueLayoutConfig'
import { AURA_SCALE, SHAFT_ANCHOR_HEIGHT } from '@flows/openingFlow/_config/effectsConfig'
import {
  computeAuraAlpha,
  computeBurstParticle,
  computeDustPoint,
  computeRingEffect,
  computeShaftEffect,
  getAnticipationLinear,
  getPopElapsedMilliseconds,
  getRarityProfile,
  transformModelPoint,
} from '@flows/openingFlow/_facadesLogic/computeSceneEffects'
import type { IOpeningPose, IOpeningSceneState } from '@flows/openingFlow/_types'

// How far behind its box (in model units) the aura sits.
const AURA_DEPTH_BEHIND_BOX = 0.9
// The light shaft, the shock waves and the sparks are drawn in front of the open box (this many model units towards the
// camera), so no part of them is cut off by the lid or the walls of the box.
const IN_FRONT_OF_BOX_MODEL_UNITS = 1.3
const HIDDEN_SCALE = 0.0001
const WARM_UP_MILLISECONDS = 3500
const PARKED_HEIGHT = -1000

export interface ISceneEffectObjects {
  sparks: Mesh[]
  dust: Mesh[]
  auras: Mesh[]
  rings: Mesh[]
  shaft: Mesh
}

export interface ISceneEffectsFrame {
  scene: IOpeningSceneState
  nowMilliseconds: number
  focusProgress: number
  tuckProgress: number
  seamIntensity: number
  // Pose of every card's box this frame (after the camera punch) and the horizontal shake of the focused one.
  poses: IOpeningPose[]
  focusedPose: IOpeningPose | null
  shakeX: number
}

// What was last written to the materials (the prize tint only changes when the prize does).
export interface ISceneEffectsTintCache {
  sparkLevel: number
  // When the first frame was drawn (0 = not yet): for a moment after the start every effect mesh is drawn once, tiny and off
  // screen, so its shader program is compiled during the entrance and not as a hitch when the lid is let go.
  startedAtMilliseconds: number
}

const place = (mesh: Mesh, x: number, y: number, z: number, scaleX: number, scaleY: number, scaleZ: number, isWarmingUp: boolean) => {
  mesh.visible = scaleX > HIDDEN_SCALE || isWarmingUp

  if (scaleX <= HIDDEN_SCALE && isWarmingUp) {
    mesh.position.set(0, PARKED_HEIGHT, 0)

    mesh.scale.set(HIDDEN_SCALE, HIDDEN_SCALE, HIDDEN_SCALE)
  } else if (mesh.visible) {
    mesh.position.set(x, y, z)

    mesh.scale.set(scaleX, scaleY, scaleZ)
  }
}

// Places and tints every effect object for this frame. Called once per frame, after the box poses have been set.
export const applySceneEffects = (
  effects: ISceneEffectObjects,
  auraColors: number[][],
  tintCache: ISceneEffectsTintCache,
  frame: ISceneEffectsFrame,
) => {
  const { scene, nowMilliseconds, focusProgress, tuckProgress, seamIntensity, poses, focusedPose, shakeX } = frame

  if (tintCache.startedAtMilliseconds === 0) {
    tintCache.startedAtMilliseconds = nowMilliseconds
  }

  const isWarmingUp = nowMilliseconds - tintCache.startedAtMilliseconds < WARM_UP_MILLISECONDS
  const popElapsed = getPopElapsedMilliseconds(scene, nowMilliseconds)
  const anticipation = getAnticipationLinear(scene, nowMilliseconds)
  const isArmed = scene.rarityLevel >= 0
  const [glowRed, glowGreen, glowBlue] = scene.glowColorLinear
  const boost = getRarityProfile(scene.rarityLevel).emissiveBoost
  const unit = focusedPose ? focusedPose.scale : 0

  // Aura: a soft coloured glow behind every box.
  effects.auras.forEach((aura, cardIndex) => {
    const pose = poses[cardIndex] as IOpeningPose | undefined

    if (!pose) {
      return
    }

    const isFocused = cardIndex === scene.focusedCardIndex
    const alpha = pose.isVisible ? computeAuraAlpha(isFocused, focusProgress, seamIntensity, popElapsed) * (isFocused ? 1 - tuckProgress : 1) : 0
    const diameter = pose.scale * BOX_WIDTH_UNITS * AURA_SCALE
    const material = aura.material as MeshBasicMaterial
    const [red, green, blue] = isFocused && isArmed ? [glowRed, glowGreen, glowBlue] : auraColors[cardIndex]

    place(aura, isFocused ? shakeX : 0, pose.translateY, pose.translateZ - AURA_DEPTH_BEHIND_BOX * pose.scale, alpha > 0 ? diameter : 0, diameter, 1, isWarmingUp)

    material.color.setRGB(red, green, blue)

    material.opacity = alpha
  })

  // Everything below belongs to the focused box.
  if (!focusedPose || scene.focusedCardIndex < 0) {
    [...effects.sparks, ...effects.dust, ...effects.rings, effects.shaft].forEach(mesh => {
      place(mesh, 0, 0, 0, 0, 0, 0, isWarmingUp)
    })

    return
  }

  const [mouthX, mouthY, mouthZ] = transformModelPoint(0, SHAFT_ANCHOR_HEIGHT + BOX_CENTER_HEIGHT_UNITS, 0, BOX_CENTER_HEIGHT_UNITS, focusedPose)

  // Tint of everything that sparkles: the colour of the prize. Only when the prize changes.
  if (tintCache.sparkLevel !== scene.rarityLevel) {
    effects.sparks.forEach(mesh => {
      const material = mesh.material as MeshBasicMaterial

      material.color.setRGB(glowRed * boost + 0.15, glowGreen * boost + 0.15, glowBlue * boost + 0.15)

      material.opacity = 0.9
    })

    // Dust is a cool, dim shimmer.
    effects.dust.forEach(mesh => {
      const material = mesh.material as MeshBasicMaterial

      material.color.setRGB(0.55, 0.7, 1)

      material.opacity = 0.22
    })

    tintCache.sparkLevel = scene.rarityLevel
  }

  effects.sparks.forEach((spark, index) => {
    const point = computeBurstParticle(index, popElapsed, scene.rarityLevel)

    place(
      spark,
      mouthX + shakeX + point.x * unit,
      mouthY + point.y * unit,
      mouthZ + (point.z + IN_FRONT_OF_BOX_MODEL_UNITS) * unit,
      point.scale * unit,
      point.scale * unit,
      1,
      isWarmingUp,
    )
  })

  const dustVisibility = focusProgress * (1 - tuckProgress) * (popElapsed >= 0 ? Math.max(0, 1 - popElapsed / 400) : 1)

  effects.dust.forEach((mote, index) => {
    const point = computeDustPoint(index, nowMilliseconds, anticipation, dustVisibility)

    place(
      mote,
      shakeX + point.x * unit,
      focusedPose.translateY + point.y * unit,
      focusedPose.translateZ + point.z * unit,
      point.scale * unit,
      point.scale * unit,
      1,
      isWarmingUp,
    )
  })

  // Light shaft.
  const shaft = computeShaftEffect(popElapsed, tuckProgress, nowMilliseconds, scene.rarityLevel)
  const shaftMaterial = effects.shaft.material as MeshBasicMaterial
  const shaftWidth = shaft.scaleX * unit * BOX_WIDTH_UNITS

  place(effects.shaft, mouthX + shakeX, mouthY, mouthZ + IN_FRONT_OF_BOX_MODEL_UNITS * unit, shaft.alpha > 0 ? shaftWidth : 0, shaft.scaleY * unit * BOX_WIDTH_UNITS, shaftWidth, isWarmingUp)

  shaftMaterial.color.setRGB(glowRed * boost, glowGreen * boost, glowBlue * boost)

  shaftMaterial.opacity = shaft.alpha

  // Shock waves.
  effects.rings.forEach((ringMesh, index) => {
    const ring = computeRingEffect(index, popElapsed, scene.rarityLevel)
    const diameter = ring.scale * unit * BOX_WIDTH_UNITS
    const material = ringMesh.material as MeshBasicMaterial

    place(ringMesh, mouthX + shakeX, mouthY, mouthZ + IN_FRONT_OF_BOX_MODEL_UNITS * unit, ring.alpha > 0 ? diameter : 0, diameter, 1, isWarmingUp)

    material.color.setRGB(glowRed * boost + 0.3, glowGreen * boost + 0.3, glowBlue * boost + 0.3)

    material.opacity = ring.alpha
  })
}
