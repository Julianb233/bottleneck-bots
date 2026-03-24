# Linux Capability Matrix — Bottleneck Bots Desktop Containers

## Overview

Bottleneck Bots containers run with `--cap-drop ALL` and selectively add back only required capabilities. This document tracks every Linux capability, its status, and the rationale.

---

## Capability Status

| Capability | Status | Required By | Rationale |
|---|---|---|---|
| `CAP_AUDIT_CONTROL` | DROPPED | — | No kernel audit control needed. CVE-2021-22555. |
| `CAP_AUDIT_READ` | DROPPED | — | No audit log reading needed. |
| `CAP_AUDIT_WRITE` | DROPPED | — | No audit log writing needed. |
| `CAP_BLOCK_SUSPEND` | DROPPED | — | No power management needed in containers. |
| `CAP_BPF` | DROPPED | — | No eBPF program loading. CVE-2021-3490. |
| `CAP_CHECKPOINT_RESTORE` | DROPPED | — | No CRIU checkpoint/restore needed. |
| `CAP_CHOWN` | DROPPED | — | File ownership set at build time. Tmpfs mounts are writable. |
| `CAP_DAC_OVERRIDE` | DROPPED | — | No bypassing file permission checks. All files pre-permissioned. |
| `CAP_DAC_READ_SEARCH` | DROPPED | — | No bypassing read/search permission checks. |
| `CAP_FOWNER` | DROPPED | — | No bypassing ownership checks on file operations. |
| `CAP_FSETID` | DROPPED | — | No setuid/setgid bit manipulation. |
| `CAP_IPC_LOCK` | DROPPED | — | No memory locking beyond defaults. |
| `CAP_IPC_OWNER` | DROPPED | — | No bypassing IPC ownership checks. |
| `CAP_KILL` | DROPPED | — | Processes run as same user (orgo); standard kill works within UID. |
| `CAP_LEASE` | DROPPED | — | No file lease operations needed. |
| `CAP_LINUX_IMMUTABLE` | DROPPED | — | No immutable file attribute changes. |
| `CAP_MAC_ADMIN` | DROPPED | — | No MAC (SELinux/AppArmor) policy administration. |
| `CAP_MAC_OVERRIDE` | DROPPED | — | No MAC policy override. |
| `CAP_MKNOD` | DROPPED | — | No device node creation. CVE-2020-15257 (related). |
| `CAP_NET_ADMIN` | DROPPED | — | No network configuration changes. CVE-2020-14386. |
| `CAP_NET_BIND_SERVICE` | DROPPED | — | VNC/noVNC use ports > 1024. No privileged ports needed. |
| `CAP_NET_BROADCAST` | DROPPED | — | No broadcast/multicast needed. |
| `CAP_NET_RAW` | **KEPT** | Network diagnostics | Required for raw socket operations. Only granted because some agent workflows need ping. Consider dropping in production if not needed. |
| `CAP_PERFMON` | DROPPED | — | No performance monitoring access. |
| `CAP_SETFCAP` | DROPPED | — | No file capability manipulation. |
| `CAP_SETGID` | DROPPED | — | Privilege drop handled by gosu at entrypoint before desktop starts. |
| `CAP_SETPCAP` | DROPPED | — | No capability set manipulation. |
| `CAP_SETUID` | DROPPED | — | Privilege drop handled by gosu at entrypoint before desktop starts. |
| `CAP_SYS_ADMIN` | DROPPED | — | Most dangerous capability. Enables mount, namespace, BPF, etc. CVE-2022-0185, CVE-2021-31440. |
| `CAP_SYS_BOOT` | DROPPED | — | No reboot capability. |
| `CAP_SYS_CHROOT` | DROPPED | — | No chroot. CVE-2019-5736 (related). |
| `CAP_SYS_MODULE` | DROPPED | — | No kernel module loading. CVE-2017-0861. |
| `CAP_SYS_NICE` | DROPPED | — | No process priority manipulation. |
| `CAP_SYS_PACCT` | DROPPED | — | No process accounting. |
| `CAP_SYS_PTRACE` | **DEBUG ONLY** | strace, gdb | Only granted with `--debug` flag. Required for debugging Xvfb/xdotool issues. CVE-2019-13615 (related). Never enable in production. |
| `CAP_SYS_RAWIO` | DROPPED | — | No raw I/O port access. |
| `CAP_SYS_RESOURCE` | DROPPED | — | No resource limit override. |
| `CAP_SYS_TIME` | DROPPED | — | No system clock modification. |
| `CAP_SYS_TTY_CONFIG` | DROPPED | — | No terminal configuration. |
| `CAP_SYSLOG` | DROPPED | — | No kernel log access. |
| `CAP_WAKE_ALARM` | DROPPED | — | No wake alarm capability. |

---

## Per-Process Capability Requirements

| Process | Capabilities Needed | Notes |
|---|---|---|
| **Xvfb** | None (runs as user) | Uses MIT-SHM via shmget/shmat (syscalls, not capabilities). Listens on Unix socket. |
| **Fluxbox** | None | Window manager, no privileged operations. |
| **x11vnc** | None | Connects to Xvfb display via Unix socket. Binds to port > 1024. |
| **noVNC/websockify** | None | Python HTTP server on port > 1024. |
| **xdotool** | None | Sends X11 events via DISPLAY connection. |
| **maim/scrot** | None | Reads X11 framebuffer via DISPLAY connection. |
| **node (action-daemon)** | None | HTTP server on port > 1024. |
| **gosu** (entrypoint only) | SETUID, SETGID | Used once during entrypoint to drop from root to orgo user. These caps are available during entrypoint but dropped via `no-new-privileges` after exec. |

---

## CVE References for Dropped Capabilities

| CVE | Capability | Description |
|---|---|---|
| CVE-2022-0185 | SYS_ADMIN | Heap overflow in legacy_parse_param, container escape via user namespace + fsconfig. |
| CVE-2021-31440 | SYS_ADMIN / BPF | eBPF verifier bypass leading to privilege escalation. |
| CVE-2021-3490 | BPF | eBPF ALU32 bounds tracking bug, arbitrary read/write. |
| CVE-2021-22555 | AUDIT_CONTROL | Netfilter heap OOB write, container escape. |
| CVE-2020-14386 | NET_ADMIN | AF_PACKET memory corruption, privilege escalation. |
| CVE-2020-15257 | MKNOD | containerd-shim abstract Unix socket access, container escape. |
| CVE-2019-5736 | SYS_CHROOT | runc container escape via /proc/self/exe overwrite. |
| CVE-2019-13615 | SYS_PTRACE | Process injection via ptrace from container to host. |
| CVE-2017-0861 | SYS_MODULE | Use-after-free in ALSA, kernel code execution via module loading. |

---

## Security Layers Summary

```
Layer 1: User namespace isolation (host UID mapping)
Layer 2: Seccomp profile (syscall allowlist)
Layer 3: Capability dropping (this matrix)
Layer 4: Read-only root filesystem
Layer 5: no-new-privileges flag
Layer 6: Resource limits (memory, CPU, PIDs)
Layer 7: Network isolation (--network none)
Layer 8: [Optional] gVisor runtime (user-space kernel)
Layer 9: [Phase 2] Firecracker micro-VM isolation
```
