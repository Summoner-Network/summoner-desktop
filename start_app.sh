#!/usr/bin/env bash
set -e

# ─────────────────────────────────────────────────────
#               Variables & Paths
# ─────────────────────────────────────────────────────
ROOT="$(cd "$(dirname "$0")" && pwd)"
WORKSPACE="$ROOT/working_space"
SRC="$WORKSPACE/summoner-src"
VENVDIR="$WORKSPACE/venv"
DATA="$SRC/desktop_data"

# ─────────────────────────────────────────────────────
# Bootstrap: clone repo, create venv, reinstall SDK & Rust
# ─────────────────────────────────────────────────────
bootstrap() {
  echo "🔧 Bootstrapping workspace..."
  mkdir -p "$WORKSPACE"

  # Clone if missing
  if [ ! -d "$SRC" ]; then
    echo "📥 Cloning Summoner SDK..."
    git clone --depth 1 https://github.com/Summoner-Network/agent-sdk.git "$SRC"
  fi

  # Create venv if missing
  if [ ! -d "$VENVDIR" ]; then
    echo "🐍 Creating virtualenv..."
    python3 -m venv "$VENVDIR"
  fi

  # Activate venv
  . "$VENVDIR/bin/activate"

  # Ensure build tools
  echo "🔧 Installing build requirements..."
  pip install --upgrade pip setuptools wheel maturin

  # Create the .env file
  cat <<EOF > "$SRC/.env"
LOG_LEVEL=INFO
ENABLE_CONSOLE_LOG=true
DATABASE_URL=postgres://user:pass@localhost:5432/mydb
SECRET_KEY=supersecret
EOF

  # Reinstall Python & Rust SDK via backend scripts
  echo "🔁 Reinstalling Python & Rust SDK..."
  bash "$SRC/reinstall_python_sdk.sh" rust_server_sdk
}

# ─────────────────────────────────────────────────────
# Usage message
# ─────────────────────────────────────────────────────
usage() {
  echo "Usage: $0 {setup|reset|deps|run '<json>'|test_server|clean}"
  exit 1
}

# ─────────────────────────────────────────────────────
# Dispatch
# ─────────────────────────────────────────────────────
case "$1" in
  setup)
    # auto-bootstrap if needed
    if [ ! -d "$VENVDIR" ]; then
      echo "⚠️  Environment not found; running setup..."
      bootstrap
    else
      . "$VENVDIR/bin/activate"
    fi
    echo "✅ Workspace ready at $WORKSPACE"
    exit 0
    ;;

  reset)
    echo "🔄 Resetting workspace..."
    rm -rf "$WORKSPACE"
    bootstrap
    echo "✅ Reset complete"
    exit 0
    ;;

  deps)
    # auto-bootstrap if needed
    if [ ! -d "$VENVDIR" ]; then
      echo "⚠️  Environment not found; running setup..."
      bootstrap
    else
      . "$VENVDIR/bin/activate"
    fi
    bash "$SRC/reinstall_python_sdk.sh" rust_server_sdk
    echo "✅ Dependencies reinstalled"
    exit 0
    ;;

  run)
    # auto-bootstrap if needed
    if [ ! -d "$VENVDIR" ]; then
      echo "⚠️  Environment not found; running setup..."
      bootstrap
    else
      . "$VENVDIR/bin/activate"
    fi

    [ -z "$2" ] && usage
    echo "$2" > "$WORKSPACE/server_config.json"
    cat > "$WORKSPACE/myserver.py" <<'EOF'
from summoner.server import SummonerServer

if __name__ == "__main__":
    srv = SummonerServer(name="ElectronServer")
    srv.run(config_path="server_config.json")
EOF
    LAUNCH_CMD="source \"$VENVDIR/bin/activate\" && python myserver.py --config server_config.json"
    bash "$SRC/open_server.sh" "$WORKSPACE" "$LAUNCH_CMD"
    ;;

  test_server)
    # auto-bootstrap if needed
    if [ ! -d "$VENVDIR" ]; then
      echo "⚠️  Environment not found; running setup..."
      bootstrap
    else
      . "$VENVDIR/bin/activate"
    fi

    DEFAULT_CFG="$DATA/default_config.json"
    if [ ! -f "$DEFAULT_CFG" ]; then
      echo "❌ Default config missing: $DEFAULT_CFG"
      exit 1
    fi
    cp "$DEFAULT_CFG" "$WORKSPACE/server_config.json"
    cat > "$WORKSPACE/test_server.py" <<'EOF'
from summoner.server import SummonerServer

if __name__ == "__main__":
    srv = SummonerServer(name="ElectronTestServer")
    srv.run(config_path="server_config.json")
EOF
    LAUNCH_CMD="source \"$VENVDIR/bin/activate\" && python test_server.py --config server_config.json"
    bash "$SRC/open_server.sh" "$WORKSPACE" "$LAUNCH_CMD"
    ;;

  clean)
    echo "🧹 Cleaning test scripts..."
    rm -f "$WORKSPACE"/test_*.py
    echo "✅ Clean complete"
    exit 0
    ;;

  *)
    usage
    ;;
esac
