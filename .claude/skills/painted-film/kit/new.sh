#!/usr/bin/env bash
# bash new.sh <project folder>: a new painted film from the template, with the kit, tools and fonts copied in.
set -euo pipefail
KIT="$(cd "$(dirname "$0")" && pwd)"; DEST="$1"
[ -e "$DEST/index.html" ] && { echo "exists: $DEST"; exit 1; }
mkdir -p "$DEST"/{assets,src,vo,sfx,fonts,out}
cp "$KIT/../template/"* "$DEST/"
cp "$KIT/painted.js" "$KIT/render.mjs" "$KIT/cutout.swift" "$KIT/fetch.py" "$KIT/make_vo.py" "$KIT/make_sfx.py" "$DEST/"
cp "$KIT/fonts/"* "$DEST/fonts/"
echo "new painted film in $DEST: put paintings in src/, cut-outs and web copies in assets/, then edit index.html, voice.json, sfx.json"
