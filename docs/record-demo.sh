#!/bin/sh
# Records docs/demo.gif: vhs plays docs/demo.tape against live YouTube Music, then ffmpeg
# shrinks the result. The glow changes every pixel of every frame, so the raw GIF is ~30 MB;
# one shared 64-color palette at 8 fps and 800 px brings it to about 6 MB.
# Needs vhs (which brings ttyd) and ffmpeg. Run from anywhere.
set -e
cd "$(dirname "$0")/.."
raw=$(mktemp --suffix=.gif)
trap 'rm -f "$raw"' EXIT
vhs --quiet --output "$raw" docs/demo.tape
ffmpeg -v error -y -i "$raw" -filter_complex \
  "fps=8,scale=800:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=64[p];[b][p]paletteuse=dither=none:diff_mode=rectangle" \
  docs/demo.gif
echo "docs/demo.gif: $(du -h docs/demo.gif | cut -f1)"
