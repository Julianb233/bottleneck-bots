import { OrgoClient } from './client.js';
import { Computer } from './computer.js';
import type { CreateComputerOpts } from './types.js';

export class Workspace {
  readonly id: string;
  name: string;
  private _client: OrgoClient;

  constructor(client: OrgoClient, data: Record<string, unknown>) {
    this._client = client;
    this.id = data.id as string;
    this.name = (data.name as string) || '';
  }

  static async create(client: OrgoClient, name: string): Promise<Workspace> {
    const data = await client.post<{ workspace: Record<string, unknown> }>('/workspaces', { name });
    return new Workspace(client, data.workspace);
  }

  static async list(client: OrgoClient): Promise<Workspace[]> {
    const data = await client.get<{ workspaces: Record<string, unknown>[] }>('/workspaces');
    return data.workspaces.map(ws => new Workspace(client, ws));
  }

  async get(): Promise<this> {
    const data = await this._client.get<{ workspace: Record<string, unknown> }>(`/workspaces/${this.id}`);
    this.name = data.workspace.name as string;
    return this;
  }

  async update(name: string): Promise<void> {
    await this._client.patch(`/workspaces/${this.id}`, { name });
    this.name = name;
  }

  async delete(opts?: { force?: boolean }): Promise<void> {
    const qs = opts?.force ? '?force=true' : '';
    await this._client.delete(`/workspaces/${this.id}${qs}`);
  }

  async computers(): Promise<Computer[]> {
    const data = await this._client.get<{ computers: Record<string, unknown>[] }>(`/workspaces/${this.id}/computers`);
    return data.computers.map(c => new Computer(this._client, c));
  }

  async createComputer(opts?: Partial<CreateComputerOpts>): Promise<Computer> {
    const data = await this._client.post<{ computer: Record<string, unknown> }>(
      `/workspaces/${this.id}/computers`,
      { name: opts?.name || 'computer', cpu: opts?.cpu || 2, ram: opts?.ram || 4096, resolution: opts?.resolution },
    );
    return new Computer(this._client, data.computer);
  }
}
