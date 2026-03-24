import { OrgoClient } from './client.js';
import type { ComputerStatus, ComputerSpec, ExecResult, CreateComputerOpts, ScreenshotOpts, ScrollOpts, Action, ActionResult } from './types.js';

export class Computer {
  readonly id: string;
  status: ComputerStatus;
  specs: ComputerSpec;
  private _client: OrgoClient;
  private _vncUrl: string | null;
  private _novncUrl: string | null;

  constructor(client: OrgoClient, data: Record<string, unknown>) {
    this._client = client;
    this.id = data.id as string;
    this.status = (data.status as ComputerStatus) || 'creating';
    this.specs = (data.specs as ComputerSpec) || {};
    this._vncUrl = (data.vncUrl ?? data.vnc_url ?? null) as string | null;
    this._novncUrl = (data.novncUrl ?? data.novnc_url ?? null) as string | null;
  }

  static async create(opts: CreateComputerOpts): Promise<Computer> {
    const client = new OrgoClient({ apiKey: opts.apiKey, baseUrl: opts.baseUrl });

    let workspaceId = opts.workspaceId;
    if (!workspaceId) {
      const ws = await client.post<{ workspace: { id: string } }>('/workspaces', { name: opts.name || 'default' });
      workspaceId = ws.workspace.id;
    }

    const data = await client.post<{ computer: Record<string, unknown> }>(
      `/workspaces/${workspaceId}/computers`,
      { name: opts.name || 'computer', cpu: opts.cpu || 2, ram: opts.ram || 4096, resolution: opts.resolution || '1280x720x24' },
    );

    return new Computer(client, data.computer);
  }

  async screenshot(opts?: ScreenshotOpts): Promise<Buffer> {
    const b64 = await this.screenshotBase64(opts);
    return Buffer.from(b64, 'base64');
  }

  async screenshotBase64(opts?: ScreenshotOpts): Promise<string> {
    const params = new URLSearchParams();
    if (opts?.format) params.set('format', opts.format);
    if (opts?.quality) params.set('quality', String(opts.quality));
    const qs = params.toString() ? `?${params}` : '';
    const data = await this._client.get<{ image: string }>(`/computers/${this.id}/screenshot${qs}`);
    return data.image;
  }

  async click(x: number, y: number): Promise<void> {
    await this._client.post(`/computers/${this.id}/click`, { x, y });
  }

  async rightClick(x: number, y: number): Promise<void> {
    await this._client.post(`/computers/${this.id}/right-click`, { x, y });
  }

  async doubleClick(x: number, y: number): Promise<void> {
    await this._client.post(`/computers/${this.id}/double-click`, { x, y });
  }

  async scroll(x: number, y: number, opts?: ScrollOpts): Promise<void> {
    await this._client.post(`/computers/${this.id}/scroll`, { x, y, ...opts });
  }

  async drag(startX: number, startY: number, endX: number, endY: number): Promise<void> {
    await this._client.post(`/computers/${this.id}/drag`, { start_x: startX, start_y: startY, end_x: endX, end_y: endY });
  }

  async move(x: number, y: number): Promise<void> {
    await this._client.post(`/computers/${this.id}/move`, { x, y });
  }

  async type(text: string): Promise<void> {
    await this._client.post(`/computers/${this.id}/type`, { text });
  }

  async key(combo: string): Promise<void> {
    await this._client.post(`/computers/${this.id}/key`, { key: combo });
  }

  async bash(command: string, opts?: { timeout?: number }): Promise<ExecResult> {
    const data = await this._client.post<Record<string, unknown>>(`/computers/${this.id}/bash`, { command, timeout: opts?.timeout });
    const d = (data.data || data) as Record<string, unknown>;
    return { stdout: d.stdout as string || '', stderr: d.stderr as string || '', exitCode: d.exit_code as number || 0, durationMs: d.duration_ms as number || 0 };
  }

  async exec(code: string, opts?: { language?: string }): Promise<ExecResult> {
    const data = await this._client.post<Record<string, unknown>>(`/computers/${this.id}/exec`, { code, language: opts?.language });
    const d = (data.data || data) as Record<string, unknown>;
    return { stdout: d.stdout as string || '', stderr: d.stderr as string || '', exitCode: d.exit_code as number || 0, durationMs: d.duration_ms as number || 0 };
  }

  async clipboardRead(): Promise<string> {
    const data = await this._client.get<{ data: { text: string } }>(`/computers/${this.id}/clipboard`);
    return data.data?.text || '';
  }

  async clipboardWrite(text: string): Promise<void> {
    await this._client.post(`/computers/${this.id}/clipboard`, { text });
  }

  async actions(actions: Action[]): Promise<ActionResult[]> {
    const data = await this._client.post<{ results: ActionResult[] }>(`/computers/${this.id}/actions`, { actions });
    return data.results;
  }

  async refresh(): Promise<void> {
    const data = await this._client.get<{ computer: Record<string, unknown> }>(`/computers/${this.id}`);
    this.status = data.computer.status as ComputerStatus;
    this.specs = (data.computer.specs as ComputerSpec) || {};
  }

  async stop(): Promise<void> {
    await this._client.post(`/computers/${this.id}/stop`);
    this.status = 'stopping';
  }

  async start(): Promise<void> {
    await this._client.post(`/computers/${this.id}/start`);
    this.status = 'starting';
  }

  async destroy(): Promise<void> {
    await this._client.delete(`/computers/${this.id}`);
  }

  get vncUrl(): string | null { return this.status === 'running' ? this._vncUrl : null; }
  get novncUrl(): string | null { return this.status === 'running' ? this._novncUrl : null; }
}
