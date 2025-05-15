#!/usr/bin/env bash
# scripts/remove-alert.sh

find renderer -type f -name index.html \
  -exec sed -i '' -e '/<!-- custom-alert.html -->/,/<\/script>/d' {} +

echo "✅ Old injections cleared. New snippet injected."
