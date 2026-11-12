#!/bin/sh
# Rebuild the raster icons from public/favicon.svg (Blocky's head).
# Needs rsvg-convert and ImageMagick (brew install librsvg imagemagick).
# Browser favicons stay transparent. Home-screen icons cannot be, so they sit on the
# playground's paper colour, with Blocky inside the safe zone for masked icons.
set -e
cd "$(dirname "$0")/../public"
PAPER='#fffdf1'
tmp=$(mktemp -d)
for size in 16 32 48; do rsvg-convert -w $size -h $size favicon.svg -o "$tmp/$size.png"; done
magick "$tmp/16.png" "$tmp/32.png" "$tmp/48.png" favicon.ico
icon() { # size, share of the canvas Blocky fills, output
  inner=$(( $1 * $2 / 100 ))
  rsvg-convert -w $inner -h $inner favicon.svg -o "$tmp/inner.png"
  magick -size "$1x$1" "xc:$PAPER" "$tmp/inner.png" -gravity center -composite -strip "$3"
}
icon 180 72 apple-touch-icon.png
icon 192 64 icon-192.png
icon 512 64 icon-512.png
rm -r "$tmp"
