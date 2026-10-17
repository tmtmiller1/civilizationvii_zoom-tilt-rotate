#!/usr/bin/env bash
# release.sh: run the quality gate and build the zip for a GitHub release, plus the Steam Workshop manifest.
#
# Usage:  ./release.sh
# Output: dist/zoom-tilt-rotate-vX.Y.Z.zip  (X.Y.Z read from the modinfo <Version>), with zoom-tilt-rotate/ as the
#         zip root so the modinfo sits one folder down, as the game's Mods directory expects.
#         dist/zoom-tilt-rotate-vX.Y.Z-logos.zip and -screenshots.zip for the GitHub release page.
#         dist/preview.png, the Workshop thumbnail, set by hand on the Workshop page.
#         dist/workshop_item_no_preview.vdf, the steamcmd manifest.

set -euo pipefail
cd "$(dirname "$0")"

MOD_ID="zoom-tilt-rotate"
TITLE="Zoom, Tilt, & Rotate"
DIST_DIR="dist"

VERSION="$(grep -oE '<Version>[^<]+</Version>' "$MOD_ID.modinfo" | head -1 | sed -E 's|</?Version>||g')"
[ -n "$VERSION" ] || { echo "error: could not parse <Version> from modinfo"; exit 1; }
grep -q "^## \[$VERSION\]" CHANGELOG.md || { echo "error: CHANGELOG.md has no entry for $VERSION"; exit 1; }

if [ "${SKIP_VERIFY:-0}" != "1" ]; then
    npm run release:gate || { echo "release: 'npm run release:gate' FAILED; aborting."; exit 1; }
fi
command -v xmllint >/dev/null 2>&1 && xmllint --noout text/*/ModText.xml history-corrections/*.xml

ZIP_NAME="$MOD_ID-v${VERSION}.zip"
TARGET_DIR="$DIST_DIR/$MOD_ID"
ZIP_PATH="$DIST_DIR/$ZIP_NAME"

echo "==> Cleaning $DIST_DIR/"
rm -rf "$DIST_DIR"
mkdir -p "$TARGET_DIR/text"

echo "==> Copying the shipped files into $TARGET_DIR/"
cp "$MOD_ID.modinfo" README.md CHANGELOG.md LICENSE "$TARGET_DIR/"
cp -R ui icons history-corrections "$TARGET_DIR/"
for lang in text/*/; do mkdir -p "$TARGET_DIR/$lang"; cp "$lang/ModText.xml" "$TARGET_DIR/$lang"; done
find "$TARGET_DIR" -name '.DS_Store' -delete

echo "==> Syntax-checking the shipped JS"
find "$TARGET_DIR" -name '*.js' -type f -print0 | xargs -0 -n1 node --check

echo "==> Zipping $ZIP_PATH"
( cd "$DIST_DIR" && zip -qr "$ZIP_NAME" "$MOD_ID" )

echo "==> Checking the zip against the allow-list"
ALLOW="^$MOD_ID/($MOD_ID\.modinfo|README\.md|LICENSE|CHANGELOG\.md)$"
ALLOW="$ALLOW"'|^'"$MOD_ID"'/ui/[a-z-]+\.js$'
ALLOW="$ALLOW"'|^'"$MOD_ID"'/icons/[a-z-]+\.png$'
ALLOW="$ALLOW"'|^'"$MOD_ID"'/text/[a-z_]+/ModText\.xml$'
ALLOW="$ALLOW"'|^'"$MOD_ID"'/history-corrections/[a-z-]+-text\.xml$'
UNEXPECTED="$(unzip -Z1 "$ZIP_PATH" | grep -vE '/$' | grep -vE "$ALLOW" || true)"
if [ -n "$UNEXPECTED" ]; then
    echo "error: zip contains entries not on the allow-list:"
    echo "$UNEXPECTED" | sed 's/^/    /'
    exit 1
fi
unzip -l "$ZIP_PATH"

echo "==> Logo and screenshot zips for the GitHub release"
mkdir -p "$DIST_DIR/$MOD_ID-logos" "$DIST_DIR/$MOD_ID-screenshots"
if command -v rsvg-convert >/dev/null 2>&1; then
    rsvg-convert -w 1024 -h 1024 docs/workshop-preview.svg -o docs/workshop-preview.png
fi
cp docs/workshop-preview.png docs/workshop-preview.svg "$DIST_DIR/$MOD_ID-logos/"
cp docs/screenshots/*.jpg "$DIST_DIR/$MOD_ID-screenshots/"
( cd "$DIST_DIR" && zip -qr "$MOD_ID-v${VERSION}-logos.zip" "$MOD_ID-logos" \
    && zip -qr "$MOD_ID-v${VERSION}-screenshots.zip" "$MOD_ID-screenshots" )
cp docs/workshop-preview.png "$DIST_DIR/preview.png"

# steamcmd manifest, without a preview line (a previewfile upload is refused with "Access Denied" and rolls the
# update back) and without a description (the Workshop page text is pasted and kept on Steam by hand, from
# docs/steam-workshop-description.txt). A saved id in steam_workshop_id.txt makes it an update; with none, steamcmd
# creates the item and prints the new id.
PUBLISHED_FILE_ID="$(tr -dc '0-9' 2>/dev/null < steam_workshop_id.txt || true)"
CHANGENOTE="$(awk -v v="$VERSION" '/^## \[/{p=index($0,"["v"]")>0; next} p' CHANGELOG.md \
    | awk '/^- /{if (b) print b; b=$0; next} /^ +/{sub(/^ +/, " "); b=b $0} END{if (b) print b}' \
    | sed 's/^- /• /' | sed -E "s/\"([^\"]*)\"/“\\1”/g; s/\"/”/g")"
{
    echo '"workshopitem"'
    echo '{'
    echo '    "appid"          "1295660"'
    [ -n "$PUBLISHED_FILE_ID" ] && echo "    \"publishedfileid\" \"$PUBLISHED_FILE_ID\""
    echo "    \"contentfolder\"  \"$(pwd)/$TARGET_DIR\""
    echo '    "visibility"     "0"'
    echo "    \"title\"          \"$TITLE\""
    echo "    \"changenote\"     \"[b]Version $VERSION[/b]"
    echo "$CHANGENOTE\""
    echo '}'
} > "$DIST_DIR/workshop_item_no_preview.vdf"

echo "release: $ZIP_PATH ($(du -h "$ZIP_PATH" | cut -f1)), plus -logos.zip, -screenshots.zip, preview.png and"
echo "         workshop_item_no_preview.vdf"
if [ -n "$PUBLISHED_FILE_ID" ]; then
    echo "  UPDATE mode: publishedfileid $PUBLISHED_FILE_ID"
else
    echo "  NEW-ITEM mode: the first upload creates the item; save the id it prints so later runs update it:"
    echo "     echo <publishedfileid> > steam_workshop_id.txt"
fi
