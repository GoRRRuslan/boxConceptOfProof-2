# Mystery Watch R3F

A React Native + TypeScript proof of concept: a scrollable catalogue of real-time 3D mystery boxes, buying with a virtual balance through an async mock API, inspecting and opening a live 3D box with an animated reveal, and a session-scoped collection.

The 3D layer is **three.js through React Three Fiber on expo-gl**: one GL canvas behind the list, a render loop in JavaScript. Every animation and where it lives is in [docs/ANIMATIONS.md](docs/ANIMATIONS.md); the numbers are in [docs/PERFORMANCE.md](docs/PERFORMANCE.md).

Stack: Expo SDK 58, React Native 0.88, TypeScript strict, Reanimated 4, Zustand, React Query, i18next, three.js, `@react-three/fiber/native`, `expo-gl`. App id `com.gorrr.mysterywatch.r3f`, scheme `mysterywatchr3f`.

## Architecture

Flow-based (`src/flows/<name>Flow/{screens,_facades,_facadesLogic,_adapters,_config,_types}`), facades hold logic, screens render. Rules: [CLAUDE.md](CLAUDE.md). Global state in Zustand (session only), server state in React Query, mock API in `src/networking` with an exactly-once purchase guarantee.

### The 3D layer

- **One canvas for the whole app** (`CatalogueScene`), one GL context, behind a FlashList of transparent cards. UI overlays are React Native views.
- `useFacadeCatalogueBoxes` loads `box.glb` once (`services/boxModel/loadBoxModel.ts`), makes one instance per card (`createBoxInstance`: shared geometry, own body and glow materials) and places and animates them in R3F's `useFrame`.
- The pure maths (`computeBoxPose`, `computeOpeningPose`, `openingSceneState`, `stepDragInertia`, easing, lid hinge) has no React or three.js in it and is unit tested.
- Scene state is shared through plain mutable cells (`services/sceneSync/createSharedValue.ts`), written by React (scroll, fingers, sensors) and read in the frame loop.
- **Where per-frame work runs:** on the JS thread inside `useFrame`. Cost per frame is a few transforms for at most ~5 visible boxes, so the JS thread is not the bottleneck; the GPU is (see PERFORMANCE.md).
- **Render on demand:** `frameloop` is switched to `always` while something moves and back to `demand` after a run of quick frames (`components/RenderOnDemand`), so the GPU rests on a still screen.
- **GPU sync** (`services/gpuSync`): a one-pixel read-back after each frame gives the JS loop back-pressure and makes the FPS meter truthful (expo-gl otherwise queues GL commands and JS runs ahead).
- **Model:** the GLB is uncompressed (no Draco/KTX2: their WASM decoders need Web Workers, which React Native lacks). `scripts/assets/optimizeBoxModel.sh` rebuilds it.
- **Metro** resolves `three` to its ES-module build (`metro.config.js`); the CJS entry needs `process.emitWarning`.

## Quick start

```bash
yarn install
yarn iosPrebuild && yarn androidPrebuild     # generates ios/ and android/
yarn iosRunRelease                           # release build on the booted iPhone 17 simulator
yarn androidRunRelease                       # release build on the booted emulator
yarn test && yarn ciPipeline
```

Use `EXPO_PUBLIC_SHOW_PERFORMANCE=1` for the live FPS overlay. `pod install` needs `LANG=en_US.UTF-8`.

## Just try it

Install a release build (`yarn iosRunRelease` / `yarn androidRunRelease`), then: scroll the boxes, tap one to inspect (drag, pinch, double tap), tap Buy, swipe up or tap Open, watch the reveal, tap Done, open the Collection tab. Test on **one platform at a time** ([docs/TESTING.md](docs/TESTING.md)).

## Documentation

[docs/README.md](docs/README.md) is the map: [TESTING](docs/TESTING.md), [TEST_CHECKLIST](docs/TEST_CHECKLIST.md), [PERFORMANCE](docs/PERFORMANCE.md), [ANIMATIONS](docs/ANIMATIONS.md), [MODEL](docs/MODEL.md), [ASSIGNMENT](docs/ASSIGNMENT.md).
