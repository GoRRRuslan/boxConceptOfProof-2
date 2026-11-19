#!/usr/bin/env bash
# Takes one screenshot per benchmark scenario while the suite runs (called by runSuite.sh).
# Usage: captureScenarioScreenshots.sh <ios|android> [firstDelaySeconds=22]
set -euo pipefail

ROOT_DIRECTORY="$(cd "$(dirname "$0")/../.." && pwd)"
PLATFORM="${1:?usage: captureScenarioScreenshots.sh <ios|android> [firstDelaySeconds]}"
FIRST_DELAY_SECONDS="${2:-22}"
OUTPUT_DIRECTORY="${ROOT_DIRECTORY}/docs/media"
SCENARIO_NAMES=("1-box" "4-boxes" "16-boxes" "64-boxes-full" "64-boxes-balanced" "64-boxes-performance")
mkdir -p "${OUTPUT_DIRECTORY}"

sleep "${FIRST_DELAY_SECONDS}"

for INDEX in "${!SCENARIO_NAMES[@]}"; do
  TARGET="${OUTPUT_DIRECTORY}/${PLATFORM}-$((INDEX + 1))-${SCENARIO_NAMES[${INDEX}]}.png"

  if [ "${PLATFORM}" = "ios" ]; then
    xcrun simctl io booted screenshot --type=png "${TARGET}" >/dev/null 2>&1
  else
    adb exec-out screencap -p > "${TARGET}"
  fi

  sleep 30
done
