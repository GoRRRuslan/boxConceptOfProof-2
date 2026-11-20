#!/usr/bin/env bash
# Rebuilds src/assets/models/box.glb from the original GLB in assets-source/box:
#   dedup -> prune.  NO Draco: three's DRACOLoader needs a WASM decoder in a Web Worker, which React
#   Native does not have, so the model ships uncompressed (about 1.3 MB). Node names (Shell_Lid,
#   Shell_Wordmark, ...) are untouched. Do NOT use meshopt/quantize: they move scale into node
#   transforms, which the lid hinge (it replaces the node's local transform) would overwrite.
set -euo pipefail

ROOT_DIRECTORY="$(cd "$(dirname "$0")/../.." && pwd)"
SOURCE_FILE="${ROOT_DIRECTORY}/assets-source/box/designer-box-2-v1-icy.glb"
TARGET_FILE="${ROOT_DIRECTORY}/src/assets/models/box.glb"
TEMPORARY_DIRECTORY="$(mktemp -d)"
trap 'rm -rf "${TEMPORARY_DIRECTORY}"' EXIT

npx --yes @gltf-transform/cli@4 dedup "${SOURCE_FILE}" "${TEMPORARY_DIRECTORY}/deduplicated.glb" >/dev/null
npx --yes @gltf-transform/cli@4 prune "${TEMPORARY_DIRECTORY}/deduplicated.glb" "${TARGET_FILE}" >/dev/null

printf "box.glb: %s bytes -> %s bytes\n" "$(stat -f%z "${SOURCE_FILE}")" "$(stat -f%z "${TARGET_FILE}")"
