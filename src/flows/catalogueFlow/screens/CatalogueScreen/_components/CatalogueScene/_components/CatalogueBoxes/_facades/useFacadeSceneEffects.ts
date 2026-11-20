import { useEffect, useMemo } from 'react'
import { AdditiveBlending, DoubleSide, Group, Mesh, MeshBasicMaterial } from 'three'

import type { ICatalogueCard } from '@flows/catalogueFlow/_types'
import { BURST_PARTICLE_POOL_SIZE, DUST_POOL_SIZE, RING_POOL_SIZE } from '@flows/openingFlow/_config/effectsConfig'
import { createDiscGeometry, createRingGeometry, createShaftGeometry } from '@services/sceneEffects/createEffectGeometries'

// Effects are drawn after every opaque surface.
const EFFECT_RENDER_ORDER = 10

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
export const useFacadeSceneEffects = (cards: ICatalogueCard[]) => {
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

    return {
      root,
      sparks: makeMeshes(BURST_PARTICLE_POOL_SIZE, discGeometry),
      dust: makeMeshes(DUST_POOL_SIZE, discGeometry),
      auras: makeMeshes(cards.length, discGeometry),
      rings: makeMeshes(RING_POOL_SIZE, ringGeometry),
      shaft: makeMeshes(1, shaftGeometry)[0],
      geometries: [discGeometry, ringGeometry, shaftGeometry],
    }
  }, [cards.length])
  const auraColors = useMemo(() => cards.map(card => [card.colorLinearRgba[0], card.colorLinearRgba[1], card.colorLinearRgba[2]]), [cards])
  const tintCache = useMemo(() => ({ sparkLevel: -2 }), [])

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
