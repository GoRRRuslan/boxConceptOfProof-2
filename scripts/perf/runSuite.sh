#!/usr/bin/env bash
# Runs the automatic benchmark suite on an already installed benchmark build and prints the table.
#   yarn iosRunSuite  / yarn androidRunSuite   (build + install a release app that runs the suite)
#   yarn perfIosSuite / yarn perfAndroidSuite  (this script: restart, collect, summarise)
# Usage: runSuite.sh <ios|android> [totalSeconds=200]
set -euo pipefail

ROOT_DIRECTORY="$(cd "$(dirname "$0")/../.." && pwd)"
PLATFORM="${1:?usage: runSuite.sh <ios|android> [totalSeconds]}"
TOTAL_SECONDS="${2:-200}"
OUTPUT_FILE="${ROOT_DIRECTORY}/.cache/perf/${PLATFORM}-suite.log"
mkdir -p "$(dirname "${OUTPUT_FILE}")"
: > "${OUTPUT_FILE}"

if [ "${PLATFORM}" = "ios" ]; then
  # Fresh collector + fresh app so the app never reuses a dead keep-alive connection.
  python3 "${ROOT_DIRECTORY}/scripts/perf/perfSink.py" ios "${OUTPUT_FILE}" &
  SINK_PID=$!
  trap 'kill ${SINK_PID} 2>/dev/null || true' EXIT
  sleep 1
  bash "${ROOT_DIRECTORY}/scripts/app/restartIos.sh"
else
  adb logcat -c
  adb logcat -v raw ReactNativeJS:I '*:S' > "${OUTPUT_FILE}" 2>/dev/null &
  LOGCAT_PID=$!
  trap 'kill ${LOGCAT_PID} 2>/dev/null || true' EXIT
  bash "${ROOT_DIRECTORY}/scripts/app/restartAndroid.sh" release
fi

bash "${ROOT_DIRECTORY}/scripts/perf/captureScenarioScreenshots.sh" "${PLATFORM}" &
CAPTURE_PID=$!
cleanUpBackgroundJobs() {
  for JOB_PID in "${CAPTURE_PID:-}" "${LOGCAT_PID:-}" "${SINK_PID:-}"; do
    if [ -n "${JOB_PID}" ]; then
      kill "${JOB_PID}" 2>/dev/null || true
    fi
  done
}
trap cleanUpBackgroundJobs EXIT

echo "[suite] ${PLATFORM}: collecting for ${TOTAL_SECONDS}s (6 scenarios x 30 s)..."
sleep "${TOTAL_SECONDS}"
wait "${CAPTURE_PID}" || true
mkdir -p "${ROOT_DIRECTORY}/docs/data"
cp "${OUTPUT_FILE}" "${ROOT_DIRECTORY}/docs/data/${PLATFORM}-suite.log"
python3 "${ROOT_DIRECTORY}/scripts/perf/summarizeSuite.py" "${OUTPUT_FILE}"
