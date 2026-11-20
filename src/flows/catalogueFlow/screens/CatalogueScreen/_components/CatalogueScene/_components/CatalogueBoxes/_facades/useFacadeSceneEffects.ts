import { useEffect, useMemo } from 'react'
import { AdditiveBlending, DoubleSide, Group, Mesh, MeshBasicMaterial } from 'three'

import type { ICatalogueCard } from '@flows/catalogueFlow/_types'
import { BURST_PARTICLE_POOL_SIZE, DUST_POOL_SIZE, RING_POOL_SIZE } from '@flows/openingFlow/_config/effectsConfig'
import { CAMERA_DISTANCE } from '@flows/catalogueFlow/_config/catalogueLayoutConfig'
import { computeCameraFieldOfView } from '@flows/catalogueFlow/_facadesLogic/computeCameraFieldOfView'
import {
  createDiscGeometry,
  createRingGeometry,
  createShaftGeometry,
  createVignetteGeometry,
} from '@services/sceneEffects/createEffectGeometries'

// Effects are drawn after every opaque surface.
const EFFECT_RENDER_ORDER = 10
// The vignette is drawn after everything else.
const VIGNETTE_RENDER_ORDER = 100
// How far in front of the camera the vignette hangs.
const VIGNETTE_DISTANCE = 1

const createEffectMaterial = (): MeshBasicMaterial =>
  new MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
    toneMapped: false,
  })

// The show around the boxes: soft glow behind every box, dust, comets running along the seams, light shaft, shock waves and
// a burst of sparks. All of it is made of three tiny pre-built meshes (disc, ring, shaft) that are tinted and moved every
// frame; nothing is created while the app runs. The maths is in computeSceneEffects.
export const useFacadeSceneEffects = (cards: ICatalogueCard[], viewportAspect: number) => {
  const effects = useMemo(() => {
    const discGeometry = createDiscGeometry()
    const ringGeometry = createRingGeometry()
    const shaftGeometry = createShaftGeometry()
    const root = new Group()
    const makeMeshes = (count: number, geometry: ReturnType<typeof createDiscGeometry>): Mesh[] =>
      Array.from({ length: count }, () => {
        const mesh = new Mesh(geometry, createEffectMaterial())

        mesh.visible = false

        mesh.renderOrder = EFFECT_RENDER_ORDER

        mesh.frustumCulled = false

        root.add(mesh)

        return mesh
      })

    const vignetteGeometry = createVignetteGeometry()
    const vignette = new Mesh(
      vignetteGeometry,
      new MeshBasicMaterial({ vertexColors: true, transparent: true, depthTest: false, depthWrite: false, side: DoubleSide, toneMapped: false }),
    )

    vignette.renderOrder = VIGNETTE_RENDER_ORDER

    vignette.frustumCulled = false

    root.add(vignette)

    return {
      root,
      vignette,
      sparks: makeMeshes(BURST_PARTICLE_POOL_SIZE, discGeometry),
      dust: makeMeshes(DUST_POOL_SIZE, discGeometry),
      auras: makeMeshes(cards.length, discGeometry),
      rings: makeMeshes(RING_POOL_SIZE, ringGeometry),
      shaft: makeMeshes(1, shaftGeometry)[0],
      geometries: [discGeometry, ringGeometry, shaftGeometry, vignetteGeometry],
    }
  }, [cards.length])
  const auraColors = useMemo(() => cards.map(card => [card.colorLinearRgba[0], card.colorLinearRgba[1], card.colorLinearRgba[2]]), [cards])
  const tintCache = useMemo(() => ({ sparkLevel: -2, startedAtMilliseconds: 0 }), [])

  // The vignette hangs in front of the camera and covers exactly what the camera sees.
  useEffect(() => {
    const halfHeight = Math.tan((computeCameraFieldOfView() * Math.PI) / 360) * VIGNETTE_DISTANCE

    effects.vignette.position.set(0, 0, CAMERA_DISTANCE - VIGNETTE_DISTANCE)

    effects.vignette.scale.set(halfHeight * viewportAspect, halfHeight, 1)
  }, [effects, viewportAspect])

  useEffect(
    () => () => {
      effects.geometries.forEach(geometry => {
        geometry.dispose()
      })

      effects.root.children.forEach(child => {
        if (child instanceof Mesh && child.material instanceof MeshBasicMaterial) {
          child.material.dispose()
        }
      })
    },
    [effects],
  )

  return { effectsRoot: effects.root, effects, auraColors, tintCache }
}
