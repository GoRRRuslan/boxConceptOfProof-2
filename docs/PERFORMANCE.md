# Performance

Honest numbers for the three.js + R3F + expo-gl version. Repo 1 (Filament) reference: **60.0 FPS, 0 slow frames** while scrolling on the iPhone 17 Simulator.

## Method

Release builds with `EXPO_PUBLIC_SHOW_PERFORMANCE=1` (overlay) and, on iOS, `EXPO_PUBLIC_PERF_SINK_URL` (collector `yarn perfSinkStart`). The meter counts R3F frames (`useFrame`) and reports once per second. After every frame the app reads one pixel back (`services/gpuSync`), so a frame is only counted when the GPU finished it. One platform at a time (see TESTING.md). Android: scrolled with `adb shell input swipe` (6 up/down sweeps), JS log from `adb logcat -s ReactNativeJS`.

## Results

| Platform | Scenario | FPS | Slow frames (>25 ms) | Notes |
|---|---|---|---|---|
| Android Emulator MW_Pixel9_API_37, release | catalogue scrolling | **24.6 – 34.7, typically 28 – 31** | 13 – 18 of ~30 per second | p95 frame 60 – 100 ms; `gfxinfo`: 47.7 % janky, 50th percentile 38 ms |
| Android, GPU sync off | catalogue scrolling | same range (25 – 35) | same | the sync is not the cost; the frame loop is CPU/JS bound |
| iOS Simulator iPhone 17, release | catalogue, boxes on screen, shadows on | ~1.6 | all | **software OpenGL ES** (Apple's CPU renderer), 633 ms/frame |
| iOS Simulator, release | same, shadows off | ~2.0 – 2.5 | all | still software GL; shadows are not the main cost |

**Verdict: the 60 FPS target was NOT reached.** Not measured: opening/reveal FPS, any physical device. The iOS numbers say little about a real iPhone (software GL), but they are the numbers that were measured. An earlier JS-side counter showed "60 FPS" on iOS; that was wrong because expo-gl queues GL commands and JS runs ahead of the GPU. This is why the GPU sync exists.

Where the Android time goes (not profiled in detail): per frame JS work is small (a few transforms), but three.js `render` walks about 5 visible boxes with several meshes each (MeshPhysicalMaterial), every GL call goes through expo-gl's JSI bridge on the JS thread, and scroll events also run on that thread. Ideas not done: fewer meshes/draw calls, MeshStandardMaterial instead of physical, lower render scale, `worklet` rendering (expo-gl supports it).

## Startup (app start → list visible → model loaded → first frame with boxes)

Marks come from `services/performance/startupTimeline.ts`.

| Platform | list visible | model loaded | first box frame | Config |
|---|---|---|---|---|
| iOS Simulator | 18 ms | 737 ms | 746 ms | environment map off, shadows on |
| iOS Simulator | 18 ms | 14 282 ms | 14 292 ms | environment map ON (PMREM) |
| Android Emulator | 123 ms | 981 ms | 1 009 ms | environment map off |

- GLB fetch: 20 ms (iOS) / 137 ms (Android); GLB parse: ~12 ms (iOS) / ~33 ms (Android). Parsing is not the problem.
- The **PMREM reflection environment cost ~13.5 s on the iOS Simulator** (software GL): it is therefore OFF (`IS_ENVIRONMENT_ENABLED`). Not measured on Android or a device.
- The first frame itself takes seconds on the simulator (shader compilation in software GL). The entrance animation starts on the first frame that has boxes, so the pop-in is visible, and render-on-demand only rests after a run of quick frames.
- Before: the list showed for a long time without boxes. Two causes were found: (1) a bug where the entrance start time was never assigned, so boxes stayed at scale 0 (fixed, `resolveEntranceStart` + test); (2) the PMREM environment. "Before" numbers for Android were not recorded.
- The model is preloaded at app start (`preloadBoxModel`).
