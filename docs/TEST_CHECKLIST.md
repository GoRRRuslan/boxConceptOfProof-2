# Test checklist

What was checked, how, and the result. Release builds on the **iOS Simulator (iPhone 17, iOS 27)** and the **Android Emulator (Pixel 9 profile, API 37)**, **one at a time** (the other one shut down; they share the Mac's GPU and CPU, see [TESTING.md](TESTING.md#rule-1--one-platform-at-a-time)). How to test and where everything is documented: [TESTING.md](TESTING.md).

## 1. Automated

| Check | Command | Result |
|---|---|---|
| Lint + types | `yarn ciPipeline` | ✅ clean |
| Unit + component tests | `yarn test` | ✅ 260 tests, 43 suites |
| Clean clone: install → lint → types → tests | see section 4 | ✅ |

## 2. Manual — functional

Test ids refer to the `testID`s used by the scripts (`scripts/app/tapAndroidTestId.sh`).

| # | Case | Expected | Android | iOS |
|---|---|---|---|---|
| F1 | Start the app | Boxes tab, 8 coloured 3D boxes, balance $1,000 | ✅ | ✅ |
| F2 | Scroll the list | Boxes stay in their cards, turn slightly, text in sync | ✅ | ✅ |
| F3 | Tap a box | It flies to the middle, Back / Buy appear, drag hint | ✅ | ✅ |
| F4 | Drag the box | It turns with the finger and keeps turning after release | ✅ | ✅ |
| F5 | Buy an affordable box | Button disabled while running, then "Open the box"; balance −price once | ✅ | ✅ |
| F6 | Open the box | Lid opens about the hinge, watch image + name + value appear | ✅ | ✅ |
| F7 | Done | Back in the list, balance updated, 3D boxes intact | ✅ | ✅ |
| F8 | Collection tab | Watch listed (newest first), count and total value right | ✅ | ✅ |
| F9 | Empty collection | "No watches yet" + Browse boxes → Boxes tab | ✅ | ✅ |
| F10 | Switch tabs back and forth | 3D boxes are there immediately, no blank scene | ✅ | ✅ |
| F11 | Box above the balance (Legend $1,200) | "Not enough balance", Buy disabled | ✅ | ✅ |

## 3. Manual — edge cases and failures

| # | Case | Expected | Android | iOS |
|---|---|---|---|---|
| E1 | Four rapid taps on Buy | One purchase: −$150 once, one new watch (collection 2, balance $800) | ✅ | covered by unit tests |
| E2 | Spend the balance to $0 (Elite ×2) | Balance $0 exactly; every box says "Not enough balance"; Buy disabled | ✅ | covered by unit tests |
| E3 | Purchase fails (`EXPO_PUBLIC_MOCK_PURCHASE_FAILURE=serverError`) | Error shown, balance and collection unchanged, Buy available again | ✅ | covered by unit tests |
| E4 | Response lost, then retry | Same watch, one deduction (same idempotency key) | unit tests | unit tests |
| E5 | Back during purchase / opening | Back is hidden; nothing can interrupt the flow | ✅ (hidden) | ✅ (hidden) |
| E6 | App to background and back while inspecting | Same screen, scene intact | ✅ | ✅ |
| E7 | Frame rate after resume | ≤ 60 FPS (no duplicated frame loops) | ✅ max 60.0 | ✅ |
| E8 | Select a box while another is flying back | Ignored until the box is home | unit tests | unit tests |
| E10 | Renderer frozen (list moves, 3D boxes do not; "Render paused") | Watchdog restarts the renderer, foreground return resyncs it | unit tests (watchdog, foreground resync, no polling while stopped on purpose); scroll → idle → scroll checked on device | same |
| E9 | Restart the app | New session: $1,000, empty collection | ✅ | ✅ |

Evidence: `docs/media/android-edge-two-purchases.png`, `android-edge-no-balance.png`, `android-opening-failure.png`, `android-lifecycle-resumed.png`, `docs/data/android-lifecycle.log`.

## 3b. Manual — animations and polish (Stage 7)

Details of every animation: [ANIMATIONS.md](ANIMATIONS.md). "—" means not run on that platform.

| # | Case | Expected | Android | iOS |
|---|---|---|---|---|
| A1 | First appearance of the list | Boxes pop in one after another, texts slide in with them and end in place under their box | ✅ (after fix, see B1) | ✅ |
| A2 | Press a card | Box squeezes, springs back on release | — | ✅ |
| A3 | Tap a box | Box flies to the middle and pushes towards the camera, turns slowly by itself when left alone | ✅ | ✅ |
| A4 | Drag / pinch / double tap on the focused box | Turns with inertia / zooms 0.7x–2x / glides back to the start | — | ✅ |
| A5 | Swipe up on a bought box | Opens it like the button; box first glides back to its base pose | ✅ | ✅ |
| A6 | Open (button) | Anticipation shake and swell, lid swings open, light from inside | ✅ | ✅ |
| A7 | Reveal Common | Grey pill, grey circles, price, name, brand; nothing over the watch | ✅ | ✅ |
| A8 | Reveal Rare / Epic | Blue / purple pill and circles, particles; Epic with a flash | — | ✅ Rare, ✅ Epic (earlier layout) |
| A9 | Reveal Legendary (5th purchase, Classic box) | Gold pill and circles, flash, 28 particles, price in gold | — | ✅ |
| A10 | After the reveal | Box waits 1.8 s, shrinks away; only then Done appears, centred at the bottom; the tab bar is invisible while the prize is shown and back after Done | ✅ | ✅ |
| A10c | Inspect header | Back top left, box name and price centred below it, in line with the button at the bottom | ✅ | ✅ |
| A10a | Done after the box is put away | The box is back in its card, closed, normal size, texts in place | ✅ | ✅ |
| A10b | Leave in the middle of putting the box away, then select another box at once | The new box opens in inspect mode at normal size (no late timer shrinks it). Run by hand on both platforms before Done was made to appear only after the box is put away; since then Done is not offered in that moment, so it is covered by unit tests (`handleBackPress`) | ✅ (before the change) | ✅ (before the change) |
| A11 | Collection and detail sheet | Rows slide in; detail sheet with a rarity-coloured border; total value counts up | — | ✅ |
| A12 | Light and shine | Glossy / metallic finish rises with the box price; the light from inside the box is visible. Shadows, ambient occlusion and bloom are switched on, but their effect was not isolated by an on/off comparison | ✅ | ✅ |
| A13 | Opening several boxes quickly one after another | Sounds are not cut off (two alternating players per effect) | unit tests | unit tests |
| A14 | Sounds and device tilt | Played / applied | unit tests (sensor-less emulators are ignored without an error) | unit tests |

Bugs found by this round and fixed (each has a test or a documented reason):

| # | Found on | Symptom | Cause and fix |
|---|---|---|---|
| B1 | Android | Card texts froze half-way, half transparent, over the box; stayed so after returning from a box | A Reanimated `entering` layout animation inside `FlashList` is interrupted by the list's re-layout. Now driven by a shared value (`useEntranceAnimation`) and played once |
| B2 | Android emulator | `TypeError: Cannot read property 'beta' of undefined` in the log | An emulator without a motion sensor reports readings without a rotation. Such readings are ignored (test added) |
| B3 | iOS | "[Worklets] Tried to synchronously call a Remote Function" when a box was tapped | A helper called from the render worklet lacked the `'worklet'` directive. Added; checked on the device (Jest cannot catch it) |
| B4 | iOS | Half of the watch looked washed out while it flew out | A 3D-turned image slid behind the glow circles. Now a flat flip |
| B5 | iOS | Opened box cut off at the edge and over the texts | Dolly was kept while the lid opened; now taken back, box smaller and lower |
| B6 | Both | A swipe-opened box looked different from a tapped one | The box now glides to the base pose when opening starts |
| B7 | Android | A benchmark build showed no FPS overlay and no scrolling | Gradle reused an old JavaScript bundle (it does not track environment variables). Documented in the README troubleshooting table |
| B9 | Both | Tab bar visible and Done offered while the prize was still being revealed | The tab bar is hidden through a route parameter while a prize is shown, and Done appears only after the box is put away (two tests) |
| B8 | Code review | A late timer from an opening shrank the box that was flying home, or the next selected box | The opening timers are cleared on Done / Back / a new selection (three tests); A10a and A10b run on both platforms |

## 4. Clean clone

```bash
git clone <repo> /tmp/clean && cd /tmp/clean
yarn install --frozen-lockfile     # postinstall fetches the Filament binaries
yarn ciPipeline && yarn test
yarn androidPrebuild && yarn iosPrebuild
```
Result: ✅ a fresh `git clone` of the committed branch: `yarn install --frozen-lockfile` (7 s, the Filament binaries were downloaded by the postinstall script, ~90 MB), `yarn ciPipeline` clean, `yarn test` 251 / 251 (at the time of the clone check; the suite has 260 since the review fixes), `yarn androidPrebuild` and `yarn iosPrebuild` (with CocoaPods) both finished and produced the native projects. No manual step beyond the README was needed. The full native builds (Xcode / Gradle) were not repeated on the clone; they were run on the working copy for every check above.

## 5. Performance (final code, after the Stage 7 polish)

| Scenario (60 s, release, one platform at a time) | iOS | Android |
|---|---|---|
| Catalogue scrolling by itself (8 boxes, with lights, shadows, ambient occlusion and bloom) | 60.0 FPS, 51 windows, 0 slow frames, worst frame 17 ms | 60.0 FPS, 51 windows, 0 slow frames, worst frame 17 ms |
| Android emulator **window** (not headless), list scrolled non-stop, SurfaceFlinger count | — | 60 FPS for 30 s, twice (1800 frames each); default size and `-scale` 0.6 / 0.7 / 0.85 / 1.0 |
| Opening flow (select → drag → buy → open → reveal → done) | 60.0 on screen (Stage 6, not re-measured after the reveal redesign) | avg 59.6, min 58 (Stage 6, not re-measured after the reveal redesign) |
| Benchmark suite 1–64 boxes × 3 quality profiles | 60.0 in all six (Stage 6) | 60.0 in all six (Stage 6) |

Details and method: [PERFORMANCE.md](PERFORMANCE.md).

## 6. Not covered

- Physical devices (iPhone / Android phone) — the same scripts work on them, not run yet.
- Accessibility (screen readers, large fonts), landscape and tablets — not part of the assignment.
- Real network: the API is a local mock.
- Android: drag / pinch / double tap, press squeeze, the Rare and Legendary reveals, and the collection screens were not run again after the polish (they were run on iOS). Run on Android after the polish: entrance, inspect header, swipe-up open, Common and Epic reveals, putting the box away, Done, the tab bar returning.
- Sounds are not heard and haptics not felt in the simulators: only the calls are unit tested. Device tilt cannot be tested in a simulator.
- The reveal redesign (pill, hero price, put-away box) was not measured for FPS separately.
