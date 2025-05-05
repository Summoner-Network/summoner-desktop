#!/bin/bash

# Navigate to the root directory of the project
cd "$(dirname "$0")/../" || exit 1

# Define the full path to the 'mage_gif' folder
mage_gif_dir="assets/mage_gif"

echo "Looking for mage_gif directory at: $mage_gif_dir"

# Check if the directory exists
if [ ! -d "$mage_gif_dir" ]; then
  echo "Directory $mage_gif_dir does not exist!"
  exit 1
fi

# Navigate into the mage_gif directory
cd "$mage_gif_dir" || exit 1

# Extract unique version numbers from filenames like logo_mage_2_3.png
versions=$(ls logo_mage_*_*.png 2>/dev/null | sed -E 's/^logo_mage_([0-9]+)_.+$/\1/' | sort -u)

if [ -z "$versions" ]; then
  echo "No matching versioned image files found!"
  exit 1
fi

# Generate a GIF for each version
for version in $versions; do
  echo "Generating GIF for version $version..."
  ffmpeg -y -framerate 5 -pattern_type glob -i "logo_mage_${version}_*.png" \
    -vf "scale=117:-1:flags=neighbor,split [a][b]; [b] palettegen [p]; [a][p] paletteuse" \
    -loop 0 "../mage_${version}.gif"
  echo "GIF created: assets/mage_${version}.gif"
done
