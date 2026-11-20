# Performance

Honest numbers for the three.js + R3F + expo-gl version. Repo 1 (Filament) reference: **60.0 FPS, 0 slow frames** while scrolling on the iPhone 17 Simulator.

## Method

Release builds with `EXPO_PUBLIC_SHOW_PERFORMANCE=1` (overlay) and, on iOS, `EXPO_PUBLIC_PERF_SINK_URL` (collector `yarn perfSinkStart`). The meter counts R3F frames (`useFrame`) and reports once per second. After every frame the app reads one pixel back (`services/gpuSync`), so a frame is only counted when the GPU finished it. One platform at a time (see TESTING.md). Android: scrolled with `adb shell input swipe` (6 up/down sweeps), JS log from `adb logcat -s ReactNativeJS`.

## Results

| Platform | Scenario | FPS | Slow frames | Notes |
|---|---|---|---|---|
| Android Emulator MW_Pixel9_API_37, release | catalogue scrolling (8 sweeps) | **60.0** | 0 of ~60/s; `gfxinfo`: 1 janky frame of 670 (0.15 %), 90th percentile 18 ms | shadows not rendered in the list |
| Android | inspect, buy, anticipation, lid opening, reveal (shadows on) | **60.0** in every 1-second window (one hitch of 154 ms at the first lid opening) | 0 | **render scale 1.0, MSAA off** (see "Full resolution on Android" below); headless and windowed emulator |
| Android | (old setting) same at render scale 0.42 / 0.5 **with MSAA** | 15 | most | the cliff was MSAA (4 samples), not the pixel count: see below |
| Android | shadows rendered in the list at scale 0.5 | 30 | ~half | the depth pass pushes frames over 16.7 ms |
| iOS Simulator iPhone 17, release | catalogue and inspect | **1.4 – 3.6** | all | **software OpenGL ES** (Apple's CPU renderer); not representative of a real iPhone |

**Verdict:** the 60 FPS target is met on the Android Emulator (release) in the list and through the whole inspect → open → reveal flow. It is **not met on the iOS Simulator**, where expo-gl runs on software OpenGL ES; on a physical iPhone it has not been measured. Repo 1 reference: 60.0 FPS, 0 slow frames.

Corrections to earlier numbers: an earlier run reported ~28 FPS on Android; it was taken while an iOS Simulator was also running (and before the render-scale and shadow changes) and must not be used. An even earlier JS-side counter showed "60 FPS" on iOS; it was wrong because expo-gl queues GL commands and JS runs ahead of the GPU. That is why `services/gpuSync` reads a pixel back after every frame: the meter now reports the real rate. `render()` itself costs ~1 ms of JS per frame; the limit is GPU fill rate.

What made 60 FPS possible (Android, current): MSAA off and the canvas at full native resolution (`RENDER_RESOLUTION_SCALE`, `IS_ANTIALIASING_ENABLED` in `sceneRenderConfig.ts`), shadows only while a box is inspected (`SceneLighting`, the `shadows` flag is off in the list), shadow map 512, no reflection environment (it ran at 15 FPS and cost ~14 s of startup in software GL; flag `IS_ENVIRONMENT_ENABLED`). The first rounds used render scale 0.37 with MSAA, which is still the iOS setting.

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

## Look tuning experiments (Android Emulator, headless) — not adopted

Goal: look closer to repo 1 (more saturated, softer highlights) without losing 60 FPS. Results (screenshots in `docs/media/look-experiments/`):

- **Windowed vs headless emulator (old setting, 0.37 + MSAA):** the same build ran at ~22 FPS in a visible emulator window and at 60 FPS with `emulator -no-window`. With the current Android setting this gap is gone (next section).
- `NeutralToneMapping` (instead of ACES) gives clearly more vivid, repo-1-like colours (`look-h2-catalogue.png`), but in these runs the emulator dropped to 30 FPS scrolling / 15 FPS in inspect.
- A 4th light (ambient or hemisphere), dropping the clear coat (standard instead of physical body material), and larger shadow bias were each tried; every build that contained them ran at 30/15 FPS, and the committed code ran at 60 FPS in the runs taken right before and after. I could not isolate a single cause: the emulator's GPU behaves bistably (frames either fit in 16.7 ms or fall to 33/66 ms) and a small change in shader cost flips it, so these changes were **reverted**. Treat 60 FPS on the emulator as "at the limit".
- Higher render scale (0.42–0.5) with MSAA: 15 FPS in inspect (see above). No FXAA/post-processing was tried.
- Not done: matching light intensities to repo 1 side by side, softening the specular, fixing the shadow acne in the inspect view (acne is visible at bias −0.0004 / normalBias 0.012; shadows are only drawn while inspecting).

So the known visual gaps versus repo 1 (before the full-resolution change below) were: jagged edges (render scale 0.37), darker/less saturated colours (ACES, no environment light), a harder white highlight on glossy boxes in the iOS Simulator, shadow acne when inspecting. After the change, Android edges are no longer jagged; the colour and iOS notes remain.


## Full resolution on Android (2026-11-20)

Question: can the Android emulator hold 60 FPS without the 0.37 render scale? Yes, once MSAA is off. The earlier 15 FPS at scale 0.42 / 0.5 was measured **with** MSAA (4 samples), so the fill-rate cliff was MSAA, not the pixel count.

Measured on the release build (overlay and in-app meter, `adb logcat -s ReactNativeJS`), box inspected, after the first frames:

| Render scale | MSAA | Inspect (12 s) |
|---|---|---|
| 0.37 | on | 60 FPS in every window |
| 0.5 | off | 60 FPS in every window |
| 0.75 | off | 60 FPS in every window |
| **1.0** | **off** | **60 FPS in every window, worst frame 20 ms (headless)** |

Final setting (scale 1.0, MSAA off), release build:

- Catalogue auto-scroll, headless, 39 s: 60 FPS in every window after the first (54), 1 slow frame (a 123 ms hitch in the first second).
- Catalogue auto-scroll, emulator **window**, 44 s: 60 FPS in every window after the first (53), worst frame 124 ms (first second).
- Inspect, emulator window, 12 s: 60 FPS in every window, worst frame 22.5 ms.
- Buy, open, lid, reveal, emulator window: 60 FPS in every window, worst frame 25 ms.
- Headless run of the same flow: 52, 60, 59, 60, 60 with one 154 ms hitch (the first lid opening).

Picture: edges are smooth and the wordmark is readable ([android-inspect-full-resolution.png](media/android-inspect-full-resolution.png)); the old render at 0.37 had visibly stair-stepped edges. The windowed emulator now holds 60 FPS too (the old gap, ~22 FPS, was the MSAA setting).

Limits: emulator only. iOS keeps scale 0.37 with MSAA: the iOS Simulator renders with software OpenGL (1.4 to 3.9 FPS), so a change there cannot be measured. Whether a real phone holds 60 FPS at full resolution without MSAA is not known.
