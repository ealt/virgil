#!/bin/sh
set -e

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VSIX_PATH="$REPO_ROOT/virgil-0.1.0.vsix"

echo "Repo: $REPO_ROOT"

cd "$REPO_ROOT"

echo "Installing dependencies..."
npm install

echo "Compiling extension..."
npm run compile

echo "Packaging VSIX..."
npx vsce package --allow-missing-repository \
  --baseContentUrl "https://github.com/ealt/virgil/blob/main" \
  --baseImagesUrl "https://github.com/ealt/virgil/raw/main"

if [ ! -f "$VSIX_PATH" ]; then
  echo "VSIX not found at $VSIX_PATH"
  exit 1
fi

echo "Installing VSIX into Cursor..."
cursor --install-extension "$VSIX_PATH"

echo "Done. Reload the window to see changes."
