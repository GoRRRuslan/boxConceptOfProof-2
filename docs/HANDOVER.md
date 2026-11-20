# Handover (work in progress)

Done: R3F/three/expo-gl 3D layer, tests (ciPipeline + jest green), iOS Release runs on iPhone 17 Simulator, boxes render with real GLB (uncompressed, Draco removed), render-on-demand, GPU sync point.
Findings: metro.config.js forces three.module.js (CJS entry needs process.emitWarning); expo-splash-screen needs explicit hide(); iOS Simulator GLES is software (first frame ~4 s, JS runs ahead of GL thread; installGpuSync adds back-pressure, untested after last edit); RENDER_RESOLUTION_SCALE=0.5.
Not done: shadows/environment re-enabled (flags in sceneRenderConfig.ts are off), AO/bloom, Android build and test, FPS numbers, device flow tests (buy/open/reveal), docs set, screenshots, PR.
