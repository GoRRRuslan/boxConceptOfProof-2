# Testing guide

Rules that keep results trustworthy, and how to run the checks. Results: [TEST_CHECKLIST.md](TEST_CHECKLIST.md). Numbers: [PERFORMANCE.md](PERFORMANCE.md).

## 1. The golden rules

### Rule 1: one platform at a time

> **Never run the iOS Simulator and the Android Emulator at the same time when you test, and above all when you measure FPS.** Either the emulator with the simulator **shut down**, or the simulator with the emulator **shut down**.

**Why:**

- Both run on the **same Mac**. Both draw with the Mac's GPU (Metal) and use many CPU cores. When both are open they fight over the GPU and the CPU, so frames are delivered late and unevenly.
- The symptom is **false jank**: stutters, dropped frames and a lower FPS that have nothing to do with the app. Every published number in [PERFORMANCE.md](PERFORMANCE.md) was taken with only one of them running.
- A result taken with both open is **not comparable** with the others and must not be written down.

**How to switch:**

```bash
# Test on Android: shut the simulator down first
xcrun simctl shutdown all
yarn androidEmulatorStart          # headless (for measuring), or start the emulator window from Android Studio

# Test on iOS: shut the emulator down first
adb emu kill
xcrun simctl boot "iPhone 17"      # then: open -a Simulator
```

Check what is running: `adb devices` (emulators) and `xcrun simctl list devices booted` (simulators). Both lists together should show **one** device.

### Rule 2: measure with a release build, not the development client

The development client runs JavaScript through Metro with debugging on; it is slower and noisy. FPS numbers (and "does it feel smooth") are only valid on a **release build**: `yarn iosRunRelease` / `yarn androidRunRelease`.

### Rule 3: let a fresh emulator settle

Give a freshly booted Android emulator about a minute to finish its post-boot work before you trust any number: right after boot it reads lower and the reading goes away on its own. Headless (`yarn androidEmulatorStart`) has no window compositing; the finished app also holds 60 FPS in the emulator window (see [PERFORMANCE.md](PERFORMANCE.md)).

### Rule 4: do not hand a benchmark build to anyone

Builds made with `EXPO_PUBLIC_SHOW_PERFORMANCE=1` (`yarn *RunOpening`) or `EXPO_PUBLIC_AUTO_SCROLL=1` (`yarn *RunCatalogueScroll`) bake environment variables into the JavaScript: an FPS overlay is drawn or the list scrolls by itself. To go back to the real app, install a normal release build.

### Rule 5: after a rebuild, check you really got the new JavaScript (Android)

Gradle does not track environment variables and Metro caches transformed files without them, so a build can reuse an old bundle. If a build behaves like the previous one, delete the caches and build again:

```bash
rm -rf android/app/build/generated/assets android/app/build/intermediates/assets node_modules/.cache
```

---

## 2. Builds and checks

| Build | Command | Use it for |
|---|---|---|
| Development client | `yarn iosRun` / `yarn androidRun` + `yarn start` | Coding with fast refresh (not for FPS) |
| Release | `yarn iosRunRelease` / `yarn androidRunRelease` | Manual testing, screenshots, videos (bundle id `com.gorrr.mysterywatch.r3f`) |
| Opening benchmark | `yarn iosRunOpening` / `yarn androidRunOpening` | Release app with the FPS overlay |
| Catalogue scroll benchmark | `yarn iosRunCatalogueScroll` / `yarn androidRunCatalogueScroll` | List scrolls by itself, FPS overlay |

- **Automated:** `yarn ciPipeline` (eslint + tsc) and `yarn test` (Jest and React Native Testing Library).
- **FPS:** `yarn perfAndroidCatalogue` / `yarn perfIosCatalogue` (scrolling), `yarn perfAndroidOpening` (opening flow), `yarn perfAndroidFps` / `yarn perfIosFps` (quick sample), `yarn perfAndroidPresentFps` (frames the system really presents). Raw logs belong in `docs/data/`.
- **Simulator caveat:** the iOS Simulator draws OpenGL ES with Apple's software renderer. Frame times there say little about a real iPhone; the app syncs the GPU every frame, so the overlay shows the real (software) rate and not an optimistic JavaScript rate.
- **Flow to walk on each platform:** browse, inspect (drag, pinch, double tap), buy, open (button and swipe up), reveal, Done, collection, plus a failing purchase and a rapid double purchase.
- **Recording results:** a new measurement goes into [PERFORMANCE.md](PERFORMANCE.md) (say which build and device), a new case or bug into [TEST_CHECKLIST.md](TEST_CHECKLIST.md). If something could not be run, write that down too.
