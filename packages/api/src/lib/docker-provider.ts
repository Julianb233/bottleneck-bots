import Docker from 'dockerode';
import type {
  ComputeProvider,
  VMSpec,
  VMInstance,
  VMStatus,
  ExecResult,
  ScreenshotResult,
} from './compute-provider.js';
import { config } from '../config.js';

const docker = new Docker({
  socketPath: config.dockerHost.startsWith('unix://')
    ? config.dockerHost.replace('unix://', '')
    : '/var/run/docker.sock',
});

const DEFAULT_IMAGE = 'bottleneck-desktop-base:latest';
const HEALTH_TIMEOUT_MS = 30_000;
const HEALTH_POLL_MS = 500;

/**
 * Docker-based implementation of the ComputeProvider interface.
 *
 * Creates containers from the bottleneck-desktop image with resource limits,
 * labels for identification, and environment variables for display config.
 */
export class DockerProvider implements ComputeProvider {
  /**
   * Create and start a new container with the given spec.
   * Waits for the container to become healthy before returning.
   */
  async create(spec: VMSpec): Promise<VMInstance> {
    const image = spec.image || DEFAULT_IMAGE;
    const resolution = spec.env?.RESOLUTION || '1280x720x24';

    // Build environment variables
    const env: string[] = [
      'DISPLAY=:99',
      `RESOLUTION=${resolution}`,
    ];
    if (spec.env) {
      for (const [key, value] of Object.entries(spec.env)) {
        if (key !== 'RESOLUTION') {
          env.push(`${key}=${value}`);
        }
      }
    }

    const container = await docker.createContainer({
      Image: image,
      Env: env,
      Labels: {
        'orgo.managed': 'true',
        'orgo.cpu': String(spec.cpu),
        'orgo.ram-mb': String(spec.ramMb),
      },
      HostConfig: {
        Memory: spec.ramMb * 1024 * 1024,
        NanoCpus: spec.cpu * 1e9,
        PidsLimit: 256,
        Init: true,
        PublishAllPorts: true,
        SecurityOpt: ['no-new-privileges'],
      },
      ExposedPorts: {
        '5900/tcp': {},  // VNC
        '6080/tcp': {},  // noVNC
      },
    });

    await container.start();

    // Wait for the container to become healthy / running
    await this.waitForHealthy(container.id, HEALTH_TIMEOUT_MS);

    const info = await container.inspect();
    const ports = info.NetworkSettings.Ports;

    return {
      id: container.id,
      containerId: container.id,
      ipAddress: info.NetworkSettings.IPAddress || '127.0.0.1',
      vncPort: this.getMappedPort(ports, '5900/tcp') ?? 5900,
      novncPort: this.getMappedPort(ports, '6080/tcp') ?? 6080,
      status: 'running',
    };
  }

  /**
   * Start a stopped container and wait for it to become healthy.
   */
  async start(containerId: string): Promise<void> {
    const container = docker.getContainer(containerId);
    await container.start();
    await this.waitForHealthy(containerId, HEALTH_TIMEOUT_MS);
  }

  /**
   * Gracefully stop a running container with a 10-second timeout.
   */
  async stop(containerId: string): Promise<void> {
    const container = docker.getContainer(containerId);
    await container.stop({ t: 10 });
  }

  /**
   * Stop (if running) and remove a container forcefully.
   */
  async destroy(containerId: string): Promise<void> {
    const container = docker.getContainer(containerId);
    try {
      await container.stop({ t: 5 });
    } catch {
      // Container may already be stopped
    }
    await container.remove({ force: true });
  }

  /**
   * Execute a command inside the container and capture output.
   */
  async exec(containerId: string, command: string[]): Promise<ExecResult> {
    const container = docker.getContainer(containerId);
    const exec = await container.exec({
      Cmd: command,
      AttachStdout: true,
      AttachStderr: true,
      Env: ['DISPLAY=:99'],
    });

    const stream = await exec.start({ hijack: true, stdin: false });
    const { stdout, stderr } = await this.collectOutput(stream);
    const inspect = await exec.inspect();

    return {
      exitCode: inspect.ExitCode ?? 1,
      stdout,
      stderr,
    };
  }

  /**
   * Capture a screenshot of the container desktop using maim.
   * Returns base64-encoded PNG data.
   */
  async screenshot(containerId: string): Promise<ScreenshotResult> {
    const result = await this.exec(containerId, [
      'bash',
      '-c',
      'DISPLAY=:99 maim --format png /dev/stdout | base64 -w0',
    ]);

    if (result.exitCode !== 0) {
      throw new Error(`Screenshot failed: ${result.stderr}`);
    }

    return {
      data: result.stdout.trim(),
      width: 1280,
      height: 720,
      format: 'png',
    };
  }

  /**
   * Get the current status of a container by inspecting Docker state.
   * Maps Docker container states to platform VMStatus values.
   */
  async status(containerId: string): Promise<VMStatus> {
    const container = docker.getContainer(containerId);
    const info = await container.inspect();
    const state = info.State;

    if (state.Running) return 'running';
    if (state.Restarting) return 'starting';
    if (state.Paused) return 'stopping';
    if (state.Dead || state.OOMKilled) return 'error';
    return 'stopped';
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private async waitForHealthy(
    containerId: string,
    timeoutMs: number,
  ): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      try {
        const container = docker.getContainer(containerId);
        const info = await container.inspect();
        if (
          info.State.Health?.Status === 'healthy' ||
          info.State.Running
        ) {
          return;
        }
      } catch {
        // Container not ready yet
      }
      await new Promise((r) => setTimeout(r, HEALTH_POLL_MS));
    }
    throw new Error(
      `Container ${containerId} did not become healthy within ${timeoutMs}ms`,
    );
  }

  private getMappedPort(
    ports: Record<string, Array<{ HostPort: string }> | null>,
    key: string,
  ): number | undefined {
    const bindings = ports?.[key];
    if (bindings && bindings.length > 0 && bindings[0]) {
      return parseInt(bindings[0].HostPort, 10);
    }
    return undefined;
  }

  private collectOutput(
    stream: NodeJS.ReadableStream,
  ): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve) => {
      let stdout = '';
      let stderr = '';
      stream.on('data', (chunk: Buffer) => {
        // Docker multiplexed stream: first 8 bytes are header
        const type = chunk[0]; // 1 = stdout, 2 = stderr
        const payload = chunk.slice(8).toString();
        if (type === 2) stderr += payload;
        else stdout += payload;
      });
      stream.on('end', () => resolve({ stdout, stderr }));
      stream.on('error', () => resolve({ stdout, stderr }));
    });
  }
}
