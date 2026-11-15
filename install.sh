#!/usr/bin/env bash
set -euo pipefail

REPO="toxicme1/3D-Company"
INSTALL_DIR="${HOME}/.local/share/3d-company"
BIN_DIR="${HOME}/.local/bin"
COMMAND_PATH="${BIN_DIR}/3DCOMPANY"
ARCHIVE_URL="https://codeload.github.com/${REPO}/tar.gz/refs/heads/main"

if ! command -v curl >/dev/null 2>&1 || ! command -v tar >/dev/null 2>&1; then
  echo "This installer needs curl and tar." >&2
  exit 1
fi
if ! command -v node >/dev/null 2>&1; then
  echo "Install Node.js 18 or newer, then run this installer again." >&2
  exit 1
fi
node -e 'if (Number(process.versions.node.split(".")[0]) < 18) process.exit(1)' || {
  echo "Node.js 18 or newer is required." >&2
  exit 1
}
if [[ -e "$INSTALL_DIR" ]]; then
  echo "Company Floor is already installed at $INSTALL_DIR." >&2
  echo "To protect your saved settings and workspace, this installer will not overwrite it." >&2
  exit 1
fi
if [[ -e "$COMMAND_PATH" || -L "$COMMAND_PATH" ]]; then
  echo "$COMMAND_PATH already exists; refusing to replace it." >&2
  exit 1
fi

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT
mkdir -p "$TMP_DIR/extract" "$HOME/.local/share" "$BIN_DIR"
curl --fail --location --silent --show-error --retry 3 "$ARCHIVE_URL" -o "$TMP_DIR/source.tar.gz"
tar -xzf "$TMP_DIR/source.tar.gz" --strip-components=1 -C "$TMP_DIR/extract"

SOURCE_DIR="$TMP_DIR/extract/Company_Floor"
LAUNCHER="$INSTALL_DIR/company-floor/3DCOMPANY.js"
if [[ ! -f "$SOURCE_DIR/company-floor/3DCOMPANY.js" || ! -f "$SOURCE_DIR/company-floor/api-bridge.js" ]]; then
  echo "The downloaded GitHub archive does not contain the Company Floor launcher." >&2
  exit 1
fi

cp -a "$SOURCE_DIR" "$INSTALL_DIR"
chmod 755 "$LAUNCHER"
ln -s "$LAUNCHER" "$COMMAND_PATH"

echo "Company Floor installed."
if [[ ":$PATH:" != *":$BIN_DIR:"* ]]; then
  echo "$BIN_DIR is not currently on your PATH. Add this to your shell config, then open a new terminal:"
  echo '  echo '\''export PATH="$HOME/.local/bin:$PATH"'\'' >> ~/.bashrc'
  echo "Then run: source ~/.bashrc"
else
  echo "Run: 3DCOMPANY"
fi
