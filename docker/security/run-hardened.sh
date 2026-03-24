#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# Bottleneck Bots Hardened Container Launch Script
# Runs a bottleneck-desktop container with full security hardening:
#   - seccomp profile
#   - capability dropping
#   - read-only root filesystem
#   - resource limits
#   - network isolation
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
SECCOMP_PROFILE="$PROJECT_ROOT/docker/desktop-base/seccomp/orgo-seccomp.json"

# Defaults
IMAGE="bottleneck-desktop"
MEMORY="4g"
CPUS="2"
PIDS_LIMIT="256"
NETWORK="none"
DEBUG=false
GVISOR=false

usage() {
    cat <<USAGE
Usage: $(basename "$0") --id <ID> --tenant <TENANT_ID> --workspace <WORKSPACE_ID> [OPTIONS]

Required:
  --id          Container instance ID (used in container name)
  --tenant      Tenant ID label
  --workspace   Workspace ID label

Options:
  --image       Docker image name (default: bottleneck-desktop)
  --memory      Memory limit (default: 4g)
  --cpus        CPU limit (default: 2)
  --pids        PID limit (default: 256)
  --network     Docker network (default: none)
  --debug       Enable SYS_PTRACE for debugging
  --gvisor      Run with gVisor runtime (runsc)
  -h, --help    Show this help

Examples:
  $(basename "$0") --id 001 --tenant t-abc --workspace ws-xyz
  $(basename "$0") --id 002 --tenant t-abc --workspace ws-xyz --debug
  $(basename "$0") --id 003 --tenant t-abc --workspace ws-xyz --gvisor --memory 8g
USAGE
    exit 0
}

# Parse arguments
ID=""
TENANT_ID=""
WORKSPACE_ID=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --id)        ID="$2"; shift 2 ;;
        --tenant)    TENANT_ID="$2"; shift 2 ;;
        --workspace) WORKSPACE_ID="$2"; shift 2 ;;
        --image)     IMAGE="$2"; shift 2 ;;
        --memory)    MEMORY="$2"; shift 2 ;;
        --cpus)      CPUS="$2"; shift 2 ;;
        --pids)      PIDS_LIMIT="$2"; shift 2 ;;
        --network)   NETWORK="$2"; shift 2 ;;
        --debug)     DEBUG=true; shift ;;
        --gvisor)    GVISOR=true; shift ;;
        -h|--help)   usage ;;
        *)           echo "Unknown option: $1"; usage ;;
    esac
done

# Validate required args
if [[ -z "$ID" || -z "$TENANT_ID" || -z "$WORKSPACE_ID" ]]; then
    echo "ERROR: --id, --tenant, and --workspace are required."
    echo ""
    usage
fi

# Validate seccomp profile exists
if [[ ! -f "$SECCOMP_PROFILE" ]]; then
    echo "ERROR: Seccomp profile not found at $SECCOMP_PROFILE"
    exit 1
fi

CONTAINER_NAME="orgo-vm-${ID}"

# Build the docker run command
CMD=(
    docker run -d
    --name "$CONTAINER_NAME"

    # --- Security options ---
    --security-opt no-new-privileges
    --security-opt "seccomp=$SECCOMP_PROFILE"

    # --- Capabilities: drop all, add back only what's needed ---
    --cap-drop ALL
    --cap-add NET_RAW
)

# SYS_PTRACE only in debug mode (needed for strace/gdb)
if [[ "$DEBUG" == true ]]; then
    CMD+=(--cap-add SYS_PTRACE)
    echo "[hardened] Debug mode enabled — SYS_PTRACE granted"
fi

CMD+=(
    # --- Read-only root filesystem ---
    --read-only

    # /tmp — general temp files (noexec prevents binary execution)
    --tmpfs /tmp:rw,noexec,nosuid,size=512m

    # /run — runtime state (PID files, sockets)
    --tmpfs /run:rw,noexec,nosuid,size=64m

    # /home/orgo — user workspace (exec allowed for scripts)
    --tmpfs /home/orgo:rw,exec,nosuid,size=2g

    # /var/log — log output
    --tmpfs /var/log:rw,noexec,nosuid,size=128m

    # --- Resource limits ---
    --memory "$MEMORY"
    --cpus "$CPUS"
    --pids-limit "$PIDS_LIMIT"
    --ulimit nofile=1024:2048

    # --- Network isolation ---
    --network "$NETWORK"

    # --- Labels for orchestrator tracking ---
    --label "tenant_id=$TENANT_ID"
    --label "workspace_id=$WORKSPACE_ID"
    --label "orgo.hardened=true"
    --label "orgo.seccomp=custom"
)

# gVisor runtime
if [[ "$GVISOR" == true ]]; then
    CMD+=(--runtime=runsc)
    echo "[hardened] gVisor runtime enabled"
fi

CMD+=("$IMAGE")

echo "[hardened] Launching container: $CONTAINER_NAME"
echo "[hardened]   Tenant:    $TENANT_ID"
echo "[hardened]   Workspace: $WORKSPACE_ID"
echo "[hardened]   Memory:    $MEMORY"
echo "[hardened]   CPUs:      $CPUS"
echo "[hardened]   Network:   $NETWORK"
echo "[hardened]   Read-only: yes"
echo "[hardened]   Seccomp:   custom profile"

CONTAINER_ID=$("${CMD[@]}")

echo "[hardened] Container started: ${CONTAINER_ID:0:12}"
echo "[hardened] Inspect: docker inspect $CONTAINER_NAME"
