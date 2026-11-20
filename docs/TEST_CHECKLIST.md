# Test checklist and results

## Automated

| Check | Result |
|---|---|
| `yarn ciPipeline` (eslint + tsc) | clean |
| `yarn test` | 44+ suites, 258 tests pass (ported from repo 1, plus new tests for createSharedValue, createBoxInstance, computeCameraFieldOfView, installGpuSync, resolveEntranceStart, RenderOnDemand) |
| Purchase exactly-once, failure paths | covered by the unit tests ported from repo 1 (`runBoxPurchase`, `PurchaseStore`, API tests) — not re-checked by hand on a device |

## Manual, release builds

| Case | Android Emulator (MW_Pixel9_API_37) | iOS Simulator (iPhone 17) |
|---|---|---|
| App starts, catalogue with boxes | ✅ (boxes after ~1 s) | ✅ (boxes after ~0.75 s; very slow rendering, software GL) |
| Scroll | ✅ but ~28 FPS | ⚠️ ~2 FPS (software GL) |
| Tap card → inspect (box flies to the middle, Back, name/price) | ✅ | not walked |
| Buy → balance $1,000 → $950 | ✅ | not walked |
| Open (button) → lid opens, reveal overlay (pill, circles, watch, price) | ✅ screenshots in docs/media | not walked |
| Box put away, Done appears, tab bar hidden during reveal | ✅ | not walked |
| Collection shows the watch and total | ✅ | not walked |
| Drag/pinch/double tap, swipe-up open, tilt, anticipation shake detail | not walked | not walked |
| Failure case and rapid double purchase on device | not walked (unit tests only) | not walked |

Screenshots: `docs/media/android-*.png`.

## Bugs found and fixed

- `three` CJS entry crashed at startup (`process.emitWarning`): Metro alias to `three.module.js`.
- Splash screen never hid: explicit `hide()`.
- R8 minification stripped expo-gl's `GLView` constructor in Android release: `enableMinifyInReleaseBuilds: false`.
- Entrance start time never assigned (boxes invisible): fixed with a tested pure function.
- JS-side FPS overstated GPU rate: GPU sync after every frame.
- Frame loop froze on its first frame when shader compilation stalled: render-on-demand now counts quick frames.

## Known gaps / visible defects

- Not 60 FPS (see PERFORMANCE.md). iOS flow beyond the catalogue not walked.
- No AO, no bloom; no reflection environment and no shadows by default (flags exist).
- Aliasing: render scale 0.5 and no MSAA effect visible on Android; thin dashed edges on the open lid (inner/outer surfaces fighting) are visible in `android-4-opening.png`.
- The glow is an emissive colour only.
