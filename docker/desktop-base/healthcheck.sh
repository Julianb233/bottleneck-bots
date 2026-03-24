#!/usr/bin/env bash
# =============================================================================
# Bottleneck Bots Desktop Health Check
# Returns 0 if all core services are running, 1 otherwise.
# Used by Docker HEALTHCHECK directive.
# =============================================================================

ERRORS=0

# Check 1: Xvfb is running and display :99 is accessible
if ! xdpyinfo -display :99 >/dev/null 2>&1; then
    echo "[healthcheck] FAIL: Xvfb not responding on display :99"
    ERRORS=$((ERRORS + 1))
fi

# Check 2: x11vnc process is alive
if ! pgrep -x x11vnc >/dev/null 2>&1; then
    echo "[healthcheck] FAIL: x11vnc not running"
    ERRORS=$((ERRORS + 1))
fi

# Check 3: Action daemon socket exists
if ! test -S /tmp/orgo-action.sock; then
    echo "[healthcheck] FAIL: /tmp/orgo-action.sock not found or not a socket"
    ERRORS=$((ERRORS + 1))
fi

# Check 4: Event monitor socket exists
if ! test -S /tmp/orgo-events.sock; then
    echo "[healthcheck] FAIL: /tmp/orgo-events.sock not found or not a socket"
    ERRORS=$((ERRORS + 1))
fi

if [ "$ERRORS" -gt 0 ]; then
    echo "[healthcheck] UNHEALTHY: $ERRORS check(s) failed"
    exit 1
fi

exit 0
