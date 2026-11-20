# Test checklist and results

## Automated

| Check | Result |
|---|---|
| `yarn ciPipeline` (eslint + tsc) | clean |
| `yarn test` | 44+ suites, 258 tests pass (ported from repo 1, plus new tests for createSharedValue, createBoxInstance, computeCameraFieldOfView, installGpuSync, resolveEntranceStart, RenderOnDemand) |
| Purchase exactly-once, failure paths | covered by the unit tests ported from repo 1 (`runBoxPurchase`, `PurchaseStore`, API tests) — not re-checked by hand on a device |

## Manual, release builds

Android Emulator MW_Pixel9_API_37 (60 FPS) and iOS Simulator iPhone 17 (software GL, 1–3 FPS). Screenshots in `docs/media/` (`android-*`, `ios-*`).

| Case | Android | iOS |
|---|---|---|
| Catalogue with boxes (shown ~1 s / ~0.76 s after start) | ✅ `android-1-catalogue.png` | ✅ `ios-1-catalogue.png` |
| Scroll, boxes follow their cards | ✅ 60 FPS | ✅ but ~3 FPS |
| Tap card → inspect (box to the middle, Back, name and price) | ✅ `android-2-inspect.png` | ✅ |
| Drag turns the box | ✅ `android-2b-dragged.png` | tried (`ios-2-inspect-dragged.png`), not judgeable: the simulator's 3D view lags the UI by seconds (software GL) |
| Double tap resets | ✅ (adb taps) `android-2c-double-tap-reset.png` | not walked |
| Pinch zoom, device tilt | not walked (no multi-touch / sensor via adb) | not walked |
| Buy: balance $1,000 → $950 | ✅ `android-3-bought.png` | ✅ `ios-3-bought.png` |
| Anticipation shake, lid opens, inner light | ✅ `android-4a/4b/4c` | lid open seen in `ios-5-reveal.png` |
| Open with button / with swipe up | ✅ both (`android-4d-swipe-open.png`) | button ✅ |
| Reveal Common / Rare / Epic / Legendary | ✅ all four: `android-5-reveal-*.png` | Common ✅ |
| Box put away, Done at the bottom, tab bar hidden | ✅ | partly (3D lags) |
| Collection with the won watch and total value | ✅ `android-6-collection.png` | not walked |
| Not enough balance (Buy disabled with message) | ✅ `android-7-not-enough-balance.png` | not walked |
| Failure injection (mock API error) and rapid double purchase on device | not walked; covered by unit tests (`runBoxPurchase`, `PurchaseStore`, API) | not walked |
| Real iPhone / real Android phone | not tested | not tested |

## Bugs found and fixed

- `three` CJS entry crashed at startup (`process.emitWarning`): Metro alias to `three.module.js`.
- Splash screen never hid: explicit `hide()`.
- R8 minification stripped expo-gl's `GLView` constructor in Android release: `enableMinifyInReleaseBuilds: false`.
- Entrance start time never assigned (boxes invisible): fixed with a tested pure function.
- JS-side FPS overstated GPU rate: GPU sync after every frame.
- Frame loop froze on its first frame when shader compilation stalled: render-on-demand now counts quick frames.

## Known gaps / visible defects

- iOS Simulator is far below 60 FPS because of its software GL (not measurable on a device here); the iOS flow was only partly walked.
- No AO, no bloom; no reflection environment (flag, too slow in software GL and on the emulator); shadows only while a box is inspected.
- (Before the full-resolution change, see PERFORMANCE.md.) Low render resolution (0.37) made edges soft and the open lid showed thin dashed edges (`android-4c-lid-open-glow.png`); a polygon offset on the body did not remove them. Android now renders at full resolution without MSAA.
- The glow is an emissive colour only.
