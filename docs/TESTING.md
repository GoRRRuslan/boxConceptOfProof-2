# Testing guide

Rules that keep results trustworthy, plus how to run the checks. Results: [TEST_CHECKLIST.md](TEST_CHECKLIST.md). Numbers: [PERFORMANCE.md](PERFORMANCE.md).

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

## 3. Builds and checks

- Automated: `yarn ciPipeline` (eslint + tsc) and `yarn test` (jest).
- Manual and FPS: **release builds only** (`yarn iosRunRelease`, `yarn androidRunRelease`; add `EXPO_PUBLIC_SHOW_PERFORMANCE=1` for the FPS overlay). Bundle id `com.gorrr.mysterywatch.r3f`.
- The development client (Metro on port 8082 if needed) is for debugging only.
- **Simulator caveat:** the iOS Simulator draws OpenGL ES with Apple's software renderer. Frame times there say little about a real iPhone; the app syncs the GPU every frame so the overlay shows the real (software) rate, not an optimistic JS rate.
- Shared-Mac lock used by the parallel agents: `mkdir /tmp/mystery-watch-device.lock`, release with `rm -rf`.
- Flow to walk on each platform: browse, inspect (drag, pinch, double tap), buy, open (button and swipe up), reveal, Done, collection, plus failure and rapid double-buy.
