# Performance

Honest numbers for the three.js + R3F + expo-gl version. Repo 1 (Filament) reference: **60.0 FPS, 0 slow frames** while scrolling on the iPhone 17 Simulator.

## Method

Release builds with `EXPO_PUBLIC_SHOW_PERFORMANCE=1` (overlay) and, on iOS, `EXPO_PUBLIC_PERF_SINK_URL` (collector `yarn perfSinkStart`). The meter counts R3F frames (`useFrame`) and reports once per second. After every frame the app reads one pixel back (`services/gpuSync`), so a frame is only counted when the GPU finished it. One platform at a time (see TESTING.md). Android: scrolled with `adb shell input swipe` (6 up/down sweeps), JS log from `adb logcat -s ReactNativeJS`.

## Results

| Platform | Scenario | FPS | Slow frames | Notes |
|---|---|---|---|---|
| Android Emulator MW_Pixel9_API_37, release | catalogue scrolling (8 sweeps) | **60.0** | 0 of ~60/s; `gfxinfo`: 1 janky frame of 670 (0.15 %), 90th percentile 18 ms | shadows not rendered in the list |
| Android | inspect, buy, anticipation, lid opening, reveal (shadows on) | **60.0** in every 1-second window | 0 | render scale 0.37 |
| Android | same at render scale 0.42 / 0.5 | 15 | most | fill-rate cliff of the emulator's GPU: large focused box |
| Android | shadows rendered in the list at scale 0.5 | 30 | ~half | the depth pass pushes frames over 16.7 ms |
| iOS Simulator iPhone 17, release | catalogue and inspect | **1.4 – 3.6** | all | **software OpenGL ES** (Apple's CPU renderer); not representative of a real iPhone |

**Verdict:** the 60 FPS target is met on the Android Emulator (release) in the list and through the whole inspect → open → reveal flow. It is **not met on the iOS Simulator**, where expo-gl runs on software OpenGL ES; on a physical iPhone it has not been measured. Repo 1 reference: 60.0 FPS, 0 slow frames.

Corrections to earlier numbers: an earlier run reported ~28 FPS on Android; it was taken while an iOS Simulator was also running (and before the render-scale and shadow changes) and must not be used. An even earlier JS-side counter showed "60 FPS" on iOS; it was wrong because expo-gl queues GL commands and JS runs ahead of the GPU. That is why `services/gpuSync` reads a pixel back after every frame: the meter now reports the real rate. `render()` itself costs ~1 ms of JS per frame; the limit is GPU fill rate.

What made 60 FPS possible: canvas rendered at 0.37 of native resolution (`RENDER_RESOLUTION_SCALE`), shadows only while a box is inspected (`SceneLighting`, the `shadows` flag is off in the list), shadow map 512, no reflection environment (it ran at 15 FPS and cost ~14 s of startup in software GL; flag `IS_ENVIRONMENT_ENABLED`).

Method: release builds with `EXPO_PUBLIC_SHOW_PERFORMANCE=1`; iOS numbers via the perf sink (`yarn perfSinkStart`), Android from `adb logcat -s ReactNativeJS` plus `adb shell dumpsys gfxinfo`. Scrolling by `adb shell input swipe`. One platform at a time, other simulator shut down (see TESTING.md).

## Startup (app start → list visible → model loaded → first frame with boxes)

Marks come from `services/performance/startupTimeline.ts`.

| Platform | list visible | model loaded | first box frame | Config |
|---|---|---|---|---|
| iOS Simulator | 28 ms | 756 ms | 764 ms | final config (environment off) |
| iOS Simulator | 18 ms | 14 282 ms | 14 292 ms | environment map ON (PMREM) |
| Android Emulator | 123 ms | 981 ms | 1 009 ms | final config (environment off) |

- GLB fetch: 20 ms (iOS) / 137 ms (Android); GLB parse: ~12 ms (iOS) / ~33 ms (Android). Parsing is not the problem.
- The **PMREM reflection environment cost ~13.5 s on the iOS Simulator** (software GL): it is therefore OFF (`IS_ENVIRONMENT_ENABLED`). Not measured on Android or a device.
- The first frame itself takes seconds on the simulator (shader compilation in software GL). The entrance animation starts on the first frame that has boxes, so the pop-in is visible, and render-on-demand only rests after a run of quick frames.
- Before: the list showed for a long time without boxes. Two causes were found: (1) a bug where the entrance start time was never assigned, so boxes stayed at scale 0 (fixed, `resolveEntranceStart` + test); (2) the PMREM environment. "Before" numbers for Android were not recorded.
- The model is preloaded at app start (`preloadBoxModel`).
