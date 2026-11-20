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
export const ENVIRONMENT_INTENSITY = 0.12

// Real shadows: the lid shades the inside of the box, the box shades its own lower edge.
export const SHADOW_MAP_SIZE = 2048
export const SHADOW_FRUSTUM_HALF_SIZE = 3.4
export const SHADOW_BIAS = -0.002
export const SHADOW_NORMAL_BIAS = 0.06

// Renderer settings.
export const TONE_MAPPING_EXPOSURE = 1.05
// MSAA (4 samples): cheap on a GPU, so on everywhere. With expo-gl (OpenGL ES) it had to be switched off on Android and the iOS Simulator.
export const IS_ANTIALIASING_ENABLED = true

// Feature switches (documented in docs/ANIMATIONS.md).
export const IS_ENVIRONMENT_ENABLED = true
export const IS_SHADOWS_ENABLED = true

// The scene is drawn by WebGPU (Metal on iOS, Vulkan on Android) at the screen's full native resolution: no render scale is needed.
// With expo-gl (OpenGL ES) the view had to be rendered at 0.37 of the native size on iOS to get anywhere near 60 FPS.
export const RENDER_RESOLUTION_SCALE = 1

// The list is shown (and the loader taken away) only when the scene is really ready: the model is loaded, every box has popped in,
// the effects have been warmed up (their pipelines compiled), this many frames have been drawn and the picture has settled for a moment.
// Without this the loader ended while the tiles were still empty, and the first scroll right after it rattled.
export const SCENE_READY_MINIMUM_FRAMES = 45
export const SCENE_READY_SETTLE_MILLISECONDS = 400
// Never wait longer than this for the scene (a failed model load must not keep the loader forever).
export const SCENE_READY_TIMEOUT_MILLISECONDS = 8000
export const SCENE_READY_POLL_MILLISECONDS = 100

// After the last activity (scroll, finger, animation) the renderer keeps drawing this long before it rests. Resting after 0.7 s made every
// scroll that began after a short pause start the renderer again, and its first frames take 130 to 570 ms on a device: the list moved while
// the boxes stood still and then jumped. A longer hold means a restart only after a real pause. (The cap is the safety limit.)
export const IDLE_RENDER_HOLD_MILLISECONDS = 12_000
export const IDLE_RENDER_MAXIMUM_MILLISECONDS = 20_000
