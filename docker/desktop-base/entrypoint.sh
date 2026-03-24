#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# Bottleneck Bots Desktop Entrypoint — Security-Hardened
# Starts headless desktop: Xvfb -> Fluxbox -> x11vnc -> noVNC -> action-daemon
# Runs as root initially for setup, then drops to orgo user via gosu.
# =============================================================================

PID_DIR="/tmp/orgo-pids"
SOCK_DIR="/tmp"
ACTION_SOCK="${SOCK_DIR}/orgo-action.sock"
EVENT_SOCK="${SOCK_DIR}/orgo-events.sock"
ACTION_DAEMON="/opt/orgo/action-daemon/index.js"
EVENT_MONITOR="/opt/orgo/event-monitor/index.js"

# Parse resolution from env (default: 1280x720x24)
RESOLUTION="${RESOLUTION:-1280x720x24}"
IFS='x' read -r WIDTH HEIGHT DEPTH <<< "$RESOLUTION"
WIDTH="${WIDTH:-1280}"
HEIGHT="${HEIGHT:-720}"
DEPTH="${DEPTH:-24}"

VNC_PORT="${VNC_PORT:-5900}"
NOVNC_PORT="${NOVNC_PORT:-6080}"

echo "[orgo] Starting desktop environment: ${WIDTH}x${HEIGHT}x${DEPTH}"

# =============================================================================
# Phase 1: Root setup — create dirs, set permissions
# =============================================================================

mkdir -p "$PID_DIR"
mkdir -p "$(dirname "$ACTION_SOCK")"

# Ensure orgo user owns what it needs
chown -R orgo:orgo "$PID_DIR"
chown orgo:orgo "$SOCK_DIR"
chmod 1777 "$SOCK_DIR"

# Ensure home directory is writable (needed with --read-only + tmpfs)
if [ -d /home/orgo ]; then
    chown -R orgo:orgo /home/orgo
fi

# Copy fluxbox config from read-only root to writable home (tmpfs)
# Required when running with --read-only root filesystem
if [ -d /etc/orgo/fluxbox ] && [ -d /home/orgo ]; then
    mkdir -p /home/orgo/.fluxbox
    cp -a /etc/orgo/fluxbox/* /home/orgo/.fluxbox/ 2>/dev/null || true
    chown -R orgo:orgo /home/orgo/.fluxbox
fi

# Set HOME explicitly for user namespace isolation
export HOME="/home/orgo"

echo "[orgo] Directories prepared, dropping privileges to orgo user"

# =============================================================================
# Phase 2: Drop to orgo user for all desktop processes
# =============================================================================

# The rest runs as orgo via gosu. We use a heredoc executed through gosu bash.
exec gosu orgo bash -s <<'ORGO_MAIN'
set -euo pipefail

PID_DIR="/tmp/orgo-pids"
ACTION_DAEMON="/opt/orgo/action-daemon/index.js"
ACTION_SOCK="/tmp/orgo-action.sock"
EVENT_MONITOR="/opt/orgo/event-monitor/index.js"
EVENT_SOCK="/tmp/orgo-events.sock"

# Re-read env (inherited from parent)
RESOLUTION="${RESOLUTION:-1280x720x24}"
IFS='x' read -r WIDTH HEIGHT DEPTH <<< "$RESOLUTION"
WIDTH="${WIDTH:-1280}"
HEIGHT="${HEIGHT:-720}"
DEPTH="${DEPTH:-24}"
VNC_PORT="${VNC_PORT:-5900}"
NOVNC_PORT="${NOVNC_PORT:-6080}"

# ---- Graceful shutdown handler ----
cleanup() {
    echo "[orgo] Received shutdown signal, cleaning up..."
    for pidfile in "$PID_DIR"/*.pid; do
        [ -f "$pidfile" ] || continue
        pid=$(cat "$pidfile")
        name=$(basename "$pidfile" .pid)
        if kill -0 "$pid" 2>/dev/null; then
            echo "[orgo] Stopping $name (PID $pid)"
            kill -TERM "$pid" 2>/dev/null || true
        fi
    done

    # Give processes 3 seconds to exit gracefully
    sleep 3

    # Force-kill any remaining
    for pidfile in "$PID_DIR"/*.pid; do
        [ -f "$pidfile" ] || continue
        pid=$(cat "$pidfile")
        if kill -0 "$pid" 2>/dev/null; then
            echo "[orgo] Force-killing PID $pid"
            kill -9 "$pid" 2>/dev/null || true
        fi
    done

    echo "[orgo] Shutdown complete"
    exit 0
}

trap cleanup SIGTERM SIGINT

# ---- 1. Start Xvfb ----
echo "[orgo] Starting Xvfb on display :99 (${WIDTH}x${HEIGHT}x${DEPTH})"
Xvfb :99 -screen 0 "${WIDTH}x${HEIGHT}x${DEPTH}" \
    -ac +extension GLX +render -noreset \
    -nolisten tcp &
XVFB_PID=$!
echo "$XVFB_PID" > "$PID_DIR/xvfb.pid"

# Wait for Xvfb to be ready (poll /tmp/.X99-lock, max 5s)
WAITED=0
while [ ! -e /tmp/.X99-lock ] && [ "$WAITED" -lt 50 ]; do
    sleep 0.1
    WAITED=$((WAITED + 1))
done

if [ ! -e /tmp/.X99-lock ]; then
    echo "[orgo] FATAL: Xvfb failed to start within 5s"
    exit 1
fi
echo "[orgo] Xvfb ready after ~$((WAITED * 100))ms"

export DISPLAY=:99

# ---- 2. Start Fluxbox ----
echo "[orgo] Starting Fluxbox window manager"
fluxbox -display :99 &
echo $! > "$PID_DIR/fluxbox.pid"
sleep 0.5

# ---- 3. Start x11vnc ----
echo "[orgo] Starting x11vnc on port ${VNC_PORT}"
x11vnc -display :99 \
    -forever \
    -nopw \
    -shared \
    -rfbport "$VNC_PORT" \
    -xkb \
    -noxdamage \
    -ncache 0 \
    -q &
echo $! > "$PID_DIR/x11vnc.pid"
sleep 0.3

# ---- 4. Start websockify (noVNC proxy) ----
echo "[orgo] Starting websockify (noVNC) on port ${NOVNC_PORT}"
/opt/noVNC/utils/novnc_proxy --vnc localhost:"$VNC_PORT" --listen "$NOVNC_PORT" --web /opt/noVNC &
echo $! > "$PID_DIR/websockify.pid"
sleep 0.3

# ---- 5. Start action daemon ----
if [ -f "$ACTION_DAEMON" ]; then
    echo "[orgo] Starting action daemon"
    ORGO_ACTION_SOCK="$ACTION_SOCK" node "$ACTION_DAEMON" &
    echo $! > "$PID_DIR/action-daemon.pid"

    # Wait briefly for socket to appear
    for _ in $(seq 1 20); do
        [ -S "$ACTION_SOCK" ] && break
        sleep 0.1
    done

    if [ -S "$ACTION_SOCK" ]; then
        echo "[orgo] Action daemon socket ready"
    else
        echo "[orgo] WARNING: Action daemon socket not found after 2s"
    fi
else
    echo "[orgo] Action daemon not found at $ACTION_DAEMON, skipping"
fi

# ---- 6. Start event monitor ----
if [ -f "$EVENT_MONITOR" ]; then
    echo "[orgo] Starting event monitor"
    node "$EVENT_MONITOR" &
    echo $! > "$PID_DIR/event-monitor.pid"

    # Wait briefly for socket to appear
    for _ in $(seq 1 20); do
        [ -S "$EVENT_SOCK" ] && break
        sleep 0.1
    done

    if [ -S "$EVENT_SOCK" ]; then
        echo "[orgo] Event monitor socket ready"
    else
        echo "[orgo] WARNING: Event monitor socket not found after 2s"
    fi
else
    echo "[orgo] Event monitor not found at $EVENT_MONITOR, skipping"
fi

# ---- Ready ----
echo "[orgo] Desktop environment ready"
echo "[orgo]   VNC:   vnc://localhost:${VNC_PORT}"
echo "[orgo]   noVNC: http://localhost:${NOVNC_PORT}/vnc.html"
echo "[orgo]   PIDs:  $(ls "$PID_DIR"/*.pid 2>/dev/null | xargs -I{} basename {} .pid | tr '\n' ' ')"

# Keep container alive — wait on all background children.
# 'wait' is a shell builtin; it blocks until any child exits.
wait -n
EXIT_CODE=$?
echo "[orgo] A child process exited with code $EXIT_CODE"
cleanup
