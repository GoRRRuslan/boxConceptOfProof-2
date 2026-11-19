#!/usr/bin/env bash
# Records a 10 s Instruments "Time Profiler" trace of the app on a booted simulator (or a
# connected device: pass its UDID as $1) and prints CPU per thread.
set -euo pipefail

ROOT_DIRECTORY="$(cd "$(dirname "$0")/../.." && pwd)"
OUTPUT_DIRECTORY="${ROOT_DIRECTORY}/.cache/perf"
DEVICE="${1:-booted}"
BUNDLE_IDENTIFIER="com.gorrr.mysterywatch.r3f"
mkdir -p "${OUTPUT_DIRECTORY}"
rm -rf "${OUTPUT_DIRECTORY}/ios-time-profiler.trace"

if [ "${DEVICE}" = "booted" ]; then
  DEVICE="$(xcrun simctl list devices booted | grep -oE '[0-9A-F-]{36}' | head -1)"
  PROCESS_IDENTIFIER="$(xcrun simctl launch booted "${BUNDLE_IDENTIFIER}" | awk -F': ' '{print $2}')"
else
  PROCESS_IDENTIFIER="$(xcrun devicectl device process launch --device "${DEVICE}" "${BUNDLE_IDENTIFIER}" 2>/dev/null | grep -oE 'processIdentifier: [0-9]+' | awk '{print $2}')"
fi

xcrun xctrace record --template 'Time Profiler' --device "${DEVICE}" --attach "${PROCESS_IDENTIFIER}" \
  --time-limit 10s --output "${OUTPUT_DIRECTORY}/ios-time-profiler.trace" --no-prompt >/dev/null
xcrun xctrace export --input "${OUTPUT_DIRECTORY}/ios-time-profiler.trace" \
  --xpath '/trace-toc/run[@number="1"]/data/table[@schema="time-profile"]' > "${OUTPUT_DIRECTORY}/ios-time-profile.xml"
python3 -I "${ROOT_DIRECTORY}/scripts/perf/analyzeIosProfile.py" "${OUTPUT_DIRECTORY}/ios-time-profile.xml"
