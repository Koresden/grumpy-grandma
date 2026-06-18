#!/usr/bin/env bash
# Download the official, self-contained Node binary that gets bundled into the .app as Tauri's
# externalBin. It's gitignored (115MB > GitHub's 100MB limit), so fetch it before `tauri build`.
#
# Usage:  ./fetch-node.sh            # latest LTS, arm64
#         NODE_VERSION=v24.16.0 ./fetch-node.sh
set -euo pipefail
cd "$(dirname "$0")"

TRIPLE="$(rustc -vV | awk '/host:/{print $2}')"      # e.g. aarch64-apple-darwin
ARCH="${TRIPLE%%-*}"
case "$ARCH" in aarch64) NARCH=arm64 ;; x86_64) NARCH=x64 ;; *) echo "unsupported arch: $ARCH"; exit 1 ;; esac

VER="${NODE_VERSION:-$(curl -fsSL https://nodejs.org/dist/index.json | python3 -c "import sys,json;print(next(x['version'] for x in json.load(sys.stdin) if x['lts']))")}"
URL="https://nodejs.org/dist/${VER}/node-${VER}-darwin-${NARCH}.tar.gz"

echo "Fetching official Node ${VER} (${NARCH}) …"
TMP="$(mktemp -d)"
curl -fsSL "$URL" -o "$TMP/node.tar.gz"
tar xzf "$TMP/node.tar.gz" -C "$TMP"
cp "$TMP/node-${VER}-darwin-${NARCH}/bin/node" "node-${TRIPLE}"
chmod +x "node-${TRIPLE}"
rm -rf "$TMP"

# sanity: must be self-contained (no non-system dylibs)
DEPS="$(otool -L "node-${TRIPLE}" | tail -n +2 | grep -vcE '/usr/lib/|/System/' || true)"
echo "Bundled node-${TRIPLE} ($(du -h "node-${TRIPLE}" | cut -f1)); non-system deps: ${DEPS} (want 0)"
"./node-${TRIPLE}" --version
