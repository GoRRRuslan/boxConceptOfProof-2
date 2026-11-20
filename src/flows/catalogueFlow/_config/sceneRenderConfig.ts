import { isDevice } from 'expo-device'
import { Platform } from 'react-native'

// The iOS Simulator renders OpenGL ES on the CPU (Apple's software renderer): every shaded pixel costs real time, so the scene is made
// cheaper there (see the savings below). A real iPhone and the Android emulator (host GPU) keep the full look.
export const IS_SOFTWARE_RENDERER = Platform.OS === 'ios' && !isDevice

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
export const ENVIRONMENT_INTENSITY = 0.25

// Real shadows: the lid shades the inside of the box, the box shades its own lower edge.
export const SHADOW_MAP_SIZE = 512
export const SHADOW_FRUSTUM_HALF_SIZE = 3.4
export const SHADOW_BIAS = -0.0004
export const SHADOW_NORMAL_BIAS = 0.012

// Renderer settings.
export const TONE_MAPPING_EXPOSURE = 1.05
// MSAA samples are requested from expo-gl (4 samples, "antialias: true" on the Canvas). Off on Android: with MSAA the
// emulator fell to 15 FPS at render scale 0.5; without it the full native resolution holds 60 FPS (docs/PERFORMANCE.md).
export const IS_ANTIALIASING_ENABLED = Platform.OS !== 'android' && !(IS_SOFTWARE_RENDERER && process.env.EXPO_PUBLIC_SOFT_AA === '0')

// Feature switches (documented in docs/ANIMATIONS.md; used to find what a GL driver cannot take).
export const IS_ENVIRONMENT_ENABLED = false
export const IS_SHADOWS_ENABLED = true
// Shadows are rendered for this long right after the app starts (while the boxes pop in) and then switched off until a box is inspected:
// the shader programs of the shadow variant are compiled during the entrance instead of as a hitch of about 200 ms when the first box
// is selected (three.js keeps compiled programs).
export const SHADOW_WARMUP_MILLISECONDS = 4000

// The GL view is rendered at this fraction of the screen's native pixel size and scaled up by the
// compositor. expo-gl always renders at the full native resolution (3x on an iPhone), which a
// JS-driven scene with real-time shadows cannot fill at 60 FPS (not verified on a real iPhone: the iOS Simulator
// uses software GL). Android renders at full native resolution (1): without MSAA it holds 60 FPS.

// Savings applied on the software renderer only.

export type SoftwareSaving =
  | 'lowResolution'
  | 'noClearcoat'
  | 'hideInnerParts'
  | 'unlitInner'
  | 'lambertMaterial'
  | 'noAura'
  | 'noVignette'
  | 'oneLight'
  | 'noToneMapping'
  | 'cheapColorOutput'
  | 'noShadows'
  | 'noDust'
  | 'noShaft'
  | 'noRings'
  | 'noSparks'

const DEFAULT_SOFTWARE_SAVINGS = 'lowResolution,noClearcoat,hideInnerParts,unlitInner,lambertMaterial,noAura,noVignette,oneLight,noToneMapping,cheapColorOutput,noShadows,noDust'
// EXPO_PUBLIC_SOFT_PROFILE (a comma-separated list) replaces the default list: used to measure what each saving is worth.
const savingsList: string = process.env.EXPO_PUBLIC_SOFT_PROFILE ?? DEFAULT_SOFTWARE_SAVINGS
const SOFTWARE_SAVINGS = savingsList.split(',').filter(Boolean)

export const isSoftwareSaving = (saving: SoftwareSaving): boolean => IS_SOFTWARE_RENDERER && SOFTWARE_SAVINGS.includes(saving)

// The inner parts are drawn this long after the start so that their shader programs are compiled.
export const SOFTWARE_INNER_WARM_UP_MILLISECONDS = 3500
// Render scale on the software renderer, with MSAA on: 0.25 holds 60 FPS with smooth (a little soft) edges, 0.3 drops to 45-50 FPS, 0.35 to about 35. Without MSAA (EXPO_PUBLIC_SOFT_AA=0) 0.5 holds 60 FPS but the edges are stepped. EXPO_PUBLIC_SOFT_SCALE overrides the scale for measuring.
const SOFTWARE_RENDER_RESOLUTION_SCALE = Number(process.env.EXPO_PUBLIC_SOFT_SCALE ?? 0.25)

export const RENDER_RESOLUTION_SCALE = Platform.OS === 'android' ? 1 : isSoftwareSaving('lowResolution') ? SOFTWARE_RENDER_RESOLUTION_SCALE : 0.37

// A GPU sync point (a one-pixel read-back) after every Nth frame: back-pressure for the JS frame loop,
// see services/gpuSync/installGpuSync.ts. 0 = never.
export const GPU_SYNC_INTERVAL_FRAMES = 1
