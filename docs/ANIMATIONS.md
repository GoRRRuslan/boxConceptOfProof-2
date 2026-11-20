# Animations: what differs from the Filament version

All timings, easings, numbers and the gesture behaviour are the same code and the same config as in repo 1 (`src/flows/*/_config`, `_facadesLogic`). Screenshots of this version: `docs/media/android-*.png`. What differs:

| Area | Filament version | This version |
|---|---|---|
| Where the frame loop runs | worklet on the Filament render thread | R3F `useFrame` on the JS thread |
| Shared state | worklets `Synchronizable` | plain mutable cells (`createSharedValue`) |
| Render on demand | stop/start the choreographer (+ watchdog) | `frameloop` `always` ↔ `demand`, rest after a run of quick frames |
| Lid hinge | matrix about the pivot `[0, 0.914876, 0.359181]` | rotation + position from `computeLidHingeTransform` (same pivot, 0→115°) |
| Inner glow | `emissiveFactor` + bloom | emissive colour only, **no bloom** (the light does not bleed) |
| Lights | 3 directional lights in lux + IBL | 3 directional lights (key, rim, fill), intensities tuned by eye; reflection environment (PMREM RoomEnvironment) implemented but OFF (too slow in software GL, untested elsewhere) |
| Shadows | real shadows | implemented (key light, 1024 map) but OFF by default |
| Ambient occlusion, bloom | on | **not implemented** |
| Anti-aliasing | FXAA + dithering | native MSAA requested; canvas rendered at 0.5 of native resolution and stretched (`RENDER_RESOLUTION_SCALE`) because expo-gl always renders at native pixel density |
| Finish by price | material parameters | same values on per-box `MeshPhysicalMaterial` (roughness, metalness, clearcoat) |
| Model | Draco GLB | uncompressed GLB (Draco needs a WASM worker, not available in React Native) |
| Entrance | starts when the model is loaded | starts at the first frame with boxes |
| Splash | autohide | explicit `hide()` |
| Android release | minified | R8 minification off (it breaks expo-gl's GLView) |

Behaviour not re-verified here: auto-turn, inertia, pinch, double-tap reset, tilt, swipe-up open, anticipation shake (code is unchanged, not walked on a device in this session).
