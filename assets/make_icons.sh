#!/bin/bash

# Exit immediately if any command fails
set -e

# Define paths
SOURCE_IMAGE="mage_gif/logo_mage.png"
ICONSET_DIR="mage_gif/mage.iconset"
OUTPUT_ICNS="mage_gif/logo_mage.icns"

# Make sure the source image exists
if [ ! -f "$SOURCE_IMAGE" ]; then
  echo "Error: Source image $SOURCE_IMAGE not found."
  exit 1
fi

# Create the iconset directory
mkdir -p "$ICONSET_DIR"

# Generate iconset images using sips
sips -z 16 16     "$SOURCE_IMAGE" --out "$ICONSET_DIR/icon_16x16.png"
sips -z 32 32     "$SOURCE_IMAGE" --out "$ICONSET_DIR/icon_16x16@2x.png"
sips -z 32 32     "$SOURCE_IMAGE" --out "$ICONSET_DIR/icon_32x32.png"
sips -z 64 64     "$SOURCE_IMAGE" --out "$ICONSET_DIR/icon_32x32@2x.png"
sips -z 128 128   "$SOURCE_IMAGE" --out "$ICONSET_DIR/icon_128x128.png"
sips -z 256 256   "$SOURCE_IMAGE" --out "$ICONSET_DIR/icon_128x128@2x.png"
sips -z 256 256   "$SOURCE_IMAGE" --out "$ICONSET_DIR/icon_256x256.png"
sips -z 512 512   "$SOURCE_IMAGE" --out "$ICONSET_DIR/icon_256x256@2x.png"
cp "$SOURCE_IMAGE" "$ICONSET_DIR/icon_512x512.png"
cp "$SOURCE_IMAGE" "$ICONSET_DIR/icon_512x512@2x.png"

# Create the .icns file
iconutil -c icns "$ICONSET_DIR" -o "$OUTPUT_ICNS"

# Clean up
rm -r "$ICONSET_DIR"

echo "Successfully created $OUTPUT_ICNS"
