#!/bin/bash

# Lists file types not yet implemented in mu-file-viewer
# Excludes already supported formats and source code

SCAN_DIR="$(dirname "$0")/samples"

# Formats already implemented in the viewer
IMPLEMENTED="tga|fbx|glb|bmd|jpg|jpeg|png|bmp|ico|webp|gif|svg|ozj|ozj2|ozb|ozt|mmk|ozp|ozd|wav|ogg|mp3|ttf|woff|woff2|otf|eot"

# Source code / configs (not assets)
SOURCE_CODE="ts|tsx|js|jsx|cs|cpp|c|h|hpp|inl|java|py|go|rs|less|sass|scss|css|shader|glsl|hlsl|html|htm|sql|sh|bat|cmake|xslt|asm|razor|ps1|mak|proto|idl|reg|lua|php|pas|ipp|as|inc|cc|re|pl|pxi|masm|mac|s|l|r|pyx|bash|net"
CONFIG="json|xml|yml|yaml|md|txt|log|ini|cfg|conf|env|lock|prettierrc|prettierignore|gitignore|gitattributes|gitmodules|editorconfig|csproj|sln|unityproj|user|pubxml|resx|rc|aps|cws|prefs|userprefs|properties|rtf|pdf|settings|toml|csv|taurignore|url|hex|qbk|texi|tex|doc|bib|info|dtd|xsl|pot|podspec"

# Generic binaries (not viewable)
BINARIES="dll|so|lib|wasm|jar|apk|zip|rar|pack|idx|rev|mdb|pidb|db|lnk|keystore|csr|exe|exp|pdb|ilk|ipdb|iobj|chm|manifest|0|icns|dbc|gz|7"

# Unity formats (proprietary binaries)
UNITY="mat|controller|asset|assets|prefab|unity|unity3d|sample|dwlt"

# MU Online game data (binary formats specific to MU Online engine)
MU_GAME_DATA="att|att1|map|obj|dat|smd|res|ref|hit|emu|cvi|b32|ein|mpr|mapack|mab|if|v1|v2|club|ssul"

# Deprecated/unsupported media (cannot render in modern browsers)
DEPRECATED_MEDIA="swf|gfx|ozg"

# Debug/crash files (no visual value)
DEBUG_FILES="dmp|testlog"

# IDE/build project files
IDE_PROJECTS="vcxproj|vcproj|filters|dsp|dsw|dcproj|bdsproj|bdsgroup|bpf|props|template|dockerignore|htpasswd|defaults|config|example|old|copied|check_cache|lst|use|unx|osx|dos|mvs|xsd|bak|build_343|plg|opt|ncb|dep|tlog|sbr|suo|idb|lastbuildstate|ipch|pch|bsc|prj|layout|win|err|dir|dev|or|wtf|vsprops|targets|pbxproj|cbp|project|nmake|mkf|mcp|jam|autopkg|autoconf|rules|rpath|compat|cmd|flat|ion|sdf"

# Build system files (autotools, make, etc)
BUILD_SYSTEM="m4|am|in|ac|gperf|sed|guess|sub|sin|nofat|fat|broken|header|patch|yasm|gdbinit|des|dj|attbak|1|cache|unsuccessfulbuild|recipe|done"

# Non-renderable image editors (source art, not final assets)
SOURCE_ART="psd"

# Boost/library-specific files
LIB_SPECIFIC="errwarn|sunwcch"

EXCLUDE="^(${IMPLEMENTED}|${SOURCE_CODE}|${CONFIG}|${BINARIES}|${UNITY}|${MU_GAME_DATA}|${DEPRECATED_MEDIA}|${DEBUG_FILES}|${IDE_PROJECTS}|${BUILD_SYSTEM}|${SOURCE_ART}|${LIB_SPECIFIC})$"

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
