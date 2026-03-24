# gVisor (runsc) Setup for Bottleneck Bots Desktop Containers

## Overview

gVisor provides an additional kernel-level sandbox by intercepting all syscalls through its own user-space kernel (Sentry). This adds defense-in-depth beyond seccomp profiles and capability dropping.

**Status:** Experimental. Not yet validated for production Xvfb workloads.

---

## Installation

### Ubuntu/Debian

```bash
# Add gVisor APT repository
sudo apt-get update && sudo apt-get install -y apt-transport-https ca-certificates curl gnupg

curl -fsSL https://gvisor.dev/archive.key | sudo gpg --dearmor -o /usr/share/keyrings/gvisor-archive-keyring.gpg

echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/gvisor-archive-keyring.gpg] https://storage.googleapis.com/gvisor/releases release main" | sudo tee /etc/apt/sources.list.d/gvisor.list > /dev/null

sudo apt-get update && sudo apt-get install -y runsc
```

### Manual Binary Install

```bash
ARCH=$(uname -m)
URL="https://storage.googleapis.com/gvisor/releases/release/latest/${ARCH}"
wget "${URL}/runsc" "${URL}/containerd-shim-runsc-v1"
chmod a+rx runsc containerd-shim-runsc-v1
sudo mv runsc containerd-shim-runsc-v1 /usr/local/bin
```

---

## Docker Configuration

Add gVisor as an available runtime in `/etc/docker/daemon.json`:

```json
{
  "runtimes": {
    "runsc": {
      "path": "/usr/local/bin/runsc",
      "runtimeArgs": [
        "--platform=systrap",
        "--network=sandbox"
      ]
    },
    "runsc-debug": {
      "path": "/usr/local/bin/runsc",
      "runtimeArgs": [
        "--platform=systrap",
        "--network=sandbox",
        "--debug-log=/tmp/runsc-debug/",
        "--debug",
        "--strace"
      ]
    }
  }
}
```

Restart Docker after editing:

```bash
sudo systemctl restart docker
```

Verify:

```bash
docker run --runtime=runsc --rm hello-world
```

---

## Running Orgo with gVisor

Use the `--gvisor` flag with the hardened run script:

```bash
./docker/security/run-hardened.sh \
  --id 001 \
  --tenant t-abc \
  --workspace ws-xyz \
  --gvisor
```

Or manually:

```bash
docker run --runtime=runsc -d --name orgo-gvisor orgo-desktop
```

---

## Known Limitations with Xvfb / Shared Memory

### 1. MIT-SHM Extension (X Shared Memory)

gVisor's `systrap` platform does **not** support System V shared memory (`shmget`, `shmat`, etc.) in all configurations. Xvfb relies on MIT-SHM for performance.

**Workaround:** Start Xvfb without shared memory:

```bash
Xvfb :99 -screen 0 1280x720x24 -ac +extension GLX +render -noreset -shmem
```

Or set in entrypoint:

```bash
export XVFB_EXTRA_ARGS="-shmem"
```

**Impact:** ~15-30% slower screenshot capture without SHM. Acceptable for most agent workloads.

### 2. /dev/shm Not Available

gVisor does not mount `/dev/shm` by default. Applications expecting POSIX shared memory via `/dev/shm` will fail.

**Workaround:** Mount tmpfs at `/dev/shm`:

```bash
docker run --runtime=runsc --tmpfs /dev/shm:rw,nosuid,nodev,noexec,size=64m ...
```

### 3. Unix Domain Sockets

X11 communication via Unix sockets (`/tmp/.X11-unix/`) works under gVisor but with slightly higher latency (~2-5ms per round-trip vs. ~0.1ms native).

### 4. Unsupported Syscalls

gVisor does not implement all Linux syscalls. Check compatibility:

```bash
runsc --platform=systrap trace -- Xvfb :99 -screen 0 1280x720x24
```

Commonly missing for desktop workloads:
- `io_uring_*` (not needed by our stack)
- Some `ioctl` variants (may affect x11vnc)
- `perf_event_open` (not needed)

---

## Performance Benchmarks

Baseline measurements to collect when evaluating gVisor:

| Metric                    | Native (runc) | gVisor (runsc) | Target    |
|---------------------------|---------------|----------------|-----------|
| Container boot time       | ~200ms        | TBD            | < 2s      |
| Screenshot capture (maim) | ~50ms         | TBD            | < 200ms   |
| xdotool click latency     | ~5ms          | TBD            | < 50ms    |
| Memory overhead           | baseline      | TBD            | < 2x      |
| CPU overhead (idle)       | baseline      | TBD            | < 20%     |

### Running Benchmarks

```bash
# Boot time
time docker run --runtime=runsc --rm orgo-desktop echo "booted"

# Screenshot latency (inside container)
docker exec orgo-gvisor bash -c 'time maim /tmp/test.png'

# xdotool latency
docker exec orgo-gvisor bash -c 'time xdotool mousemove 100 100'
```

---

## Fallback Plan

If gVisor proves incompatible or too slow for production desktop workloads:

1. **Primary mitigation:** Continue using seccomp + capability dropping + read-only root (already provides strong isolation).

2. **Alternative sandboxing options:**
   - **Firecracker micro-VMs** (Phase 2 target) — true VM-level isolation with minimal overhead. This is the planned production isolation boundary.
   - **Kata Containers** — lightweight VMs with OCI compatibility. Heavier than gVisor but full syscall support.
   - **User namespaces** — already implemented in our entrypoint. Maps container root to unprivileged host UID.

3. **Decision criteria for production:**
   - If screenshot latency under gVisor exceeds 200ms consistently: use seccomp-only with Firecracker migration timeline.
   - If boot time exceeds 2s: unacceptable for orgo-clone's sub-500ms target. Fall back to runc + seccomp.
   - If xdotool commands fail or are unreliable: gVisor is not viable for this workload.

4. **Recommended path:** Use gVisor for high-security tenants only (opt-in), keep runc + seccomp as default runtime.
