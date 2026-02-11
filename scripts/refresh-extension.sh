#!/bin/sh
set -e

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VERSION="$(node -p "require('./package.json').version")"
VSIX_PATH="$REPO_ROOT/virgil-walkthroughs-$VERSION.vsix"

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

# Install into the current app: Cursor has 'cursor', VS Code has 'code'
if command -v cursor >/dev/null 2>&1; then
  echo "Installing VSIX into Cursor..."
  cursor --install-extension "$VSIX_PATH"
elif command -v code >/dev/null 2>&1; then
  echo "Installing VSIX into VS Code..."
  code --install-extension "$VSIX_PATH"
else
  echo "Neither 'cursor' nor 'code' found in PATH. Install manually:"
  echo "  cursor --install-extension $VSIX_PATH"
  echo "  # or: code --install-extension $VSIX_PATH"
  exit 1
fi

echo "Done. Reload the window (or restart the app) to see changes."
echo ""
echo "If the activity bar icon or behavior does not update: uninstall 'Virgil (preview)'"
echo "from Cursor Extensions first, then run this script again and restart Cursor."
