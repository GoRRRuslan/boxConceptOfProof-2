import { BOX_CENTER_HEIGHT_UNITS } from '@flows/catalogueFlow/_config/catalogueLayoutConfig'
import { isSoftwareSaving } from '@flows/catalogueFlow/_config/sceneRenderConfig'
import { Group, type Material, Mesh, MeshLambertMaterial, MeshPhysicalMaterial, MeshStandardMaterial, type Object3D } from 'three'

// Parts of the model (docs/MODEL.md). They are the five top-level nodes of the GLB scene; their node
// names get a numeric suffix from GLTFLoader when a mesh and a node share a name, so match by prefix.
export enum EBoxPartName {
  Base = 'Shell_Base',
  Lid = 'Shell_Lid',
  Wordmark = 'Shell_Wordmark',
  Cushion = 'Shell_Fitted_Cushion',
  Seam = 'Shell_Seam',
}

export interface IBoxLook {
  // Linear RGB, each channel 0..1.
  color: [number, number, number]
  roughness: number
  metallic: number
  clearCoat: number
}

export interface IBoxInstance {
  // Moved, turned and scaled every frame (position = box centre).
  root: Group
  // The lid and its wordmark: they swing about the hinge pivot together.
  lidParts: Object3D[]
  // Materials that carry the light from inside the opened box (cushion and inner side of the lid).
  glowMaterials: MeshStandardMaterial[]
  // The coloured trim of the seam: it lights up when the box is armed and while it opens.
  seamMaterials: MeshStandardMaterial[]
  // The outer body (base and lid): its colour shimmers on the glossy boxes (iridescence).
  bodyMaterials: MeshPhysicalMaterial[]
  // Parts that can only be seen when the lid is open (the cushion, the inside of the lid, the lining of the seam).
  innerParts: Object3D[]
}

// The mesh of every primitive of a part: a one-primitive part is a Mesh, a part with several
// primitives is a Group of Meshes in primitive order.
const getPrimitiveMeshes = (part: Object3D): Mesh[] =>
  part instanceof Mesh ? [part] : part.children.filter((child): child is Mesh => child instanceof Mesh)

const findPart = (model: Object3D, partName: EBoxPartName): Object3D | undefined =>
  model.children.find(child => child.name.startsWith(partName))

// A glTF "standard" material turned into a physical one, so the clear coat can be set per box.
const toPhysicalMaterial = (source: Material): MeshPhysicalMaterial => {
  if (source instanceof MeshPhysicalMaterial) {
    return source.clone()
  }

  const physicalMaterial = new MeshPhysicalMaterial()

  MeshStandardMaterial.prototype.copy.call(physicalMaterial, source)

  return physicalMaterial
}

const SHADOW_CASTING_PARTS: EBoxPartName[] = [EBoxPartName.Base, EBoxPartName.Lid]

// Indices of the primitives used for the body look (outer surface) and for the inner glow.
interface IPrimitiveTarget {
  partName: EBoxPartName
  primitiveIndex: number
}

const BODY_TARGETS: IPrimitiveTarget[] = [
  { partName: EBoxPartName.Base, primitiveIndex: 0 },
  { partName: EBoxPartName.Lid, primitiveIndex: 0 },
]
const SEAM_TARGETS: IPrimitiveTarget[] = [{ partName: EBoxPartName.Seam, primitiveIndex: 0 }]
const GLOW_TARGETS: IPrimitiveTarget[] = [
  { partName: EBoxPartName.Cushion, primitiveIndex: 0 },
  { partName: EBoxPartName.Lid, primitiveIndex: 1 },
]

// One box for one card: a clone of the loaded model (geometries and untouched materials are shared,
// so 64 boxes cost 64 transforms, not 64 copies) whose body and glow materials are its own.
export const createBoxInstance = (template: Object3D, look: IBoxLook, castShadows: boolean): IBoxInstance => {
  const model = template.clone(true)
  const root = new Group()
  const glowMaterials: MeshStandardMaterial[] = []
  const seamMaterials: MeshStandardMaterial[] = []
  const bodyMaterials: MeshPhysicalMaterial[] = []
  const innerParts: Object3D[] = []

  for (const { partName, primitiveIndex } of BODY_TARGETS) {
    const part = findPart(model, partName)
    const mesh = part ? getPrimitiveMeshes(part)[primitiveIndex] : undefined

    if (!mesh) {
      continue
    }

    const material = toPhysicalMaterial(mesh.material as Material)

    material.color.setRGB(look.color[0], look.color[1], look.color[2])

    material.roughness = look.roughness

    material.metalness = look.metallic

    material.clearcoat = isSoftwareSaving('noClearcoat') ? 0 : look.clearCoat

    // The thin rim of the lid, the outer and the inner surfaces nearly coincide: pull the outer one
    // slightly towards the camera so the two do not fight (dashed edges otherwise).
    material.polygonOffset = true

    material.polygonOffsetFactor = -1

    material.polygonOffsetUnits = -1

    if (isSoftwareSaving('lambertMaterial')) {
      const lambert = new MeshLambertMaterial({ color: material.color, map: material.map })

      mesh.material = lambert

      bodyMaterials.push(lambert as unknown as MeshPhysicalMaterial)

      continue
    }

    mesh.material = material

    bodyMaterials.push(material)
  }

  for (const { partName, primitiveIndex } of GLOW_TARGETS) {
    const part = findPart(model, partName)
    const mesh = part ? getPrimitiveMeshes(part)[primitiveIndex] : undefined

    if (!mesh) {
      continue
    }

    const material = (mesh.material as MeshStandardMaterial).clone()

    mesh.material = material

    glowMaterials.push(material)
  }

  for (const { partName, primitiveIndex } of SEAM_TARGETS) {
    const part = findPart(model, partName)
    const mesh = part ? getPrimitiveMeshes(part)[primitiveIndex] : undefined

    if (!mesh) {
      continue
    }

    const material = (mesh.material as MeshStandardMaterial).clone()

    mesh.material = material

    seamMaterials.push(material)
  }

  // Only the outer shells (base and lid) cast shadows: the cushion alone is 15 000 of the 33 000 triangles of the model, and its shadow
  // (inside the box, under the lid) cannot be told apart. Every part still receives shadows. This takes more than half of the work
  // out of the shadow pass.
  model.children.forEach(part => {
    const castsShadow = castShadows && SHADOW_CASTING_PARTS.some(partName => part.name.startsWith(partName))

    part.traverse(object => {
      object.castShadow = castsShadow

      object.receiveShadow = castShadows
    })
  })

  // The model's base rests at Y = 0: shift it so that the group's origin is the middle of the box.
  model.position.set(0, -BOX_CENTER_HEIGHT_UNITS, 0)

  root.add(model)

  const lidParts = [EBoxPartName.Lid, EBoxPartName.Wordmark].flatMap(partName => {
    const part = findPart(model, partName)

    return part ? [part] : []
  })

  const cushion = findPart(model, EBoxPartName.Cushion)
  const lidPart = findPart(model, EBoxPartName.Lid)
  const seamPart = findPart(model, EBoxPartName.Seam)

  if (cushion) innerParts.push(cushion)

  if (lidPart) {
    const [, inner] = getPrimitiveMeshes(lidPart)

    if (inner) innerParts.push(inner)
  }

  if (seamPart) {
    const [, lining] = getPrimitiveMeshes(seamPart)

    if (lining) innerParts.push(lining)
  }

  return { root, lidParts, glowMaterials, seamMaterials, bodyMaterials, innerParts }
}
