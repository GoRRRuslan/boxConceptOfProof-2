#!/usr/bin/env bash
# Independent Android FPS check: counts the frames SurfaceFlinger actually presents for the app layer.
# Usage: measureAndroidPresentFps.sh [seconds=15]
set -euo pipefail

SECONDS_TO_MEASURE="${1:-15}"
adb shell dumpsys SurfaceFlinger --timestats -clear -enable >/dev/null
sleep "${SECONDS_TO_MEASURE}"
FRAMES="$(adb shell dumpsys SurfaceFlinger --timestats -dump | grep -A8 "VRI-com.gorrr.mysterywatch.r3f" | grep totalFrames | head -1 | sed 's/.*= //' | tr -d '\r')"
adb shell dumpsys SurfaceFlinger --timestats -disable >/dev/null
echo "[present-fps] ${FRAMES:-0} frames in ${SECONDS_TO_MEASURE}s = $(( ${FRAMES:-0} / SECONDS_TO_MEASURE )) fps"
