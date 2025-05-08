#!/usr/bin/env bash
set -e
set -u

# ─────────────────────────────────────────────────────
# PATH safeguard – works even from GUI shells / cron
# ─────────────────────────────────────────────────────
export PATH="/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"
# quick sanity-check (coreutils + git + python must exist)
for bin in mkdir git python3; do
  command -v "$bin" >/dev/null || {
    echo "❌ '$bin' not found in PATH – current PATH is: $PATH"
    exit 1
  }
done

# ─────────────────────────────────────────────────────
# Standard dirs
# ─────────────────────────────────────────────────────
DATAROOT="${XDG_DATA_HOME:-$HOME/.local/share}"
WORKSPACE="$DATAROOT/summoner"
AGENTS_DIR="$WORKSPACE/agents"
VENVDIR="$WORKSPACE/venv"
PYTHON="$VENVDIR/bin/python"
PIP="$VENVDIR/bin/pip"
SRC="$WORKSPACE/summoner-src"
OPEN_CLIENT="$SRC/open_client.sh"

# ─────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────
ensure_venv() {
  [ -x "$PYTHON" ] || { echo "❌ venv missing at $VENVDIR"; exit 1; }
  # shellcheck source=/dev/null
  source "$VENVDIR/bin/activate"
}

find_unique_name() {                      # <-- fixed
  local base="$1"
  local candidate="$base"
  local i=1
  while [ -d "$AGENTS_DIR/$candidate" ]; do
    candidate="${base}_(${i})"
    ((i++))
  done
  echo "$candidate"
}

# ─────────────────────────────────────────────────────
# download
# ─────────────────────────────────────────────────────
download_agent() {
  local USER="" REPO="" SUBPATH="" BRANCH="main" NAME=""
  while [[ "$#" -gt 0 ]]; do
    case "$1" in
      --user)   USER="$2"; shift ;;
      --repo)   REPO="$2"; shift ;;
      --path)   SUBPATH="$2"; shift ;;
      --branch) BRANCH="$2"; shift ;;
      --name)   NAME="$2"; shift ;;
      *) echo "Unknown option: $1"; exit 1 ;;
    esac
    shift
  done
  [[ -z "$USER" || -z "$REPO" ]] && { echo "❌ --user and --repo required"; exit 1; }

  mkdir -p "$AGENTS_DIR"
  local BASE="agent_${NAME:-$REPO}"
  local TARGET_NAME; TARGET_NAME=$(find_unique_name "$BASE")
  local FINAL_DIR="$AGENTS_DIR/$TARGET_NAME"
  local TMP_DIR="$AGENTS_DIR/_tmp_${TARGET_NAME}.$$"

  echo "📥 Shallow-cloning…"
  git clone --depth 1 --branch "$BRANCH" "https://github.com/$USER/$REPO.git" "$TMP_DIR"

  if [ -n "$SUBPATH" ]; then
    echo "🔄 Sparse-checkout $SUBPATH"
    ( cd "$TMP_DIR"
      git sparse-checkout init --cone
      git sparse-checkout set "$SUBPATH"
      git checkout "$BRANCH" )
    SRC_PATH="$TMP_DIR/$SUBPATH"
  else
    SRC_PATH="$TMP_DIR"
  fi

  echo "📂 Moving files to $FINAL_DIR"
  mv "$SRC_PATH" "$FINAL_DIR"
  [ -d "$FINAL_DIR/.git" ] && rm -rf "$FINAL_DIR/.git"
  rm -rf "$TMP_DIR"

  echo "✅ Agent ready: $FINAL_DIR"
}

# ─────────────────────────────────────────────────────
# install
# ─────────────────────────────────────────────────────
install_agent() {
local SHORT=""
  while [[ "$#" -gt 0 ]]; do
    case "$1" in
      --name) SHORT="$2"; shift ;;
      *) echo "Unknown option: $1"; exit 1 ;;
    esac
    shift
  done
  [ -z "$SHORT" ] && { echo "❌ Missing agent name"; exit 1; }
  local REQ="$AGENTS_DIR/agent_${SHORT}/requirements.txt"
  [ ! -f "$REQ" ] && { echo "⚠️  No requirements.txt"; exit 0; }
  ensure_venv
  "$PIP" install -r "$REQ"
  echo "✅ Dependencies installed"
}

# ─────────────────────────────────────────────────────
# launch
# ─────────────────────────────────────────────────────
launch_agent() {
  local SHORT=""
  while [[ "$#" -gt 0 ]]; do
    case "$1" in
      --name) SHORT="$2"; shift ;;
      *) echo "Unknown option: $1"; exit 1 ;;
    esac
    shift
  done
  [ -z "$SHORT" ] && { echo "❌ Missing --name"; exit 1; }

  local DIR="$AGENTS_DIR/agent_${SHORT}"
  [ ! -f "$DIR/agent.py" ] && { echo "❌ agent.py missing"; exit 1; }

  ensure_venv
  echo "🚀 Launching agent_${SHORT}…"
  bash "$OPEN_CLIENT" "$DIR" "source \"$VENVDIR/bin/activate\" && python agent.py"
}

# ─────────────────────────────────────────────────────
# CLI
# ─────────────────────────────────────────────────────
usage() {
  cat <<EOF
Usage:
  $0 download --user U --repo R [--path SUB] [--branch B] [--name NAME]
  $0 install  --name NAME
  $0 launch   --name NAME
EOF
  exit 1
}

case "$1" in
  download) shift; download_agent "$@";;
  install)  shift; install_agent "$@";;
  launch)   shift; launch_agent "$@";;
  *) usage;;
esac
