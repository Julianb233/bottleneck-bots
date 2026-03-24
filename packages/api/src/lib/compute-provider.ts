/**
 * Specification for creating a virtual machine / container.
 */
export interface VMSpec {
  cpu: number;
  ramMb: number;
  diskGb: number;
  gpu?: string;
  image?: string;
  env?: Record<string, string>;
}

/**
 * Running instance of a VM / container.
 */
export interface VMInstance {
  id: string;
  containerId: string;
  ipAddress: string;
  vncPort: number;
  novncPort: number;
  status: VMStatus;
}

export type VMStatus =
  | 'creating'
  | 'starting'
  | 'running'
  | 'stopping'
  | 'stopped'
  | 'error';

export interface ExecResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface ScreenshotResult {
  /** Base64-encoded PNG image */
  data: string;
  width: number;
  height: number;
  format: 'png';
}

/**
 * Abstract compute provider interface.
 * Implementations can target Docker, cloud VMs, Firecracker, etc.
 */
export interface ComputeProvider {
  /** Create and provision a new VM. */
  create(spec: VMSpec): Promise<VMInstance>;

  /** Start a stopped VM. */
  start(containerId: string): Promise<void>;

  /** Gracefully stop a running VM. */
  stop(containerId: string): Promise<void>;

  /** Destroy a VM and release all resources. */
  destroy(containerId: string): Promise<void>;

  /** Execute a command inside the VM. */
  exec(containerId: string, command: string[]): Promise<ExecResult>;

  /** Capture a screenshot of the VM desktop. */
  screenshot(containerId: string): Promise<ScreenshotResult>;

  /** Get the current status of a VM. */
  status(containerId: string): Promise<VMStatus>;
}
