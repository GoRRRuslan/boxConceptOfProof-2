#!/usr/bin/env bash
# Records a 10 s Perfetto system trace of the running Android app and prints CPU per thread.
# Needs: adb, a running emulator/device, Python 3 (a venv with `pip install perfetto` is created in .cache/).
set -euo pipefail

ROOT_DIRECTORY="$(cd "$(dirname "$0")/../.." && pwd)"
OUTPUT_DIRECTORY="${ROOT_DIRECTORY}/.cache/perf"
VENV_DIRECTORY="${ROOT_DIRECTORY}/.cache/perfetto-venv"
PACKAGE_NAME="com.gorrr.mysterywatch.r3f"
mkdir -p "${OUTPUT_DIRECTORY}"

adb shell perfetto --txt -c - -o /data/misc/perfetto-traces/mw.pftrace < "${ROOT_DIRECTORY}/scripts/perf/perfetto.cfg"
adb pull /data/misc/perfetto-traces/mw.pftrace "${OUTPUT_DIRECTORY}/android.pftrace" >/dev/null

if [ ! -d "${VENV_DIRECTORY}" ]; then
  python3 -m venv "${VENV_DIRECTORY}"
  "${VENV_DIRECTORY}/bin/pip" install -q perfetto
fi

"${VENV_DIRECTORY}/bin/python" "${ROOT_DIRECTORY}/scripts/perf/analyzeAndroidTrace.py" "${OUTPUT_DIRECTORY}/android.pftrace" "${PACKAGE_NAME}"
