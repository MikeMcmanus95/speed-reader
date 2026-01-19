# Speed Reader Extension Icons

This directory contains the icon assets for the Chrome extension.

## Source File

- `icon.svg` - The master SVG icon (128x128 viewBox)

## Required PNG Files

Chrome extensions require PNG icons at the following sizes:
- `icon-16.png` - Favicon and small toolbar contexts
- `icon-32.png` - Windows toolbar
- `icon-48.png` - Extension management page
- `icon-128.png` - Chrome Web Store and installation dialog

## Generating PNG Files from SVG

### Option 1: Using ImageMagick (recommended)

```bash
# Install ImageMagick if not already installed
# macOS: brew install imagemagick
# Ubuntu: sudo apt install imagemagick

# Generate all icon sizes
convert icon.svg -resize 16x16 icon-16.png
convert icon.svg -resize 32x32 icon-32.png
convert icon.svg -resize 48x48 icon-48.png
convert icon.svg -resize 128x128 icon-128.png
```

### Option 2: Using Inkscape

```bash
# Install Inkscape if not already installed
# macOS: brew install --cask inkscape

# Generate all icon sizes
inkscape icon.svg --export-type=png --export-filename=icon-16.png -w 16 -h 16
inkscape icon.svg --export-type=png --export-filename=icon-32.png -w 32 -h 32
inkscape icon.svg --export-type=png --export-filename=icon-48.png -w 48 -h 48
inkscape icon.svg --export-type=png --export-filename=icon-128.png -w 128 -h 128
```

### Option 3: Using rsvg-convert (librsvg)

```bash
# Install librsvg if not already installed
# macOS: brew install librsvg

# Generate all icon sizes
rsvg-convert icon.svg -w 16 -h 16 -o icon-16.png
rsvg-convert icon.svg -w 32 -h 32 -o icon-32.png
rsvg-convert icon.svg -w 48 -h 48 -o icon-48.png
rsvg-convert icon.svg -w 128 -h 128 -o icon-128.png
```

### Option 4: Using an online tool

1. Go to https://cloudconvert.com/svg-to-png or similar SVG to PNG converter
2. Upload `icon.svg`
3. Set the output size and download
4. Repeat for each required size

## One-liner Script

Save this as `generate-icons.sh` in this directory:

```bash
#!/bin/bash
# Generates all PNG icon sizes from icon.svg using ImageMagick

for size in 16 32 48 128; do
  convert icon.svg -resize ${size}x${size} icon-${size}.png
  echo "Generated icon-${size}.png"
done
```

Run with: `chmod +x generate-icons.sh && ./generate-icons.sh`

## Design Specifications

- **Background**: Dark brown (#1a1714) with rounded corners
- **Icon**: Amber (#f0a623) open book symbol
- **Style**: Flat design optimized for clarity at small sizes
