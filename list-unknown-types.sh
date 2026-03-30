#!/bin/bash

# Lists file types not yet implemented in mu-file-viewer
# Excludes already supported formats and source code

SCAN_DIR="$(dirname "$0")/samples"

# Formats already implemented in the viewer
IMPLEMENTED="tga|fbx|glb|bmd|jpg|jpeg|png|bmp|ico|webp|gif|svg|ozj|ozj2|ozb|ozt|mmk|ozp|ozd|wav|ogg|ttf|woff|woff2|otf|eot"

# Source code / configs (not assets)
SOURCE_CODE="ts|tsx|js|jsx|cs|cpp|c|h|hpp|inl|java|py|go|rs|less|sass|scss|css|shader|glsl|hlsl|html|sql|sh|bat|cmake|xslt|asm|razor|ps1|mak|proto|idl|reg|lua|php|pas"
CONFIG="json|xml|yml|yaml|md|txt|log|ini|cfg|conf|env|lock|prettierrc|prettierignore|gitignore|gitattributes|gitmodules|editorconfig|csproj|sln|unityproj|user|pubxml|resx|rc|aps|cws|prefs|userprefs|properties|rtf|pdf|settings|toml|csv|taurignore"

# Generic binaries (not viewable)
BINARIES="dll|so|lib|wasm|jar|apk|zip|rar|pack|idx|rev|mdb|pidb|db|lnk|keystore|csr|exe|exp|pdb|ilk|ipdb|iobj|chm|manifest|0|icns|dbc"

# Unity formats (proprietary binaries)
UNITY="mat|controller|asset|assets|prefab|unity|unity3d|sample|dwlt"

# MU Online proprietary formats (not viewable)
MU_PROPRIETARY="att|att1|map|obj|dat|smd|res|ref|hit|emu|cvi|b32|ozg"

# IDE/build project files
IDE_PROJECTS="vcxproj|vcproj|filters|dsp|dsw|dcproj|bdsproj|bdsgroup|bpf|props|template|dockerignore|htpasswd|defaults|config|example|old|copied|check_cache|lst|use|unx|osx|dos|mvs|xsd|bak|build_343|plg|opt|ncb|dep|tlog|sbr|suo|idb|lastbuildstate|ipch|pch|bsc|prj|layout|win|err|dir|dev|or|wtf"

EXCLUDE="^(${IMPLEMENTED}|${SOURCE_CODE}|${CONFIG}|${BINARIES}|${UNITY}|${MU_PROPRIETARY}|${IDE_PROJECTS})$"

echo "Scanning: $SCAN_DIR"
echo "---"
find "$SCAN_DIR" -type f -name "*.*" \
  | sed 's/.*\///' \
  | grep '\.' \
  | sed 's/.*\.//' \
  | grep -E '^[a-zA-Z0-9]+$' \
  | tr '[:upper:]' '[:lower:]' \
  | grep -v -E "$EXCLUDE" \
  | sort \
  | uniq -c \
  | sort -rn
