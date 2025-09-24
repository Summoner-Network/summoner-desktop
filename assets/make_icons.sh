#!/usr/bin/env bash
set -euo pipefail

# Resolve the directory of this script (assets/) even if invoked from elsewhere
ASSETS_DIR="$(
  cd -- "$(dirname -- "${BASH_SOURCE[0]}")" >/dev/null 2>&1
  pwd -P
)"

# Paths
SOURCE_IMAGE="$ASSETS_DIR/originals/summoner-logo.png"
ICONS_DIR="$ASSETS_DIR/icons"
ICONSET_DIR="$ICONS_DIR/mage.iconset"
TMP_ICO_DIR="$ICONS_DIR/.ico_tmp"

OUTPUT_ICNS="$ICONS_DIR/logo_mage.icns"
OUTPUT_ICO="$ICONS_DIR/logo_mage.ico"
OUTPUT_PNG="$ICONS_DIR/logo_mage.png"      # Linux PNG (512x512)

# Check source
if [[ ! -f "$SOURCE_IMAGE" ]]; then
  echo "Error: Source image not found at: $SOURCE_IMAGE"
  exit 1
fi

# Ensure tools needed for macOS icon generation
if ! command -v sips >/dev/null 2>&1; then
  echo "Error: 'sips' not found (macOS tool)."
  exit 1
fi
if ! command -v iconutil >/dev/null 2>&1; then
  echo "Error: 'iconutil' not found (macOS tool)."
  exit 1
fi

# Determine ICO tool if available (for Windows .ico)
ICO_TOOL=""
if command -v magick >/dev/null 2>&1; then
  ICO_TOOL="magick"   # ImageMagick (preferred)
elif command -v convert >/dev/null 2>&1; then
  ICO_TOOL="convert"  # Older ImageMagick CLI name
elif command -v icotool >/dev/null 2>&1; then
  ICO_TOOL="icotool"  # icoutils
elif command -v png2ico >/dev/null 2>&1; then
  ICO_TOOL="png2ico"  # png2ico
fi

mkdir -p "$ICONS_DIR"
rm -rf "$ICONSET_DIR" "$TMP_ICO_DIR"
mkdir -p "$ICONSET_DIR" "$TMP_ICO_DIR"

############################################
# Generate PNGs for .icns (Apple iconset)
############################################
sips -z 16 16     "$SOURCE_IMAGE" --out "$ICONSET_DIR/icon_16x16.png" >/dev/null
sips -z 32 32     "$SOURCE_IMAGE" --out "$ICONSET_DIR/icon_16x16@2x.png" >/dev/null
sips -z 32 32     "$SOURCE_IMAGE" --out "$ICONSET_DIR/icon_32x32.png" >/dev/null
sips -z 64 64     "$SOURCE_IMAGE" --out "$ICONSET_DIR/icon_32x32@2x.png" >/dev/null
sips -z 128 128   "$SOURCE_IMAGE" --out "$ICONSET_DIR/icon_128x128.png" >/dev/null
sips -z 256 256   "$SOURCE_IMAGE" --out "$ICONSET_DIR/icon_128x128@2x.png" >/dev/null
sips -z 256 256   "$SOURCE_IMAGE" --out "$ICONSET_DIR/icon_256x256.png" >/dev/null
sips -z 512 512   "$SOURCE_IMAGE" --out "$ICONSET_DIR/icon_256x256@2x.png" >/dev/null
cp "$SOURCE_IMAGE" "$ICONSET_DIR/icon_512x512.png"
cp "$SOURCE_IMAGE" "$ICONSET_DIR/icon_512x512@2x.png"

# Build .icns (macOS)
iconutil -c icns "$ICONSET_DIR" -o "$OUTPUT_ICNS"

############################################
# Linux PNG (512x512)
############################################
# If you prefer to keep the original size, replace this sips line with: cp "$SOURCE_IMAGE" "$OUTPUT_PNG"
sips -z 512 512 "$SOURCE_IMAGE" --out "$OUTPUT_PNG" >/dev/null

############################################
# Generate PNGs for .ico (Windows)
############################################
# Common sizes for ICO: 16, 24, 32, 48, 64, 128, 256
for sz in 16 24 32 48 64 128 256; do
  sips -z "$sz" "$sz" "$SOURCE_IMAGE" --out "$TMP_ICO_DIR/${sz}.png" >/dev/null
done

# Build .ico if a suitable tool is present
if [[ -n "$ICO_TOOL" ]]; then
  case "$ICO_TOOL" in
    magick)
      magick "$TMP_ICO_DIR/16.png" "$TMP_ICO_DIR/24.png" "$TMP_ICO_DIR/32.png" \
             "$TMP_ICO_DIR/48.png" "$TMP_ICO_DIR/64.png" "$TMP_ICO_DIR/128.png" \
             "$TMP_ICO_DIR/256.png" "$OUTPUT_ICO"
      ;;
    convert)
      convert "$TMP_ICO_DIR/16.png" "$TMP_ICO_DIR/24.png" "$TMP_ICO_DIR/32.png" \
              "$TMP_ICO_DIR/48.png" "$TMP_ICO_DIR/64.png" "$TMP_ICO_DIR/128.png" \
              "$TMP_ICO_DIR/256.png" "$OUTPUT_ICO"
      ;;
    icotool)
      icotool -c -o "$OUTPUT_ICO" "$TMP_ICO_DIR/"{16,24,32,48,64,128,256}.png
      ;;
    png2ico)
      png2ico "$OUTPUT_ICO" "$TMP_ICO_DIR/"{16,24,32,48,64,128,256}.png
      ;;
  esac
  ICO_DONE=1
else
  ICO_DONE=0
fi

# Cleanup
rm -rf "$ICONSET_DIR" "$TMP_ICO_DIR"

echo "Created: $OUTPUT_ICNS"
echo "Created: $OUTPUT_PNG"
if [[ "${ICO_DONE}" -eq 1 ]]; then
  echo "Created: $OUTPUT_ICO"
else
  echo "Note: .ico not created (no ImageMagick/icotool/png2ico found)."
  echo "      On macOS, you can install one of these, for example:"
  echo "        brew install imagemagick"
  echo "      Then re-run this script."
fi
