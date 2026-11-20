# Test checklist and results

## Automated

| Check | Result |
|---|---|
| `yarn ciPipeline` (eslint + tsc) | clean |
| `yarn test` | 45 suites, 258 tests pass (domain, purchase, opening phase machine and pose maths, plus tests for createSharedValue, createBoxInstance, computeCameraFieldOfView, installGpuSync, resolveEntranceStart, RenderOnDemand) |
| Purchase exactly-once, failure paths | unit tests (`runBoxPurchase`, `PurchaseStore`, API tests); also walked on Android, see the failure rows below |

## Manual, release builds

Android Emulator MW_Pixel9_API_37 (host GPU) and iOS Simulator iPhone 17, both drawn with WebGPU (60 FPS on iOS; on Android 60 FPS with stretches of 30 FPS, see [PERFORMANCE.md](PERFORMANCE.md)). Screenshots from before the change to WebGPU were taken on expo-gl. Screenshots in `docs/media/` (`android-*`, `ios-*`).

| Case | Android | iOS |
|---|---|---|
| Catalogue with boxes (shown ~1 s / ~0.76 s after start) | ✅ `android-1-catalogue.png` | ✅ `ios-1-catalogue.png` |
| Scroll, boxes follow their cards | ✅ 60 FPS | ✅ but ~3 FPS |
| Tap card → inspect (box to the middle, Back, name and price) | ✅ `android-2-inspect.png` | ✅ |
| Drag turns the box | ✅ `android-2b-dragged.png` | ✅ on iOS after the change to WebGPU (it lagged by seconds on expo-gl) |
| Double tap resets | ✅ (adb taps) `android-2c-double-tap-reset.png` | not walked |
| Pinch zoom, device tilt | not walked (no multi-touch / sensor via adb) | not walked |
| Buy: balance $1,000 → $950 | ✅ `android-3-bought.png` | ✅ `ios-3-bought.png` |
| Anticipation shake, lid opens, inner light | ✅ `android-4a/4b/4c` | lid open seen in `ios-5-reveal.png` |
| Open with button / with swipe up | ✅ both (`android-4d-swipe-open.png`) | button ✅ |
| Reveal Common / Rare / Epic / Legendary | ✅ all four: `android-5-reveal-*.png` | Common ✅ |
| Box put away, Done at the bottom, tab bar hidden | ✅ | partly (3D lags) |
| Collection with the won watch and total value | ✅ `android-6-collection.png` | not walked |
| Not enough balance (Buy disabled with message) | ✅ `android-7-not-enough-balance.png` | not walked |
| Failure injection (network error, server error, lost response) | ✅ `android-8-failure-networkError.png`, `-serverError.png`, `-responseLost.png`, retry `android-8b-responseLost-retry.png` | not walked |
| Rapid double purchase: one charge, one watch | ✅ `android-9-rapid-double-purchase.png`, `android-9b-collection-after-double.png` | not walked |
| Real iPhone / real Android phone | not tested | not tested |

## Known gaps / visible defects

- No physical device was measured; the iOS flow was walked on the Simulator (WebGPU, 60 FPS) after the change from expo-gl.
- No ambient occlusion, no bloom.
- iOS renders at 0.37 of the native resolution with MSAA (Android: full resolution, MSAA off), so iOS edges are softer.
- The glow is an emissive colour only.


| The show around the box | iOS Simulator (WebGPU, 60 FPS) and Android 37 (emulator), release builds: seams, light curtain, shock waves, sparks, dust, camera punch, hold to open | ✅ looked at with screenshots ([docs/EFFECTS.md](EFFECTS.md)); Android through a whole opening on a quiet machine: 10 windows, 58 FPS on average, 48-60 per window (the two lowest are the startup) |
