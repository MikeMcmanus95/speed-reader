#!/bin/bash
# Generates all PNG icon sizes from icon.svg using ImageMagick

for size in 16 32 48 128; do
  convert icon.svg -resize ${size}x${size} icon-${size}.png
  echo "Generated icon-${size}.png"
done
