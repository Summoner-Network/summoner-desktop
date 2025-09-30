#!/usr/bin/env bash
set -euxo pipefail

# ─────────────────────────────────────────────────────
# Ensure $HOME is defined (macOS GUI apps lose it)
# ─────────────────────────────────────────────────────
if [ -z "${HOME:-}" ] || [ ! -d "$HOME" ]; then
  # Use macOS directory service to find the user’s home
  export HOME="$(dscl . -read /Users/$(whoami) NFSHomeDirectory | awk '{print $2}')"
  echo "⚠️  \$HOME was unset; now set to: $HOME"
fi


# ════════════════════════════════════════════════════════
#                 Paths & Constants
# ════════════════════════════════════════════════════════

DATAROOT="${XDG_DATA_HOME:-$HOME/.local/share}"
WORKSPACE="$DATAROOT/summoner"
ROOT="$(cd "$(dirname "$0")" && pwd)"
SRC="$WORKSPACE/summoner-src"
VENVDIR="$WORKSPACE/venv"
DATA="$SRC/desktop_data"

# ════════════════════════════════════════════════════════
#                  Logging Setup
# ════════════════════════════════════════════════════════

setup_logging() {
  LOG_DIR="$WORKSPACE/logs"
  mkdir -p "$LOG_DIR"
  LOGFILE="$LOG_DIR/start_app_debug.log"
  exec > >(tee -a "$LOGFILE") 2>&1

  echo "🔍 Logging to $LOGFILE"
  echo "🔍 start_app.sh debug start"
  echo "  BASH_SOURCE: ${BASH_SOURCE[0]}"
  echo "  PWD:         $(pwd)"
  echo "  USER:        $USER"
  echo "  SHELL:       $SHELL"
  echo "  PATH:        $PATH"
  echo "  DATAROOT:    $DATAROOT"
  echo "  WORKSPACE:   $WORKSPACE"
  echo
}

# ════════════════════════════════════════════════════════
#          Rust Toolchain (cargo/rustc) Check
# ════════════════════════════════════════════════════════

require_rust() {
  echo "▶ Ensuring Rust toolchain for '$1'"

  if command -v cargo >/dev/null; then
    echo "  ✅ cargo found at $(command -v cargo)"
  else
    echo "  ⚠️  cargo not in PATH"
    [ -f "$HOME/.cargo/env" ] && source "$HOME/.cargo/env" && export PATH="$HOME/.cargo/bin:$PATH"
    [ -x "/opt/homebrew/bin/cargo" ] && export PATH="/opt/homebrew/bin:$PATH"
  fi

  if command -v rustc >/dev/null; then
    echo "  ✅ rustc found at $(command -v rustc)"
  else
    echo "  ⚠️  rustc not in PATH"
  fi

  if ! command -v cargo >/dev/null || ! command -v rustc >/dev/null; then
    echo "❌ Rust toolchain missing. Install via https://rustup.rs/"
    exit 1
  fi
}

# ════════════════════════════════════════════════════════
#           Workspace Bootstrap Logic
# ════════════════════════════════════════════════════════

bootstrap() {
  echo "🔧 Bootstrapping workspace..."
  mkdir -p "$WORKSPACE"

  if [ ! -d "$SRC" ]; then
    echo "📥 Cloning Summoner SDK..."
    git clone --depth 1 https://github.com/Summoner-Network/summoner-core.git "$SRC"
    find "$SRC" -type f -name '*.sh' -exec chmod +x {} \;
  fi

  if [ ! -d "$VENVDIR" ]; then
    echo "🐍 Creating virtualenv..."
    python3 -m venv "$VENVDIR"
  fi

  . "$VENVDIR/bin/activate"
  pip install --upgrade pip setuptools wheel maturin

  cat <<EOF > "$SRC/.env"
DATABASE_URL=postgres://user:pass@localhost:5432/mydb
SECRET_KEY=supersecret
EOF

  echo "🔁 Running reinstall_python_sdk.sh"
  bash "$SRC/reinstall_python_sdk.sh" rust_server_v1_0_0
  echo "✅ Bootstrap complete"
}

# ════════════════════════════════════════════════════════
#                        Dispatch
# ════════════════════════════════════════════════════════

CMD="${1:-}"

case "$CMD" in

  delete)
    echo "▶ delete"
    cd "$HOME"
    rm -rf "$WORKSPACE"
    # mkdir -p "$WORKSPACE"
    # setup_logging
    echo "✅ delete complete"
    ;;

  reset)
    # ensure we’re not inside the soon-to-be-deleted folder
    cd "$HOME"
    rm -rf "$WORKSPACE"
    mkdir -p "$WORKSPACE"
    setup_logging
    echo "▶ reset"
    require_rust "reset"
    bootstrap
    echo "✅ reset complete"
    ;;

  setup)
    setup_logging
    echo "▶ setup"
    require_rust "setup"
    if [ ! -d "$VENVDIR" ]; then
      bootstrap
    else
      . "$VENVDIR/bin/activate"
    fi
    echo "✅ setup complete"
    ;;

  deps)
    setup_logging
    echo "▶ deps"
    require_rust "deps"
    if [ ! -d "$VENVDIR" ]; then
      bootstrap
    else
      . "$VENVDIR/bin/activate"
      bash "$SRC/reinstall_python_sdk.sh" rust_server_v1_0_0
    fi
    echo "✅ deps complete"
    ;;

  run)
    setup_logging
    require_rust "run"
    echo "▶ run"
    [ -z "$2" ] && echo "Missing JSON argument." && exit 1

    if [ ! -d "$VENVDIR" ]; then
      bootstrap
    else
      . "$VENVDIR/bin/activate"
    fi

    echo "$2" > "$WORKSPACE/server_config.json"

    cat > "$WORKSPACE/myserver.py" <<'EOF'
from summoner.server import SummonerServer

if __name__ == "__main__":
    srv = SummonerServer(name="DesktopServer")
    srv.run(config_path="server_config.json")
EOF

    bash "$SRC/open_server.sh" "$WORKSPACE" "source \"$VENVDIR/bin/activate\" && python myserver.py --config server_config.json"
    ;;

  test_server)
    setup_logging
    echo "▶ test_server"
    require_rust "test_server"
    if [ ! -d "$VENVDIR" ]; then
      bootstrap
    else
      . "$VENVDIR/bin/activate"
    fi

    cp "$DATA/default_config.json" "$WORKSPACE/test_server_config.json"

    cat > "$WORKSPACE/test_server.py" <<'EOF'
from summoner.server import SummonerServer

if __name__ == "__main__":
    srv = SummonerServer(name="test_DesktopServer")
    srv.run(config_path="test_server_config.json")
EOF

    bash "$SRC/open_server.sh" "$WORKSPACE" "source \"$VENVDIR/bin/activate\" && python test_server.py --config test_server_config.json"
    ;;

  clean)
    setup_logging
    echo "▶ clean"
    rm -f "$WORKSPACE"/test_*.{log,py,json}
    echo "✅ clean complete"
    ;;

  *)
    echo "Usage: $0 {setup|delete|reset|deps|run '<json>'|test_server|clean}"
    exit 1
    ;;
esac
