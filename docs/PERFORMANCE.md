# Performance

Honest numbers for the three.js + React Three Fiber version, drawn with WebGPU (`react-native-webgpu`): how they were taken, what they say and what they do not. The comparison with the other two repositories and the reasons for the choice of renderer: [RENDERING_REPORT.md](RENDERING_REPORT.md).

## Method

- **Release builds only** with `EXPO_PUBLIC_SHOW_PERFORMANCE=1` (FPS overlay). On iOS the meter also posts to a collector (`EXPO_PUBLIC_PERF_SINK_URL`, `yarn perfSinkStart`); on Android the line `[perf:android]` goes to `adb logcat`.
- The meter counts R3F frames (`useFrame`) and reports once per second ("window"). A slow frame is longer than 25 ms.
- Flow walked in every run: list, inspect a box, buy, open (lid, light, sparks), reveal. Taps driven through the simulator / `adb input`.
- One platform at a time, the other shut down. The Android Emulator must run with the **host GPU** (`emulator -avd <name> -gpu host`); its default mode is SwiftShader, a CPU renderer.
- Raw logs: [data/fps-ios-webgpu.log](data/fps-ios-webgpu.log), [data/fps-android-webgpu.log](data/fps-android-webgpu.log).

## Results

| Platform (release) | Result |
|---|---|
| iOS Simulator (iPhone 17), Metal | 36 windows, average **59.8** FPS. One window of 52 FPS at app start (first frames compile the pipelines, about 1 s). Nothing else below 59 FPS in the list, inspect, buy, open and reveal. |
| Android Emulator (Pixel 9 API 37, host GPU), Vulkan | **60 FPS** in the catalogue and in inspect. Stretches of **30 FPS** (alternating one-second windows of 60 and 30) during the entrance and parts of the opening; average over a run 55 to 58 FPS. First run, a better one: 24 windows, one of 58 FPS. |
| Android Emulator, default SwiftShader mode | 10 to 30 FPS: a CPU renderer, not representative. |

Not measured: any physical device. The Mac's GPU is much faster than a phone's.

### Why the Android stretches of 30 FPS

The time is not in the GPU (it is the host's GPU, and inspect with the same scene is at 60). The frame loop is JavaScript: three.js builds and encodes the frame and about 46 effect objects are updated every frame. On the emulator the JavaScript thread sometimes needs a little more than 16.7 ms and the frames then fall into every second vsync until the load drops. The other two repositories do this work natively and do not show it. The way out would be to move the per-frame maths to a worklet or a native module. The Android backing view `HardwareBufferView` was tried and was worse.

## What the numbers depend on

| Choice | Where | Effect |
|---|---|---|
| WebGPU instead of expo-gl | `components/WebGpuCanvas` | Metal / Vulkan instead of OpenGL ES. The iOS Simulator went from 1.4 FPS to 60 FPS with a better picture. [RENDERING_REPORT.md](RENDERING_REPORT.md) |
| Native resolution, 4x MSAA | `sceneRenderConfig.ts` | Smooth edges on both platforms. With expo-gl: 0.25 to 0.37 render scale on iOS, no MSAA on Android. |
| Shadows always on, 2048 map | `CatalogueScene.tsx`, `sceneRenderConfig.ts` | Switching shadows on and off recompiled every material (stall of about 1 s). A shadow bias of -0.002 and a normal bias of 0.06 remove the acne on WebGPU. |
| Reflection environment on (intensity 0.12) | `useFacadeSceneLighting.ts` | Glossy and metallic boxes reflect a room; 0.25 washed the colours out. |
| Sounds prepared at idle | `soundEffects.prepare` | The first sound used to block JavaScript for about a second (it looked like a graphics stall at the first inspect). |
| Render on demand | `components/RenderOnDemand` | The GPU rests on a still screen. |
| Effects warm-up | `applySceneEffects.ts` | Hidden effect objects are drawn tiny for the first 3.5 s so their pipelines exist before the first opening. |

## Startup (app start to first frame with boxes)

| Platform | List visible | Model loaded | First frame with boxes |
|---|---|---|---|
| iOS Simulator | 18 ms | 765 ms | 767 ms |

The GLB is fetched and parsed in about 45 ms; the rest is the three.js scene setup and the first WebGPU frame.

## The show around the box (seams, light curtain, shock waves, sparks, camera punch)

All effects (see [EFFECTS.md](EFFECTS.md)) are on in the runs above. They cost no measurable frame time on the GPU paths; on the Android Emulator they are part of the JavaScript load described above.

## Earlier results (expo-gl, for the record)

Before the change to WebGPU the same scene measured 1.4 to 3.9 FPS on the iOS Simulator (OpenGL ES drawn by Apple's software renderer), and on Android 60 FPS with MSAA off and a bistable opening (60 / 30). The long list of workarounds that got the iOS Simulator to 60 FPS (render scale 0.25, no shadows, unlit interior, a cheaper colour output) is in the git history of this branch and is no longer in the code.
