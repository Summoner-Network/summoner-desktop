#!/usr/bin/env bash
set -euo pipefail

REPO_URL="https://github.com/Summoner-Network/summoner-geofit"
TARGET_DIR="assets/summoner-geofit"
MERCATOR_SRC="${TARGET_DIR}/mercator.ts"
MERCATOR_DEST="src/utils/mercator.ts"

if [ -d "${TARGET_DIR}/.git" ]; then
  git -C "${TARGET_DIR}" pull --ff-only
else
  if [ -d "${TARGET_DIR}" ]; then
    rm -rf "${TARGET_DIR}"
  fi
  git clone "${REPO_URL}" "${TARGET_DIR}"
fi

if [ -d "${TARGET_DIR}/.git" ]; then
  rm -rf "${TARGET_DIR}/.git"
fi

mkdir -p "$(dirname "${MERCATOR_DEST}")"
cp "${MERCATOR_SRC}" "${MERCATOR_DEST}"

echo "Synced mercator.ts to ${MERCATOR_DEST}"
