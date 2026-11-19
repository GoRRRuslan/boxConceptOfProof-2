#!/usr/bin/env bash
# Measures the catalogue while the list scrolls by itself (build with EXPO_PUBLIC_AUTO_SCROLL=1).
#   yarn androidRunCatalogueScroll / yarn iosRunCatalogueScroll   (build + install)
#   yarn perfAndroidCatalogue / yarn perfIosCatalogue             (this script)
# Usage: runCatalogueScroll.sh <ios|android> [seconds=60]
set -euo pipefail

ROOT_DIRECTORY="$(cd "$(dirname "$0")/../.." && pwd)"
PLATFORM="${1:?usage: runCatalogueScroll.sh <ios|android> [seconds]}"
SECONDS_TO_MEASURE="${2:-60}"
WARMUP_WINDOWS=8
OUTPUT_FILE="${ROOT_DIRECTORY}/.cache/perf/${PLATFORM}-catalogue-scroll.log"
SCREENSHOT="${ROOT_DIRECTORY}/docs/media/${PLATFORM}-catalogue-scrolling.png"
mkdir -p "$(dirname "${OUTPUT_FILE}")" "$(dirname "${SCREENSHOT}")"
: > "${OUTPUT_FILE}"

cleanUpBackgroundJobs() {
  for JOB_PID in "${LOGCAT_PID:-}" "${SINK_PID:-}"; do
    if [ -n "${JOB_PID}" ]; then
      kill "${JOB_PID}" 2>/dev/null || true
    fi
  done
}
trap cleanUpBackgroundJobs EXIT

if [ "${PLATFORM}" = "ios" ]; then
  python3 "${ROOT_DIRECTORY}/scripts/perf/perfSink.py" ios "${OUTPUT_FILE}" &
  SINK_PID=$!
  sleep 1
  bash "${ROOT_DIRECTORY}/scripts/app/restartIos.sh"
else
  adb logcat -c
  adb logcat -v raw ReactNativeJS:I '*:S' > "${OUTPUT_FILE}" 2>/dev/null &
  LOGCAT_PID=$!
  bash "${ROOT_DIRECTORY}/scripts/app/restartAndroid.sh" release
fi

echo "[catalogue] ${PLATFORM}: scrolling for ${SECONDS_TO_MEASURE}s..."
sleep "$((SECONDS_TO_MEASURE / 2))"

if [ "${PLATFORM}" = "ios" ]; then
  xcrun simctl io booted screenshot --type=png "${SCREENSHOT}" >/dev/null 2>&1
else
  adb exec-out screencap -p > "${SCREENSHOT}"
fi

sleep "$((SECONDS_TO_MEASURE - SECONDS_TO_MEASURE / 2))"
cp "${OUTPUT_FILE}" "${ROOT_DIRECTORY}/docs/data/${PLATFORM}-catalogue-scroll.log"
python3 "${ROOT_DIRECTORY}/scripts/perf/summarizeSuite.py" "${OUTPUT_FILE}" "${WARMUP_WINDOWS}"
