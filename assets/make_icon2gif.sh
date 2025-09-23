#!/usr/bin/env bash
set -euo pipefail

# -------- config --------
FRAMERATE=5          # frames per second
LOOP=0               # 0 = loop forever
INPUT_GLOB="*.png"   # frame files inside each subfolder
SCALE_FILTER=""      # e.g. "scale=512:-1:flags=neighbor" to force a width

# -------- resolve paths regardless of CWD --------
SCRIPT_DIR="$(
  cd -- "$(dirname -- "${BASH_SOURCE[0]}")" >/dev/null 2>&1
  pwd -P
)"

# If this file lives in assets/icon2gif/, ICON2GIF_DIR is SCRIPT_DIR.
# If it lives in assets/, ICON2GIF_DIR is "$SCRIPT_DIR/icon2gif".
if [[ -d "$SCRIPT_DIR/frames" && -d "$SCRIPT_DIR/gifs" ]]; then
  ICON2GIF_DIR="$SCRIPT_DIR"
else
  ICON2GIF_DIR="$SCRIPT_DIR/icon2gif"
fi

FRAMES_DIR="$ICON2GIF_DIR/frames"
OUT_DIR="$ICON2GIF_DIR/gifs"

# -------- sanity checks --------
if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "Error: ffmpeg not found. Install it (e.g., 'brew install ffmpeg' on macOS)."
  exit 1
fi
if [[ ! -d "$FRAMES_DIR" ]]; then
  echo "Error: frames directory not found at: $FRAMES_DIR"
  exit 1
fi

mkdir -p "$OUT_DIR"

# -------- per-folder GIF build --------
shopt -s nullglob
for subdir in "$FRAMES_DIR"/*/; do
  base="$(basename "$subdir")"
  [[ "$base" = .* ]] && continue   # skip hidden dirs like .DS_Store/

  # Collect frames with natural sort (Bash 3.2-friendly; no 'mapfile')
  IFS=$'\n' read -r -d '' -a frames < <(cd "$subdir" && ls -1v $INPUT_GLOB 2>/dev/null; printf '\0')
  if (( ${#frames[@]} == 0 )); then
    echo "Skipping '$base' (no frames matching '$INPUT_GLOB')."
    continue
  fi

  echo "Building GIF for '$base' from $((${#frames[@]})) frame(s)..."

  # Stage sequential symlinks 0001.png, 0002.png, ...
  STAGE="$(mktemp -d)"
  i=1
  for f in "${frames[@]}"; do
    printf -v seq "%04d" "$i"
    ln -s "$subdir/$f" "$STAGE/$seq.png"
    ((i++))
  done

  # Palette + encode
  if [[ -n "$SCALE_FILTER" ]]; then
    VF="${SCALE_FILTER},split [a][b]; [b] palettegen [p]; [a][p] paletteuse"
  else
    VF="split [a][b]; [b] palettegen [p]; [a][p] paletteuse"
  fi

  OUT_GIF="$OUT_DIR/${base}.gif"
  ffmpeg -y -framerate "$FRAMERATE" -i "$STAGE/%04d.png" \
    -vf "$VF" -loop "$LOOP" "$OUT_GIF" >/dev/null

  rm -rf "$STAGE"
  echo "Created: $OUT_GIF"
done

echo "All done. Output directory: $OUT_DIR"
