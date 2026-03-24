import { getApiUrl, getApiKey, getActiveWorkspace } from './config.js';
import { error, verbose } from './output.js';

export interface ApiError {
  error: string;
  message?: string;
  statusCode?: number;
}

export class ApiRequestError extends Error {
  constructor(
    public statusCode: number,
    public body: ApiError,
  ) {
    super(body.message || body.error || `HTTP ${statusCode}`);
    this.name = 'ApiRequestError';
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  query?: Record<string, string | undefined>;
  timeout?: number;
  workspace?: string;
}

/**
 * Make an authenticated API request.
 * Path should start with `/` and is relative to the API base URL.
 * Example: `/api/v1/workspaces`
 */
export async function api<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query, timeout = 30000 } = options;
  const apiKey = getApiKey();
  const baseUrl = getApiUrl();

  if (!apiKey) {
    error('Not authenticated. Run "bnb login" or set BNB_API_KEY.');
    process.exit(1);
  }

  // Build URL with query parameters
  let url = `${baseUrl.replace(/\/$/, '')}${path}`;
  if (query) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined) params.set(k, v);
    }
    const qs = params.toString();
    if (qs) url += `?${qs}`;
  }

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${apiKey}`,
    'Accept': 'application/json',
  };

  if (body) {
    headers['Content-Type'] = 'application/json';
  }

  verbose(`${method} ${url}`);
  if (body) {
    verbose(`Body: ${JSON.stringify(body)}`);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const resp = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    clearTimeout(timer);

    verbose(`Response: ${resp.status} ${resp.statusText}`);

    if (!resp.ok) {
      let errorBody: ApiError;
      try {
        errorBody = (await resp.json()) as ApiError;
      } catch {
        errorBody = { error: `HTTP ${resp.status}`, message: resp.statusText };
      }
      throw new ApiRequestError(resp.status, errorBody);
    }

    // Handle 204 No Content
    if (resp.status === 204) {
      return undefined as T;
    }

    const data = (await resp.json()) as T;
    verbose(`Data: ${JSON.stringify(data).slice(0, 200)}`);
    return data;
  } catch (err: unknown) {
    clearTimeout(timer);

    if (err instanceof ApiRequestError) {
      throw err;
    }

    if (err instanceof Error && err.name === 'AbortError') {
      error(`Request timed out after ${timeout / 1000}s`);
      process.exit(1);
    }

    const msg = err instanceof Error ? err.message : String(err);
    error(`Network error: ${msg}`);
    error(`Is the API running at ${baseUrl}?`);
    process.exit(1);
  }
}

/**
 * Resolve workspace ID: explicit option > active workspace from config.
 */
export function resolveWorkspace(override?: string): string {
  const ws = override || getActiveWorkspace();
  if (!ws) {
    error('No active workspace. Run "bnb workspaces use <id>" or pass --workspace.');
    process.exit(1);
  }
  return ws;
}

/**
 * Handle API errors with user-friendly messages.
 */
export function handleApiError(err: unknown): never {
  if (err instanceof ApiRequestError) {
    const { statusCode, body } = err;
    if (statusCode === 401 || statusCode === 403) {
      error('Authentication failed. Run "bnb login" to re-authenticate.');
    } else if (statusCode === 404) {
      error(body.message || 'Resource not found.');
    } else if (statusCode === 422) {
      error(`Validation error: ${body.message || 'Invalid input.'}`);
    } else if (statusCode === 429) {
      error('Rate limited. Please wait and try again.');
    } else {
      error(body.message || `API error (${statusCode})`);
    }
  } else if (err instanceof Error) {
    error(err.message);
  } else {
    error(String(err));
  }
  process.exit(1);
}
