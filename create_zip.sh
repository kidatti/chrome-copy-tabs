#!/bin/bash

# Extract version from manifest.json using grep and cut
VERSION=$(grep -E '"version":\s*"[^"]+"' manifest.json | cut -d'"' -f4)

# Remove dots from version to create file name (e.g., 0.5.1 -> 051)
VERSION_NO_DOTS=$(echo $VERSION | tr -d '.')

# Create the zip file
echo "Creating zip file for version $VERSION (v$VERSION_NO_DOTS.zip)..."
zip -r "v$VERSION_NO_DOTS.zip" \
    manifest.json \
    *.js \
    *.html \
    images/ \
    _locales/ \
    -x "*.git*" "*.DS_Store" "*.zip"

echo "Done! Created v$VERSION_NO_DOTS.zip" 