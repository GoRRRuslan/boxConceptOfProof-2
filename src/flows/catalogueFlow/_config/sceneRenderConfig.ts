// How the shared 3D view is rendered (the same on iOS and Android).

// Colour of a light as seen by the eye: "5600 K" daylight-ish warm white, "9000 K" cool blue-white...
// (three.js lights take an RGB colour, not a Kelvin value, so the Kelvin values of the Filament
// version were converted once to sRGB hex).
export interface ISceneLight {
  intensity: number
  colorHex: string
  // Where the light stands (it looks at the origin). The camera sits at +Z looking along -Z at boxes whose fronts face +Z.
  position: [number, number, number]
  castShadows: boolean
}

// A three-point-ish rig: a warm key light from the upper left in front, a cool rim light from behind on
// the right (bright edges that separate the box from the dark background), and a soft fill from below.
// Positions are the Filament light directions negated (Filament gives the direction the light travels in).
export const SCENE_LIGHTS: ISceneLight[] = [
  { intensity: 2.6, colorHex: '#FFE9D2', position: [-4.5, 7.5, 5.5], castShadows: true },
  { intensity: 1.5, colorHex: '#CFDFFF', position: [6.5, 2.5, -7], castShadows: false },
  { intensity: 0.5, colorHex: '#FFF3E8', position: [2, -9, 4], castShadows: false },
]

// Reflections of the environment (what makes glossy and metallic boxes look glossy and metallic).
// A procedurally built "room" (three.js RoomEnvironment) filtered once into a PMREM cube map.
export const ENVIRONMENT_INTENSITY = 0.55

// Real shadows: the lid shades the inside of the box, the box shades its own lower edge.
export const SHADOW_MAP_SIZE = 1024
export const SHADOW_FRUSTUM_HALF_SIZE = 3.4
export const SHADOW_BIAS = -0.0004
export const SHADOW_NORMAL_BIAS = 0.012

// Renderer settings.
export const TONE_MAPPING_EXPOSURE = 1.05
// MSAA samples are requested from expo-gl (4 samples, "antialias: true" on the Canvas).
export const IS_ANTIALIASING_ENABLED = true
