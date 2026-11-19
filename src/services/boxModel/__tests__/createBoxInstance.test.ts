import { BoxGeometry, Group, type Material, Mesh, MeshStandardMaterial, type Object3D } from 'three'

import { EBoxPartName, createBoxInstance } from '@services/boxModel/createBoxInstance'

const asMesh = (object: Object3D | undefined): Mesh => {
  if (!(object instanceof Mesh)) {
    throw new Error('Expected a mesh')
  }

  return object
}

const asStandardMaterial = (material: Material | Material[]): MeshStandardMaterial => {
  if (!(material instanceof MeshStandardMaterial)) {
    throw new Error('Expected a standard material')
  }

  return material
}

const makeMesh = (name: string) => new Mesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial({ name }))

// Builds the same shape GLTFLoader produces for the real model: one mesh per single-primitive part,
// a group of two meshes for the lid, node names with a numeric suffix.
const makeTemplate = () => {
  const template = new Group()
  const base = makeMesh('body')
  const cushion = makeMesh('cushion')
  const lid = new Group()
  const wordmark = makeMesh('wordmark')

  base.name = `${EBoxPartName.Base}_1`

  cushion.name = EBoxPartName.Cushion

  lid.name = EBoxPartName.Lid

  lid.add(makeMesh('lidOuter'), makeMesh('lidInner'))

  wordmark.name = EBoxPartName.Wordmark

  template.add(base, cushion, lid, wordmark)

  return template
}

const look = { color: [0.1, 0.2, 0.3] as [number, number, number], roughness: 0.3, metallic: 0.65, clearCoat: 1 }

describe('createBoxInstance', () => {
  it('gives the body of every box its own colour and finish without touching the template', () => {
    const template = makeTemplate()
    const first = createBoxInstance(template, look, true)
    const second = createBoxInstance(template, { ...look, color: [1, 0, 0] }, true)
    const firstMaterial = asStandardMaterial(asMesh(first.root.children[0].children[0]).material)
    const secondMaterial = asStandardMaterial(asMesh(second.root.children[0].children[0]).material)

    expect(firstMaterial.color.g).toBeCloseTo(0.2)

    expect(firstMaterial.roughness).toBe(0.3)

    expect(firstMaterial.metalness).toBe(0.65)

    expect(secondMaterial.color.r).toBe(1)

    expect(firstMaterial).not.toBe(secondMaterial)

    expect(asMesh(template.children[0]).material).not.toBe(firstMaterial)
  })

  it('shares the geometry between boxes', () => {
    const template = makeTemplate()
    const first = createBoxInstance(template, look, true)
    const second = createBoxInstance(template, look, true)

    expect(asMesh(first.root.children[0].children[0]).geometry).toBe(asMesh(second.root.children[0].children[0]).geometry)
  })

  it('collects the lid and the wordmark to swing together, and the two glowing surfaces', () => {
    const instance = createBoxInstance(makeTemplate(), look, true)

    expect(instance.lidParts.map(part => part.name)).toEqual([EBoxPartName.Lid, EBoxPartName.Wordmark])

    expect(instance.glowMaterials).toHaveLength(2)
  })

  it('moves the model down by half the box height so the root is the middle of the box', () => {
    const instance = createBoxInstance(makeTemplate(), look, true)

    expect(instance.root.children[0].position.y).toBeCloseTo(-0.56)
  })

  it('switches shadows off when asked', () => {
    const instance = createBoxInstance(makeTemplate(), look, false)
    const base = asMesh(instance.root.children[0].children[0])

    expect(base.castShadow).toBe(false)
  })
})
