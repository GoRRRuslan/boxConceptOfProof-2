# Performance

Honest numbers for the three.js + React Three Fiber + expo-gl version: how they were taken, what they say and what they do not.

## Method

- **Release builds only** with `EXPO_PUBLIC_SHOW_PERFORMANCE=1` (FPS overlay). The list can scroll by itself with `EXPO_PUBLIC_AUTO_SCROLL=1` (`yarn androidRunCatalogueScroll`). On iOS the meter also posts to a collector (`EXPO_PUBLIC_PERF_SINK_URL`, `yarn perfSinkStart`).
- The meter counts R3F frames (`useFrame`) and reports once per second. After every frame the app reads one pixel back (`services/gpuSync`), so a frame is counted only when the GPU has finished it.
- Android: the JS log comes from `adb logcat -s ReactNativeJS` (one `[perf:android]` line per second); a second opinion from `adb shell dumpsys gfxinfo`. The inspect and opening flow are driven with `adb shell input tap` / `swipe` and read from the same log.
- One platform at a time, the other simulator shut down. Let a freshly booted emulator settle for about a minute before trusting a number (see [TESTING.md](TESTING.md)).
- A "slow frame" is longer than 25 ms.

## Results

Android Emulator MW_Pixel9_API_37, release build, final settings (render scale 1.0, MSAA off):

| Scenario | Result |
|---|---|
| Catalogue scrolling by itself, headless emulator, 39 s | 60 FPS in every window after the first (54 FPS); 1 slow frame (a 123 ms hitch in the first second) |
| Catalogue scrolling by itself, emulator window, 44 s | 60 FPS in every window after the first (53 FPS), worst frame 124 ms (first second) |
| Inspect a box, headless / window, 12 s | 60 FPS in every window, worst frame 20 ms / 22.5 ms |
| Buy, anticipation, lid, reveal, window | 60 FPS in every window, worst frame 25 ms |
| Same flow, headless | 52, 60, 59, 60, 60 FPS; one 154 ms hitch at the first lid opening |

iOS Simulator (iPhone 17), release build: **1.4 to 3.9 FPS** in the catalogue and in inspect. The simulator renders OpenGL ES in software (Apple's CPU renderer), so this is not representative of a real iPhone and the 60 FPS target is **not demonstrated on iOS**.

Not measured: any physical device, any Android GPU other than the emulator's.

## What the 60 FPS on Android depends on

| Setting | Where | Why |
|---|---|---|
| MSAA off on Android | `IS_ANTIALIASING_ENABLED` in `sceneRenderConfig.ts` | With 4x MSAA the emulator fell to 15 FPS in inspect at render scale 0.42 and 0.5. The cliff was MSAA, not the pixel count: at scale 0.5, 0.75 and 1.0 without MSAA every window held 60 FPS. |
| Full native resolution on Android | `RENDER_RESOLUTION_SCALE` | Edges are smooth and the wordmark is readable ([screenshot](media/android-2-inspect.png)). iOS keeps 0.37 with MSAA, because expo-gl renders at the native pixel density (3x) and the Simulator could not be used to test more. |
| Shadows only while a box is inspected or opened | `SceneLighting`, `shadows` flag of the canvas | Drawn in the list at render scale 0.5 they cost half of the frames (30 FPS): the depth pass pushes frames over 16.7 ms. |
| Shadow map 512 | `SHADOW_MAP_SIZE` | Enough for the lid and the lower edge. |
| No reflection environment | `IS_ENVIRONMENT_ENABLED = false` | The PMREM environment ran at 15 FPS and cost about 13.5 s at start in software GL. Not measured on Android or a device. |
| Render on demand | `components/RenderOnDemand` | `frameloop` is `always` only while something moves, so a still screen costs the GPU nothing. |
| GPU sync per frame | `services/gpuSync` | expo-gl queues GL commands and JavaScript runs ahead of the GPU; without the read-back the meter overstates the rate. `render()` itself costs about 1 ms of JavaScript per frame, so the limit is the GPU, not JavaScript. |

## Startup (app start to first frame with boxes)

Marks come from `services/performance/startupTimeline.ts`. Taken with the final scene settings before the Android resolution change; render resolution does not move these marks, but they were not repeated.

| Platform | list visible | model loaded | first box frame |
|---|---|---|---|
| iOS Simulator | 28 ms | 756 ms | 764 ms |
| Android Emulator | 123 ms | 981 ms | 1 009 ms |

- GLB fetch: 20 ms (iOS) / 137 ms (Android); GLB parse: about 12 ms (iOS) / 33 ms (Android). Parsing is not the problem.
- With the PMREM environment switched on, the iOS Simulator needed 14.3 s for the first box frame: software GL compiles the environment shaders slowly.
- The first frame itself can take seconds on the simulator (shader compilation). The entrance animation starts on the first frame that has boxes (`resolveEntranceStart`), so the pop-in is always visible, and render on demand only rests after a run of quick frames.
- The model is preloaded at app start (`preloadBoxModel`).

## Corrections to earlier numbers

- An early run reported about 28 FPS on Android. It was taken while an iOS Simulator was also running and must not be used.
- An early JavaScript-side counter showed 60 FPS on iOS. It was wrong: expo-gl queues GL commands, so JavaScript ran ahead of the GPU. The pixel read-back fixed the meter.
- The emulator window used to be recorded at about 22 FPS with the old setting (render scale 0.37 with MSAA). With MSAA off the window holds 60 FPS.
