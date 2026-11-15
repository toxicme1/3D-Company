#!/usr/bin/env bash
set -euo pipefail

REPO="toxicme1/3D-Company"
INSTALL_DIR="${HOME}/.local/share/3d-company"
BIN_DIR="${HOME}/.local/bin"
COMMAND_PATH="${BIN_DIR}/3DCOMPANY"
APP_DIR="$INSTALL_DIR"
INSTALL_REF="main"
UPDATE=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --update) UPDATE=1; shift ;;
    --ref)
      [[ $# -ge 2 ]] || { echo "--ref needs a branch name." >&2; exit 2; }
      INSTALL_REF="$2"; shift 2 ;;
    *) echo "Unknown installer option: $1" >&2; exit 2 ;;
  esac
done

if [[ ! "$INSTALL_REF" =~ ^[A-Za-z0-9._/-]+$ || "$INSTALL_REF" == *".."* || "$INSTALL_REF" == /* || "$INSTALL_REF" == */ ]]; then
  echo "Invalid branch name: $INSTALL_REF" >&2
  exit 2
fi

PUBLIC_ARCHIVE_URL="https://codeload.github.com/${REPO}/tar.gz/refs/heads/${INSTALL_REF}"

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
if [[ -d "$INSTALL_DIR/Company_Floor/company-floor" && ! -d "$INSTALL_DIR/company-floor" ]]; then
  APP_DIR="$INSTALL_DIR/Company_Floor"
fi
LAUNCHER="$APP_DIR/company-floor/3DCOMPANY.js"
if [[ "$UPDATE" -eq 1 ]]; then
  if [[ ! -d "$APP_DIR/company-floor" ]]; then
    echo "Company Floor is not installed at $INSTALL_DIR; run the installer without --update first." >&2
    exit 1
  fi
  if [[ ! -L "$COMMAND_PATH" || "$(readlink "$COMMAND_PATH")" != "$LAUNCHER" ]]; then
    echo "$COMMAND_PATH is missing or does not point to this Company Floor installation; refusing to update." >&2
    exit 1
  fi
else
  if [[ -e "$INSTALL_DIR" ]]; then
    echo "Company Floor is already installed at $INSTALL_DIR." >&2
    echo "Use --update to refresh app files while preserving local settings and workspace data." >&2
    exit 1
  fi
  if [[ -e "$COMMAND_PATH" || -L "$COMMAND_PATH" ]]; then
    echo "$COMMAND_PATH already exists; refusing to replace it." >&2
    exit 1
  fi
fi

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT
mkdir -p "$TMP_DIR/extract" "$HOME/.local/share" "$BIN_DIR"
if [[ -n "${GH_TOKEN:-}" ]]; then
  printf 'header = "Authorization: Bearer %s"\nheader = "Accept: application/vnd.github+json"\nurl = "https://api.github.com/repos/%s/tarball/%s"\n' \
    "$GH_TOKEN" "$REPO" "$INSTALL_REF" |
    curl --fail --location --silent --show-error --retry 3 --output "$TMP_DIR/source.tar.gz" --config -
else
  curl --fail --location --silent --show-error --retry 3 "$PUBLIC_ARCHIVE_URL" -o "$TMP_DIR/source.tar.gz"
fi
tar -xzf "$TMP_DIR/source.tar.gz" --strip-components=1 -C "$TMP_DIR/extract"

SOURCE_DIR="$TMP_DIR/extract/Company_Floor"
if [[ ! -f "$SOURCE_DIR/company-floor/3DCOMPANY.js" || ! -f "$SOURCE_DIR/company-floor/api-bridge.js" ]]; then
  echo "The downloaded GitHub archive does not contain the Company Floor launcher." >&2
  exit 1
fi

if [[ "$UPDATE" -eq 1 ]]; then
  cp -a "$SOURCE_DIR/company-floor/." "$APP_DIR/company-floor/"
else
  cp -a "$SOURCE_DIR/." "$INSTALL_DIR/"
fi
chmod 755 "$LAUNCHER"
if [[ "$UPDATE" -eq 0 ]]; then
  ln -s "$LAUNCHER" "$COMMAND_PATH"
  echo "Company Floor installed from $INSTALL_REF."
else
  mkdir -p "$APP_DIR/Workspace/agents"
  for profile in video-researcher script-writer video-editor; do
    source_profile="$SOURCE_DIR/Workspace/agents/$profile.md"
    target_profile="$APP_DIR/Workspace/agents/$profile.md"
    if [[ -f "$source_profile" && ! -e "$target_profile" ]]; then
      cp "$source_profile" "$target_profile"
    fi
  done
  echo "Company Floor updated from $INSTALL_REF. Saved settings and workspace data were preserved."
fi

if [[ ":$PATH:" != *":$BIN_DIR:"* ]]; then
  echo "$BIN_DIR is not currently on your PATH. Add this to your shell config, then open a new terminal:"
  echo '  echo '\''export PATH="$HOME/.local/bin:$PATH"'\'' >> ~/.bashrc'
  echo "Then run: source ~/.bashrc"
else
  echo "Run: 3DCOMPANY"
fi
