# =============================================================================
# Bottleneck Bots Desktop Base Image
# Headless Linux desktop environment for AI agent control
# Target: compressed < 500MB
# =============================================================================

# ---------------------------------------------------------------------------
# Stage 1: Build noVNC + websockify
# ---------------------------------------------------------------------------
FROM ubuntu:24.04 AS novnc-builder

RUN apt-get update && \
    apt-get install -y --no-install-recommends git ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# Clone noVNC (lightweight HTML5 VNC client)
RUN git clone --depth 1 --branch v1.5.0 https://github.com/novnc/noVNC.git /opt/noVNC && \
    rm -rf /opt/noVNC/.git /opt/noVNC/docs /opt/noVNC/tests /opt/noVNC/snap

# Clone websockify (WebSocket-to-TCP proxy for noVNC)
RUN git clone --depth 1 --branch v0.12.0 https://github.com/novnc/websockify.git /opt/noVNC/utils/websockify && \
    rm -rf /opt/noVNC/utils/websockify/.git

# ---------------------------------------------------------------------------
# Stage 2: Runtime image
# ---------------------------------------------------------------------------
FROM ubuntu:24.04

LABEL maintainer="bottleneck-bots"
LABEL description="Headless desktop environment for AI agents"

# Prevent interactive prompts during package installation
ENV DEBIAN_FRONTEND=noninteractive

# Core environment variables
ENV DISPLAY=:99 \
    RESOLUTION=1280x720x24 \
    VNC_PORT=5900 \
    NOVNC_PORT=6080 \
    LANG=en_US.UTF-8 \
    LANGUAGE=en_US:en \
    LC_ALL=en_US.UTF-8

# Install system packages, Node.js 22, and configure locale — single layer
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        # Virtual framebuffer
        xvfb \
        # Lightweight window manager
        fluxbox \
        # VNC server
        x11vnc \
        # Input control for AI agents
        xdotool \
        # Clipboard control
        xclip \
        # Fast screenshot capture
        maim \
        scrot \
        # Video/streaming support
        ffmpeg \
        # Python runtime (for websockify + scripting)
        python3 \
        python3-pip \
        # Image processing
        imagemagick \
        # Privilege de-escalation
        gosu \
        # Utilities
        curl \
        wget \
        git \
        ca-certificates \
        gnupg \
        # Process manager (PID 1)
        tini \
        # Locale support
        locales \
        # X11 utilities (xdpyinfo for health checks)
        x11-utils \
        # File system monitoring
        inotify-tools \
        # Window management utilities
        wmctrl \
        # Socket relay (for event stream proxying)
        socat \
        # Fonts (required for proper text rendering)
        fonts-liberation \
        fonts-dejavu-core \
    && \
    # Install Node.js 22 via NodeSource
    mkdir -p /etc/apt/keyrings && \
    curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg && \
    echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main" > /etc/apt/sources.list.d/nodesource.list && \
    apt-get update && \
    apt-get install -y --no-install-recommends nodejs && \
    # Configure locale
    sed -i '/en_US.UTF-8/s/^# //g' /etc/locale.gen && \
    locale-gen en_US.UTF-8 && \
    # Clean apt cache in same layer
    apt-get clean && \
    rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

# Copy noVNC from builder stage
COPY --from=novnc-builder /opt/noVNC /opt/noVNC

# Create non-root user for running desktop processes
# Ubuntu 24.04 ships with 'ubuntu' user at UID/GID 1000 — remove it first
RUN userdel -r ubuntu 2>/dev/null || true && \
    groupdel ubuntu 2>/dev/null || true && \
    groupadd -g 1000 orgo && \
    useradd -m -u 1000 -g orgo -s /bin/bash orgo && \
    mkdir -p /tmp/orgo-pids /home/orgo/.fluxbox && \
    chown -R orgo:orgo /tmp/orgo-pids /home/orgo

# Copy Fluxbox configuration to a read-only location.
# At runtime, entrypoint.sh copies these to /home/orgo/.fluxbox/ (tmpfs).
# This supports --read-only root filesystem operation.
RUN mkdir -p /etc/orgo/fluxbox
COPY fluxbox/init /etc/orgo/fluxbox/init
COPY fluxbox/keys /etc/orgo/fluxbox/keys
COPY fluxbox/menu /etc/orgo/fluxbox/menu
COPY fluxbox/startup /etc/orgo/fluxbox/startup

# Also install to /home/orgo for non-hardened (writable root) operation
COPY fluxbox/init /home/orgo/.fluxbox/init
COPY fluxbox/keys /home/orgo/.fluxbox/keys
COPY fluxbox/menu /home/orgo/.fluxbox/menu
COPY fluxbox/startup /home/orgo/.fluxbox/startup
RUN chown -R orgo:orgo /home/orgo/.fluxbox

# Copy entrypoint and health check scripts
COPY entrypoint.sh /entrypoint.sh
COPY healthcheck.sh /healthcheck.sh
RUN chmod +x /entrypoint.sh /healthcheck.sh

# Copy action daemon source
COPY action-daemon/ /opt/orgo/action-daemon/

# Copy event monitor source
COPY event-monitor/ /opt/orgo/event-monitor/

RUN chown -R orgo:orgo /opt/orgo

# ---------------------------------------------------------------------------
# Read-only root filesystem support
# ---------------------------------------------------------------------------
# When running with --read-only, these paths need tmpfs mounts:
#   --tmpfs /tmp:rw,noexec,nosuid,size=512m       (Xvfb sockets, PID files, temp)
#   --tmpfs /run:rw,noexec,nosuid,size=64m         (runtime state)
#   --tmpfs /home/orgo:rw,exec,nosuid,size=2g      (user workspace)
#   --tmpfs /var/log:rw,noexec,nosuid,size=128m    (log output)
#
# Mark writable directories as VOLUME so Docker documents the requirement
# and auto-creates anonymous volumes if tmpfs is not explicitly provided.
VOLUME ["/tmp", "/home/orgo", "/var/log", "/run"]

# Expose VNC and noVNC ports
EXPOSE ${VNC_PORT} ${NOVNC_PORT}

# Health check — verify all services are running
HEALTHCHECK --interval=10s --timeout=5s --retries=3 \
    CMD /healthcheck.sh

# Use tini as PID 1 for proper signal handling and zombie reaping
ENTRYPOINT ["/usr/bin/tini", "--", "/entrypoint.sh"]
