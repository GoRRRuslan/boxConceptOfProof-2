#!/usr/bin/env bash
# Collects the in-app renderer FPS meter straight from the device log (works for debug AND release
# builds, no Metro needed) and prints the aggregate.
# Usage: measureRenderFps.sh <ios|android> [seconds=30] [settleSeconds=12]
set -euo pipefail

ROOT_DIRECTORY="$(cd "$(dirname "$0")/../.." && pwd)"
PLATFORM="${1:?usage: measureRenderFps.sh <ios|android> [seconds] [settleSeconds]}"
DURATION_SECONDS="${2:-30}"
SETTLE_SECONDS="${3:-12}"
OUTPUT_FILE="${ROOT_DIRECTORY}/.cache/perf/${PLATFORM}-fps.log"
mkdir -p "$(dirname "${OUTPUT_FILE}")"
: > "${OUTPUT_FILE}"

echo "[fps] ${PLATFORM}: settling ${SETTLE_SECONDS}s, measuring ${DURATION_SECONDS}s..."
sleep "${SETTLE_SECONDS}"

if [ "${PLATFORM}" = "ios" ]; then
  # iOS release builds do not forward the JS console: the app POSTs its summaries to a long-lived
  # collector (build with EXPO_PUBLIC_PERF_SINK_URL=http://localhost:8787, see `yarn iosRunBenchmark`).
  # The window is cut out of the collector's log by line numbers.
  bash "${ROOT_DIRECTORY}/scripts/perf/perfSinkControl.sh" start >/dev/null
  SINK_LOG="${ROOT_DIRECTORY}/.cache/perf/ios-sink.log"
  touch "${SINK_LOG}"
  START_LINE="$(wc -l < "${SINK_LOG}")"
  sleep "${DURATION_SECONDS}"
  END_LINE="$(wc -l < "${SINK_LOG}")"
  python3 "${ROOT_DIRECTORY}/scripts/perf/analyzeRenderFps.py" ios "${START_LINE}" "${END_LINE}" "${SINK_LOG}"
  exit 0
fi

adb logcat -c
( adb logcat -v raw ReactNativeJS:I '*:S' > "${OUTPUT_FILE}" 2>/dev/null & echo $! > "${OUTPUT_FILE}.pid" )
sleep "${DURATION_SECONDS}"
kill "$(cat "${OUTPUT_FILE}.pid")" 2>/dev/null || true
rm -f "${OUTPUT_FILE}.pid"

python3 "${ROOT_DIRECTORY}/scripts/perf/analyzeRenderFps.py" "${PLATFORM}" 0 1000000000 "${OUTPUT_FILE}"
