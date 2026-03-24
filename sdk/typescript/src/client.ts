import { throwForStatus } from './errors.js';

export interface ClientOpts {
  apiKey: string;
  baseUrl?: string;
}

export class OrgoClient {
  readonly apiKey: string;
  readonly baseUrl: string;

  constructor({ apiKey, baseUrl = 'http://localhost:3000' }: ClientOpts) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  async request<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await fetch(url, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
        });

        if (response.status >= 500 && attempt < 2) {
          await new Promise(r => setTimeout(r, 1000 * 2 ** attempt));
          continue;
        }

        // 204 No Content — return undefined
        if (response.status === 204) {
          return undefined as T;
        }

        const contentType = response.headers.get('content-type') || '';
        const data = contentType.includes('json') ? await response.json() : await response.arrayBuffer();

        if (response.status >= 400) {
          throwForStatus(response.status, data as Record<string, unknown>);
        }

        return data as T;
      } catch (err) {
        lastError = err as Error;
        if ((err as { statusCode?: number }).statusCode && (err as { statusCode?: number }).statusCode! < 500) {
          throw err;
        }
        if (attempt < 2) {
          await new Promise(r => setTimeout(r, 1000 * 2 ** attempt));
        }
      }
    }

    throw lastError || new Error('Request failed after 3 retries');
  }

  async get<T = unknown>(path: string): Promise<T> {
    return this.request<T>('GET', path);
  }

  async post<T = unknown>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('POST', path, body);
  }

  async patch<T = unknown>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('PATCH', path, body);
  }

  async delete<T = unknown>(path: string): Promise<T> {
    return this.request<T>('DELETE', path);
  }
}
