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

iOS Simulator (iPhone 17), release build: **60 FPS in the list, in inspect, while the box is bought and opened, and at the reveal**, thanks to the *software-renderer profile* (below). Without the profile the Simulator manages 1.4 to 3.9 FPS (`main` before this work measured again: 1.4 FPS in inspect). It renders OpenGL ES on the CPU (Apple's software renderer), where every shaded pixel and every triangle costs time. Last full run with MSAA at render scale 0.25 (32 one-second windows, inspect, buy, open, reveal): 26 windows at 60, four in the first seconds after the start (25, 27, 46, 57 FPS: the first frames compile the shaders, about 1 s), two at the reveal (46 and 56 FPS, worst frame 72 ms). A real iPhone and the Android emulator do not use the profile; real-iPhone FPS is **not measured** (no signing set up on this Mac).

### The software-renderer profile (iOS Simulator only)

`IS_SOFTWARE_RENDERER = Platform.OS === 'ios' && !Device.isDevice` (`sceneRenderConfig.ts`). Only then these savings apply (`isSoftwareSaving`): MSAA on at render scale 0.25 (smooth edges, a little soft; 0.3 gives 45 to 50 FPS and 0.35 about 35; without MSAA 0.5 holds 60 FPS but the edges are stepped, `EXPO_PUBLIC_SOFT_AA=0`), a cheap colour output (`installCheapColorOutput`: the linear to sRGB conversion at the end of every fragment shader calls pow(), replaced by x^(7/16) from four square roots; it is what makes MSAA affordable), no clear coat, Lambert instead of PBR, one hemisphere light instead of three directional, no tone mapping, no shadows, no aura, no vignette, no dust, the parts that cannot be seen while the lid is closed are not drawn (the first box draws them for the first 3.5 s so their shaders compile before the first opening) and the inside of the box (the cushion alone is 15 000 triangles) is drawn unlit. The last two were the cause of the 100 ms frames at the opening: the lid opens and the cushion appears on the screen all at once. The light shaft, the shock waves and the sparks stay on. Findings that led here: `@react-three/fiber/native` always created the GL view with 4 MSAA samples whatever `gl.antialias` says (`patches/@react-three+fiber+9.8.2.patch`, applied by `patch-package` on install); with everything on, the cost is proportional to the number of shaded pixels, so render scale and PBR shading dominate. `EXPO_PUBLIC_SOFT_PROFILE=<comma list>` replaces the default list to measure the worth of each saving.

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

Marks come from `services/performance/startupTimeline.ts`. Render resolution does not move these marks.

| Platform | list visible | model loaded | first box frame |
|---|---|---|---|
| iOS Simulator | 28 ms | 756 ms | 764 ms |
| Android Emulator | 123 ms | 981 ms | 1 009 ms |

- GLB fetch: 20 ms (iOS) / 137 ms (Android); GLB parse: about 12 ms (iOS) / 33 ms (Android). Parsing is not the problem.
- With the PMREM environment switched on, the iOS Simulator needs 14.3 s for the first box frame: software GL compiles the environment shaders slowly.
- The first frame itself can take seconds on the simulator (shader compilation). The entrance animation starts on the first frame that has boxes (`resolveEntranceStart`), so the pop-in is always visible, and render on demand only rests after a run of quick frames.
- The model is preloaded at app start (`preloadBoxModel`).

## The show around the box: FPS with every effect on

Measured with the finished app and everything in [EFFECTS.md](EFFECTS.md) switched on, release builds, one platform at a time, with the in-app meter (`EXPO_PUBLIC_SHOW_PERFORMANCE=1`). Android: [`scripts/perf/measureAndroidFlow.sh`](../scripts/perf/measureAndroidFlow.sh) (16 s warm-up, 35 s of list flings, then select, turn, buy, open, reveal, Done). iOS: the list scrolls by itself (`EXPO_PUBLIC_AUTO_SCROLL=1`), the opening is driven by taps; the meter posts to a local collector (`EXPO_PUBLIC_PERF_SINK_URL`).

| Platform | Scenario | Result |
|---|---|---|
| Android Emulator (headless), release | Catalogue, 35 s of list flings | 60.0 FPS, 32 of 32 windows at 60 or more (lowest 59.9), 0 slow frames, worst frame 21.2 ms |
| Android Emulator (headless), release | Opening flow (select, turn, buy, open, reveal) | **Bistable.** In about half of the runs 59.8 FPS (11 of 12 windows at 59 or more, 3 slow frames); in the other half the opening locks at exactly 30 FPS from the moment the lid starts until Done. The same happens with the code from before all the effects (commit c967080), so it is not caused by them; resolution, shadow casting, the GPU sync interval and the effects themselves were switched off one by one and none of them removes it. CPU is idle during the locked runs; `dumpsys gfxinfo` shows frames of 17-19 ms (just over the 16.7 ms budget). Not solved. |
| iOS Simulator (iPhone 17), release | Catalogue, 60 s auto-scroll | 3.5 FPS: the Simulator draws OpenGL ES with Apple's CPU renderer (the app uses 160 % CPU); 60 FPS needs a real iPhone |
| iOS Simulator (iPhone 17), release | Opening flow, final code vs the code before all effects | 8.1 FPS vs 8.4 FPS (lowest windows 1.5 vs 1.4): the effects cost nothing measurable even when every pixel is rasterised on the CPU. **Not measured on a real iPhone** (no signing set up on this Mac). |

What it took to get here: (1) the vignette is drawn **inside** the 3D scene: laid over the GL surface as an image it made Android composite every frame more slowly while the opening screen was up and the opening dropped to 30-39 FPS; (2) shadows are rendered for the first 4 s (during the entrance) and then switched off until a box is inspected, so the shadow shaders are compiled early: the first selection no longer hitches for about 200 ms; (3) the effect meshes are drawn once, tiny and off screen, in the first 3.5 s so their shaders are compiled early.

The few slow frames left on Android are single frames (33-50 ms) at the moments when React mounts or unmounts a screen (selecting a box, the reveal, Done): the frame loop shares the main thread with the mount.
