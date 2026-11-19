# Testing guide

How the app is tested, where each kind of test is documented, and the **rules** that keep the results trustworthy. If you only read one thing here, read [section 2](#2-the-golden-rules).

- [1. Where to find what](#1-where-to-find-what)
- [2. The golden rules](#2-the-golden-rules)
- [3. Which build to install](#3-which-build-to-install)
- [4. Automated checks](#4-automated-checks)
- [5. Manual testing on iOS](#5-manual-testing-on-ios)
- [6. Manual testing on Android](#6-manual-testing-on-android)
- [7. FPS testing](#7-fps-testing)
- [8. Handy facts for testers](#8-handy-facts-for-testers)
- [9. Recording results](#9-recording-results)

---

## 1. Where to find what

| I want to… | Read |
|---|---|
| Run the app and try it myself | [README, "Just try it"](../README.md#just-try-it-recommended-for-reviewers) |
| Know what was checked and the result (cases, platforms, bugs found) | [TEST_CHECKLIST.md](TEST_CHECKLIST.md) |
| Measure or understand FPS (method, numbers, history, limits) | [PERFORMANCE.md](PERFORMANCE.md) |
| Test the **iOS** app by hand | [section 5](#5-manual-testing-on-ios) |
| Test the **Android** app by hand | [section 6](#6-manual-testing-on-android) |
| Measure FPS on iOS / Android | [section 7](#7-fps-testing) |
| See every animation and where it lives in the code | [ANIMATIONS.md](ANIMATIONS.md) |
| Understand the architecture and the folder layout | [README, sections 4 and 9](../README.md#4-project-architecture) |
| Fix a build or emulator problem | [README, Troubleshooting](../README.md#12-troubleshooting) |
| Find the scripts and what they do | [section 7](#7-fps-testing) and [README, Scripts](../README.md#scripts) |

---

## 2. The golden rules

### Rule 1 — one platform at a time

> **Never run the iOS Simulator and the Android Emulator at the same time when you test, and above all when you measure FPS.** Either the emulator with the simulator **shut down**, or the simulator with the emulator **shut down**.

**Why:**

- Both run on the **same Mac**. Both draw with the Mac's GPU (Metal) and use many CPU cores. When both are open they fight over the GPU and the CPU, so frames are delivered late and unevenly.
- The symptom is **false jank**: stutters, dropped frames and a lower FPS that have nothing to do with the app. We saw exactly this while developing, and every published number in [PERFORMANCE.md](PERFORMANCE.md) was taken with only one of them running.
- A result taken with both open is **not comparable** with the others and must not be written down.

**How to switch:**

```bash
# Test on Android → shut the simulator down first
xcrun simctl shutdown all
yarn androidEmulatorStart          # headless (for measuring), or start the emulator window from Android Studio

# Test on iOS → shut the emulator down first
adb emu kill
xcrun simctl boot "iPhone 17"      # then: open -a Simulator (or the DeviceHub app on Xcode 27)
```

Check what is running: `adb devices` (emulators) and `xcrun simctl list devices booted` (simulators). Both lists should show **one** device in total.

### Rule 2 — measure with a release build, not the development client

The development client runs JavaScript through Metro with debugging on; it is slower and noisy. FPS numbers (and "does it feel smooth") are only valid on a **release build**: `yarn iosRunRelease` / `yarn androidRunRelease`. Details in [section 3](#3-which-build-to-install).

### Rule 3 — measure headless on Android, or let a fresh emulator settle

For **exact numbers**, boot the Android emulator without a window (`yarn androidEmulatorStart`): there is no window compositing to disturb the measurement. For **hand testing**, the windowed emulator is fine: the finished app holds 60 FPS in the window too (measured, see [PERFORMANCE.md](PERFORMANCE.md)). Give a freshly booted emulator about a minute to finish its post-boot work before you trust any number; right after boot we once saw 43 FPS that went away on its own.

### Rule 4 — do not hand a benchmark build to anyone

Benchmark builds (`*RunCatalogueScroll`, `*RunOpening`, `*RunSuite`, `*RunBenchmark`) bake environment variables into the JavaScript: the list scrolls by itself, an FPS overlay is drawn, or a lab screen replaces the app. To go back to the real app, install a normal release build.

### Rule 5 — after a rebuild, check you really got the new JavaScript (Android)

Gradle does not track environment variables and sometimes reuses an old JavaScript bundle. If a build behaves like the previous one, delete the bundle caches and build again:

```bash
rm -rf android/app/build/generated/assets/createBundleReleaseJsAndAssets android/app/build/intermediates/assets/release
```

---

## 3. Which build to install

| Build | Command | Use it for | Do **not** use it for |
|---|---|---|---|
| **Development client** | `yarn iosRun` / `yarn androidRun` + `yarn start` | Coding with fast refresh | FPS, "does it feel smooth" |
| **Release** | `yarn iosRunRelease` / `yarn androidRunRelease` | Manual testing, reviewers, screenshots | — |
| **Benchmark (opening)** | `yarn iosRunOpening` / `yarn androidRunOpening` | Release app **with the FPS overlay** | Handing to people |
| **Benchmark (catalogue scroll)** | `yarn iosRunCatalogueScroll` / `yarn androidRunCatalogueScroll` | List scrolls by itself, FPS overlay | Handing to people |
| **Benchmark (suite)** | `yarn iosRunSuite` / `yarn androidRunSuite` | Six-scenario lab (1–64 boxes × quality) | Handing to people |

A release build carries its JavaScript inside, so it needs **no Metro server**. Relaunch an installed app without rebuilding: `yarn iosRestart` / `yarn androidRestartRelease`.

---

## 4. Automated checks

```bash
yarn ciPipeline   # ESLint + TypeScript — must be clean
yarn test         # Jest + React Native Testing Library — 260 tests, 43 suites
```

What the tests cover: purchase rules (exactly once, failure, lost response), the opening phase machine and timers, scene state, pose and drag maths, rarity, sounds and device tilt (with the native modules mocked), the facades, and the UI components. What they **cannot** catch and what you must therefore check on a device: the worklet code that talks to Filament (for example a helper called from a worklet that lacks the `'worklet'` directive only fails at runtime), the real look of animations, real audio and haptics.

Both commands also run on a clean clone; see [TEST_CHECKLIST.md, section 4](TEST_CHECKLIST.md#4-clean-clone).

---

## 5. Manual testing on iOS

1. Rule 1: shut the Android emulator down (`adb emu kill`), boot the simulator.
2. Install a **release** build: `yarn iosRunRelease` (if it ends with an osascript error about the Simulator window, the app is installed anyway; see Troubleshooting).
3. Walk through the cases in [TEST_CHECKLIST.md](TEST_CHECKLIST.md) (functional F1–F11, edge E1–E10, animation A1–A14).
4. Screenshots: `xcrun simctl io booted screenshot file.png`.
5. Tapping from a script is not available for iOS in this repo; tap by hand or with the simulator tooling.

## 6. Manual testing on Android

1. Rule 1: shut the iOS simulator down (`xcrun simctl shutdown all`), start the emulator (window from Android Studio, or `emulator -avd <name> -gpu host`; headless: `yarn androidEmulatorStart`).
2. Install a **release** build: `yarn androidRunRelease`.
3. Walk through the same cases as on iOS. Scripts can tap by `testID`:

```bash
bash scripts/app/tapAndroidTestId.sh buyButton      # also: openButton, doneButton, backButton, boxCard-starter, collectionTab, …
adb exec-out screencap -p > shot.png                 # screenshot
adb logcat -d -s ReactNativeJS:E AndroidRuntime:E    # JavaScript and native errors
```

4. Read the log after every session: a JavaScript error that does not crash the app (for example a missing sensor on an emulator) only shows up there.

---

## 7. FPS testing

Full method, numbers, charts and history: **[PERFORMANCE.md](PERFORMANCE.md)**. Short version:

- The frame rate comes from an **in-app renderer FPS meter** (counts Filament's per-frame callbacks), cross-checked on Android with SurfaceFlinger (`yarn perfAndroidPresentFps`, counts frames the system really presents) and with Perfetto / Instruments for CPU.
- A scenario is measured for 60 s after a warm-up; a "slow frame" is one longer than 25 ms.
- Follow Rules 1–4 above.

| Goal | iOS | Android |
|---|---|---|
| Catalogue scrolling by itself (60 s) | `yarn iosRunCatalogueScroll` then `yarn perfIosCatalogue` | `yarn androidRunCatalogueScroll` then `yarn perfAndroidCatalogue` |
| Opening flow with the overlay | `yarn iosRunOpening` | `yarn androidRunOpening` then `yarn perfAndroidOpening` |
| Benchmark suite (1–64 boxes × 3 qualities) | `yarn iosRunSuite` then `yarn perfIosSuite` | `yarn androidRunSuite` then `yarn perfAndroidSuite` |
| Quick sample of the running app | `yarn perfIosFps` | `yarn perfAndroidFps` |
| Independent check from the system | — | `yarn perfAndroidPresentFps` |
| CPU per thread | `yarn perfIosProfile` (Instruments) | `yarn perfAndroidTrace` (Perfetto) |

Where the pieces live:

| Piece | Location |
|---|---|
| Scripts | `scripts/perf/` (measure, suite, scroll, opening flow, profilers) and `scripts/app/` (restart, headless emulator, tap by testID) |
| Raw logs | `docs/data/` |
| Screenshots and charts | `docs/media/` (`yarn perfCharts` redraws the charts) |
| In-app meter and overlay | `src/services/performance/`, `src/components/PerformanceOverlay/` |
| Build-time switches | `EXPO_PUBLIC_SHOW_PERFORMANCE=1`, `EXPO_PUBLIC_AUTO_SCROLL=1`, `EXPO_PUBLIC_INITIAL_SCREEN=spike`, `EXPO_PUBLIC_AUTO_BENCHMARK`, `EXPO_PUBLIC_AUTO_BOXES`, `EXPO_PUBLIC_PERF_SINK_URL` |

Results to date (final code): the catalogue scrolls at **60.0 FPS with 0 slow frames, worst frame 17 ms, on iOS and Android**; the Android emulator window held 60 FPS for 30 s, twice.

---

## 8. Handy facts for testers

- **Start state:** balance $1,000, empty collection. A restart is a new session (nothing is saved).
- **Prizes are deterministic per purchase number** (the first purchase of the session is #1, a restart resets the counter). To see every rarity quickly:

| Purchase # | Box | Prize | Rarity |
|---|---|---|---|
| 1 | Starter | Casio Vintage | Common |
| 2 | Starter | Oyster Perpetual | Rare |
| 5 | Classic | Sky-Dweller | Legendary |
| 2 (instead of Starter) | Elite | GMT Master | Epic |

  For Legendary: buy Starter four times (#1–#4), then Classic as the 5th purchase.
- **Failures:** build with `EXPO_PUBLIC_MOCK_PURCHASE_FAILURE=networkError | serverError | responseLost` to test a failing purchase.
- **Done appears late on purpose:** after a reveal the opened box waits 1.8 s, shrinks away (0.7 s), and only then does **Done** appear. The tab bar is invisible while a prize is shown.
- **Sound** is not audible in screenshots or logs; check it by ear on a device or simulator with audio. **Device tilt** cannot be tested in a simulator.

---

## 9. Recording results

- New measurement → raw log into `docs/data/`, screenshot into `docs/media/`, and the numbers into [PERFORMANCE.md](PERFORMANCE.md) (say which build, which device, which date).
- New manual check or bug → a row in [TEST_CHECKLIST.md](TEST_CHECKLIST.md) (case, expected, Android, iOS) and, for a bug, a row in its bug table with the cause and the fix.
- If you could not run something, write that down too (section "Not covered" of the checklist). An honest gap is better than a silent one.
