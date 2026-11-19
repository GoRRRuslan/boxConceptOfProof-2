#!/usr/bin/env bash
# Plays the whole opening flow on the Android emulator (select, turn, buy, open, reveal, done), takes a
# screenshot of every step into docs/media and prints the FPS measured during the flow.
#   yarn androidRunOpening   (build + install a release app with the FPS meter)
#   yarn perfAndroidOpening  (this script)
# Usage: captureOpeningFlow.sh [boxTestId=boxCard-starter]
set -euo pipefail

ROOT_DIRECTORY="$(cd "$(dirname "$0")/../.." && pwd)"
BOX_TEST_ID="${1:-boxCard-starter}"
OUTPUT_FILE="${ROOT_DIRECTORY}/.cache/perf/android-opening.log"
MEDIA_DIRECTORY="${ROOT_DIRECTORY}/docs/media"
mkdir -p "$(dirname "${OUTPUT_FILE}")" "${MEDIA_DIRECTORY}"
: > "${OUTPUT_FILE}"

cleanUpBackgroundJobs() {
  if [ -n "${LOGCAT_PID:-}" ]; then
    kill "${LOGCAT_PID}" 2>/dev/null || true
  fi
}
trap cleanUpBackgroundJobs EXIT

shoot() {
  adb exec-out screencap -p > "${MEDIA_DIRECTORY}/android-opening-$1.png"
}

tap() {
  bash "${ROOT_DIRECTORY}/scripts/app/tapAndroidTestId.sh" "$1" >/dev/null
}

adb logcat -c
adb logcat -v raw ReactNativeJS:I '*:S' > "${OUTPUT_FILE}" 2>/dev/null &
LOGCAT_PID=$!
bash "${ROOT_DIRECTORY}/scripts/app/restartAndroid.sh" release >/dev/null
sleep 14

shoot 1-catalogue
tap "${BOX_TEST_ID}"
sleep 2
shoot 2-inspect
adb shell input swipe 300 1400 850 1250 350
sleep 0.6
shoot 3-turned
tap buyButton
sleep 0.35
shoot 4-purchasing
sleep 2
shoot 5-ready
tap openButton
sleep 0.5
shoot 6-opening
sleep 2.5
shoot 7-revealed
tap doneButton
sleep 2
shoot 8-back-in-catalogue
sleep 1

python3 "${ROOT_DIRECTORY}/scripts/perf/summarizeSuite.py" "${OUTPUT_FILE}" 0 || true
