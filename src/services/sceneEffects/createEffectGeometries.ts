import { BufferGeometry, Float32BufferAttribute } from 'three'

// The three tiny meshes of the show around the box (docs/ANIMATIONS.md). They carry no texture: the soft edges are
// vertex alpha. Same shapes as the effect models of the other repositories.
//   disc   soft round glow, 1 unit across, facing +Z   (sparks, comets, dust, aura behind a box)
//   ring   thin soft ring, 1 unit across, facing +Z    (shock wave)
//   shaft  open cone, 1 unit high from y = 0, radius 0.5 -> 0.9, fading towards the top (light from the open box)
const SEGMENTS = 32

interface IRadialRing {
  radius: number
  alpha: number
}

const buildGeometry = (positions: number[], alphas: number[], indices: number[]): BufferGeometry => {
  const geometry = new BufferGeometry()
  const colors: number[] = []

  alphas.forEach(alpha => {
    colors.push(1, 1, 1, alpha)
  })

  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))

  geometry.setAttribute('color', new Float32BufferAttribute(colors, 4))

  geometry.setIndex(indices)

  return geometry
}

// Concentric rings of vertices; the first ring may have radius 0 (the centre).
const buildRadialGeometry = (rings: IRadialRing[]): BufferGeometry => {
  const positions: number[] = []
  const alphas: number[] = []
  const indices: number[] = []
  const ringStarts: number[] = []

  rings.forEach(ring => {
    ringStarts.push(positions.length / 3)

    if (ring.radius === 0) {
      positions.push(0, 0, 0)

      alphas.push(ring.alpha)

      return
    }

    for (let segment = 0; segment < SEGMENTS; segment += 1) {
      const angle = (segment / SEGMENTS) * Math.PI * 2

      positions.push(Math.cos(angle) * ring.radius, Math.sin(angle) * ring.radius, 0)

      alphas.push(ring.alpha)
    }
  })

  for (let ringIndex = 0; ringIndex < rings.length - 1; ringIndex += 1) {
    const inner = ringStarts[ringIndex]
    const outer = ringStarts[ringIndex + 1]

    for (let segment = 0; segment < SEGMENTS; segment += 1) {
      const next = (segment + 1) % SEGMENTS

      if (rings[ringIndex].radius === 0) {
        indices.push(inner, outer + segment, outer + next)
      } else {
        indices.push(inner + segment, outer + segment, outer + next, inner + segment, outer + next, inner + next)
      }
    }
  }

  return buildGeometry(positions, alphas, indices)
}

export const createDiscGeometry = (): BufferGeometry =>
  buildRadialGeometry([
    { radius: 0, alpha: 1 },
    { radius: 0.05, alpha: 0.93 },
    { radius: 0.1, alpha: 0.74 },
    { radius: 0.15, alpha: 0.5 },
    { radius: 0.2, alpha: 0.29 },
    { radius: 0.27, alpha: 0.1 },
    { radius: 0.35, alpha: 0.03 },
    { radius: 0.5, alpha: 0 },
  ])

export const createRingGeometry = (): BufferGeometry =>
  buildRadialGeometry([
    { radius: 0.36, alpha: 0 },
    { radius: 0.44, alpha: 0.9 },
    { radius: 0.5, alpha: 0 },
  ])

// Light rising out of the open box: a soft flat curtain facing the camera (it is fixed), 1 unit high from y = 0, 1 unit wide
// at the bottom and wider at the top. Horizontally the light is strongest along the two edges (it follows the walls of the box)
// with a gentler glow in the middle and nothing at the sides; vertically it is strongest at the box and fades away towards the
// watch. Every vertex carries its own alpha, so there is no hard edge anywhere.
const SHAFT_COLUMNS = 14
const SHAFT_ROWS = 12

const gauss = (value: number, centre: number, width: number): number => Math.exp(-(((value - centre) / width) ** 2))

const smooth = (edge0: number, edge1: number, value: number): number => {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)))

  return t * t * (3 - 2 * t)
}

const shaftAlpha = (across: number, up: number): number => {
  const horizontal = (0.55 * gauss(across, 0, 0.45) + 0.45 * (gauss(across, -0.7, 0.2) + gauss(across, 0.7, 0.2))) * (1 - Math.abs(across) ** 4)
  const vertical = (1 - up) ** 1.4 * smooth(0, 0.08, up)

  return 0.9 * horizontal * vertical
}

export const createShaftGeometry = (): BufferGeometry => {
  const positions: number[] = []
  const alphas: number[] = []
  const indices: number[] = []

  for (let row = 0; row <= SHAFT_ROWS; row += 1) {
    const up = row / SHAFT_ROWS

    for (let column = 0; column <= SHAFT_COLUMNS; column += 1) {
      const across = (column / SHAFT_COLUMNS) * 2 - 1

      positions.push(across * 0.5 * (1 + 0.7 * up), up, 0)

      alphas.push(shaftAlpha(across, up))
    }
  }

  for (let row = 0; row < SHAFT_ROWS; row += 1) {
    for (let column = 0; column < SHAFT_COLUMNS; column += 1) {
      const first = row * (SHAFT_COLUMNS + 1) + column
      const second = first + SHAFT_COLUMNS + 1

      indices.push(first, first + 1, second + 1, first, second + 1, second)
    }
  }

  return buildGeometry(positions, alphas, indices)
}

// A soft dark vignette: a grid over [-1, 1] x [-1, 1] whose alpha is 0 in the middle and darker towards the corners and the edges
// (black, alpha only). Drawn last over the whole view, inside the 3D scene: an image laid over the GL surface made Android
// composite every frame more slowly while the opening screen was up.
const VIGNETTE_COLUMNS = 16
const VIGNETTE_ROWS = 32
const VIGNETTE_STRENGTH = 0.55

export const createVignetteGeometry = (): BufferGeometry => {
  const positions: number[] = []
  const alphas: number[] = []
  const indices: number[] = []

  for (let row = 0; row <= VIGNETTE_ROWS; row += 1) {
    for (let column = 0; column <= VIGNETTE_COLUMNS; column += 1) {
      const x = (column / VIGNETTE_COLUMNS) * 2 - 1
      const y = (row / VIGNETTE_ROWS) * 2 - 1

      positions.push(x, y, 0)

      const t = Math.min(1, Math.max(0, (Math.hypot(x, y) - 0.55) / (1.35 - 0.55)))

      alphas.push(VIGNETTE_STRENGTH * t * t * (3 - 2 * t))
    }
  }

  for (let row = 0; row < VIGNETTE_ROWS; row += 1) {
    for (let column = 0; column < VIGNETTE_COLUMNS; column += 1) {
      const first = row * (VIGNETTE_COLUMNS + 1) + column
      const second = first + VIGNETTE_COLUMNS + 1

      indices.push(first, first + 1, second + 1, first, second + 1, second)
    }
  }

  const geometry = buildGeometry(positions, alphas, indices)
  const colors = geometry.getAttribute('color')

  // buildGeometry paints white; the vignette is black (only the alpha matters).
  for (let index = 0; index < colors.count; index += 1) {
    colors.setXYZ(index, 0, 0, 0)
  }

  return geometry
}
