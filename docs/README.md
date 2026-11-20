# Documentation map

Start here. Each row says what a document is for, so you can open the right one at once.

## I want to…

| I want to… | Open |
|---|---|
| Understand the assignment | [ASSIGNMENT.md](ASSIGNMENT.md) |
| Run the app on an emulator or simulator | [../README.md → Just try it](../README.md#just-try-it-recommended-for-reviewers) |
| Understand the architecture and where code lives | [../README.md → Architecture](../README.md#4-project-architecture), [Project Structure](../README.md#9-project-structure) |
| See how the 3D scene works (one canvas, hinge, render on demand) | [../README.md → Real-time 3D](../README.md#5-real-time-3d), [MODEL.md](MODEL.md) |
| See how three.js runs on React Native (expo-gl, Metro, GPU sync) | [../README.md → three.js on expo-gl](../README.md#6-threejs-on-expo-gl) |
| See every animation, where it lives and how it works | [ANIMATIONS.md](ANIMATIONS.md) |
| **Test the app (rules, iOS, Android, FPS)** | **[TESTING.md](TESTING.md)** |
| See what was tested and the result, plus bugs found | [TEST_CHECKLIST.md](TEST_CHECKLIST.md) |
| See FPS numbers, method and limits | [PERFORMANCE.md](PERFORMANCE.md) |

## The most important rule

> **Test on one platform at a time:** either the Android emulator with the iOS simulator shut down, or the iOS simulator with the Android emulator shut down. They share the Mac's GPU and CPU; running both gives false jank and unusable FPS numbers. Full reasoning and the commands to switch: [TESTING.md, rule 1](TESTING.md#rule-1-one-platform-at-a-time).

## All documents

| Document | What it holds |
|---|---|
| [ASSIGNMENT.md](ASSIGNMENT.md) | The original assignment |
| [ANIMATIONS.md](ANIMATIONS.md) | All animations with screenshots |
| [TESTING.md](TESTING.md) | Testing guide and the golden rules |
| [TEST_CHECKLIST.md](TEST_CHECKLIST.md) | Cases, results per platform, bugs found, gaps |
| [PERFORMANCE.md](PERFORMANCE.md) | FPS report: numbers, method, startup, limits |
| [MODEL.md](MODEL.md) | The 3D box model: parts, pivots, materials |
| `media/` | Screenshots |
