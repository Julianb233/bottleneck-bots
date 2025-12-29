/**
 * HTTP Request Action for Bottleneck-Bots
 * Make HTTP requests with full configuration support
 */

import {
  BaseAction,
  ActionInput,
  ActionOutput,
  ActionConfigSchema,
  executeWithTimeout,
  calculateRetryDelay,
} from './base';
import { ActionType, DEFAULT_RETRY_CONFIG } from '../types';

/**
 * Supported HTTP methods
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

/**
 * Body content types
 */
export type BodyType = 'json' | 'form' | 'text' | 'none';

/**
 * Response parsing mode
 */
export type ResponseType = 'json' | 'text' | 'auto';

/**
 * HTTP action configuration
 */
export interface HttpActionConfig {
  /** Request URL */
  url: string;
  /** HTTP method */
  method?: HttpMethod;
  /** Request headers */
  headers?: Record<string, string>;
  /** Request body */
  body?: unknown;
  /** Body content type */
  bodyType?: BodyType;
  /** Expected response type */
  responseType?: ResponseType;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Basic authentication */
  auth?: {
    username: string;
    password: string;
  };
  /** Bearer token authentication */
  bearerToken?: string;
  /** Query parameters */
  queryParams?: Record<string, string | number | boolean>;
  /** Follow redirects */
  followRedirects?: boolean;
  /** Expected success status codes (default: 200-299) */
  successCodes?: number[];
}

/**
 * HTTP response data
 */
export interface HttpResponseData {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: unknown;
  url: string;
  redirected: boolean;
}

/**
 * HTTP Action Implementation
 */
export class HttpAction extends BaseAction {
  readonly type = ActionType.HTTP;
  readonly name = 'HTTP Request';
  readonly description = 'Make HTTP requests to external APIs';

  readonly configSchema: ActionConfigSchema = {
    required: [
      {
        name: 'url',
        type: 'string',
        description: 'Request URL',
      },
    ],
    optional: [
      {
        name: 'method',
        type: 'string',
        description: 'HTTP method',
        enumValues: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'],
        defaultValue: 'GET',
      },
      {
        name: 'headers',
        type: 'object',
        description: 'Request headers',
      },
      {
        name: 'body',
        type: 'object',
        description: 'Request body',
      },
      {
        name: 'bodyType',
        type: 'string',
        description: 'Body content type',
        enumValues: ['json', 'form', 'text', 'none'],
        defaultValue: 'json',
      },
      {
        name: 'responseType',
        type: 'string',
        description: 'Expected response type',
        enumValues: ['json', 'text', 'auto'],
        defaultValue: 'auto',
      },
      {
        name: 'timeout',
        type: 'number',
        description: 'Request timeout in milliseconds',
        min: 1000,
        max: 300000,
      },
      {
        name: 'auth',
        type: 'object',
        description: 'Basic authentication credentials',
        sensitive: true,
      },
      {
        name: 'bearerToken',
        type: 'string',
        description: 'Bearer token for authentication',
        sensitive: true,
      },
      {
        name: 'queryParams',
        type: 'object',
        description: 'Query parameters',
      },
      {
        name: 'followRedirects',
        type: 'boolean',
        description: 'Whether to follow redirects',
        defaultValue: true,
      },
      {
        name: 'successCodes',
        type: 'array',
        description: 'Expected success status codes',
      },
    ],
  };

  async execute(input: ActionInput): Promise<ActionOutput> {
    const config = input.interpolatedConfig as unknown as HttpActionConfig;
    const { abortSignal } = input;

    // Build URL with query params
    const url = this.buildUrl(config);

    // Build headers
    const headers = this.buildHeaders(config);

    // Build body
    const body = this.buildBody(config);

    // Execute request with timeout
    const timeout = config.timeout ?? this.getDefaultTimeout();

    const result = await executeWithTimeout(
      () => this.executeRequest(url, config.method ?? 'GET', headers, body, config),
      timeout,
      abortSignal
    );

    return {
      data: result,
      metadata: {
        url,
        method: config.method ?? 'GET',
        statusCode: result.status,
        redirected: result.redirected,
      },
    };
  }

  /**
   * Execute HTTP request
   */
  private async executeRequest(
    url: string,
    method: HttpMethod,
    headers: Record<string, string>,
    body: string | undefined,
    config: HttpActionConfig
  ): Promise<HttpResponseData> {
    const response = await fetch(url, {
      method,
      headers,
      body,
      redirect: config.followRedirects === false ? 'manual' : 'follow',
    });

    // Parse response
    const responseData = await this.parseResponse(response, config.responseType);

    // Extract headers
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    const httpResponse: HttpResponseData = {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      body: responseData,
      url: response.url,
      redirected: response.redirected,
    };

    // Check success codes
    const successCodes = config.successCodes ?? [200, 201, 202, 204];
    const isSuccess = successCodes.includes(response.status) || (response.status >= 200 && response.status < 300);

    if (!isSuccess) {
      const error = new Error(`HTTP ${response.status}: ${response.statusText}`) as Error & { status: number };
      error.status = response.status;
      throw error;
    }

    return httpResponse;
  }

  /**
   * Build URL with query parameters
   */
  private buildUrl(config: HttpActionConfig): string {
    let url = config.url;

    if (config.queryParams) {
      const urlObj = new URL(url);
      for (const [key, value] of Object.entries(config.queryParams)) {
        urlObj.searchParams.set(key, String(value));
      }
      url = urlObj.toString();
    }

    return url;
  }

  /**
   * Build request headers
   */
  private buildHeaders(config: HttpActionConfig): Record<string, string> {
    const headers: Record<string, string> = {};

    // Set content type based on body type
    const bodyType = config.bodyType ?? 'json';
    if (bodyType === 'json') {
      headers['Content-Type'] = 'application/json';
    } else if (bodyType === 'form') {
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
    } else if (bodyType === 'text') {
      headers['Content-Type'] = 'text/plain';
    }

    // Add custom headers
    if (config.headers) {
      for (const [key, value] of Object.entries(config.headers)) {
        headers[key] = value;
      }
    }

    // Add authentication
    if (config.auth) {
      const credentials = Buffer.from(`${config.auth.username}:${config.auth.password}`).toString('base64');
      headers['Authorization'] = `Basic ${credentials}`;
    } else if (config.bearerToken) {
      headers['Authorization'] = `Bearer ${config.bearerToken}`;
    }

    return headers;
  }

  /**
   * Build request body
   */
  private buildBody(config: HttpActionConfig): string | undefined {
    const method = config.method ?? 'GET';

    // No body for GET/HEAD requests
    if (method === 'GET' || method === 'HEAD') {
      return undefined;
    }

    if (!config.body || config.bodyType === 'none') {
      return undefined;
    }

    const bodyType = config.bodyType ?? 'json';

    if (bodyType === 'json') {
      return typeof config.body === 'string' ? config.body : JSON.stringify(config.body);
    }

    if (bodyType === 'form') {
      if (typeof config.body === 'object' && config.body !== null) {
        const params = new URLSearchParams();
        for (const [key, value] of Object.entries(config.body as Record<string, unknown>)) {
          params.set(key, String(value));
        }
        return params.toString();
      }
    }

    if (bodyType === 'text') {
      return String(config.body);
    }

    return undefined;
  }

  /**
   * Parse response based on content type or config
   */
  private async parseResponse(
    response: Response,
    responseType?: ResponseType
  ): Promise<unknown> {
    const contentType = response.headers.get('content-type') || '';

    // If response type is specified, use it
    if (responseType === 'json') {
      try {
        return await response.json();
      } catch {
        return await response.text();
      }
    }

    if (responseType === 'text') {
      return await response.text();
    }

    // Auto-detect based on content type
    if (contentType.includes('application/json')) {
      try {
        return await response.json();
      } catch {
        return await response.text();
      }
    }

    return await response.text();
  }
}

// Export singleton instance
export const httpAction = new HttpAction();
