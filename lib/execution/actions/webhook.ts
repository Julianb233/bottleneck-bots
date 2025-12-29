/**
 * Outgoing Webhook Action for Bottleneck-Bots
 * POST to external URLs with signature generation (HMAC)
 */

import {
  BaseAction,
  ActionInput,
  ActionOutput,
  ActionConfigSchema,
  executeWithTimeout,
} from './base';
import { ActionType } from '../types';
import * as crypto from 'crypto';

/**
 * Signature algorithm options
 */
export type SignatureAlgorithm = 'sha256' | 'sha512' | 'sha1' | 'md5';

/**
 * Signature encoding options
 */
export type SignatureEncoding = 'hex' | 'base64';

/**
 * Signature configuration
 */
export interface SignatureConfig {
  /** Secret key for HMAC signature */
  secret: string;
  /** Algorithm to use */
  algorithm?: SignatureAlgorithm;
  /** Encoding for the signature */
  encoding?: SignatureEncoding;
  /** Header name for the signature */
  headerName?: string;
  /** Prefix for the signature value (e.g., "sha256=") */
  signaturePrefix?: string;
  /** Include timestamp in signature */
  includeTimestamp?: boolean;
  /** Timestamp header name */
  timestampHeader?: string;
}

/**
 * Payload format options
 */
export type PayloadFormat = 'json' | 'form' | 'raw';

/**
 * Webhook action configuration
 */
export interface WebhookActionConfig {
  /** Destination URL */
  url: string;
  /** Custom payload (optional - defaults to trigger data + previous results) */
  payload?: Record<string, unknown>;
  /** Payload format */
  payloadFormat?: PayloadFormat;
  /** Include trigger data in payload */
  includeTriggerData?: boolean;
  /** Include previous results in payload */
  includePreviousResults?: boolean;
  /** HMAC signature configuration */
  signature?: SignatureConfig;
  /** Custom headers */
  headers?: Record<string, string>;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Custom event type header */
  eventType?: string;
  /** Event type header name */
  eventTypeHeader?: string;
}

/**
 * Webhook response data
 */
export interface WebhookResponseData {
  status: number;
  statusText: string;
  body: unknown;
  headers: Record<string, string>;
  signature?: string;
}

/**
 * Webhook Action Implementation
 */
export class WebhookAction extends BaseAction {
  readonly type = ActionType.WEBHOOK;
  readonly name = 'Outgoing Webhook';
  readonly description = 'POST to external URLs with optional HMAC signature';

  private readonly DEFAULT_SIGNATURE_HEADER = 'X-Webhook-Signature';
  private readonly DEFAULT_TIMESTAMP_HEADER = 'X-Webhook-Timestamp';
  private readonly DEFAULT_EVENT_HEADER = 'X-Webhook-Event';

  readonly configSchema: ActionConfigSchema = {
    required: [
      {
        name: 'url',
        type: 'string',
        description: 'Destination webhook URL',
      },
    ],
    optional: [
      {
        name: 'payload',
        type: 'object',
        description: 'Custom payload to send',
      },
      {
        name: 'payloadFormat',
        type: 'string',
        description: 'Payload format',
        enumValues: ['json', 'form', 'raw'],
        defaultValue: 'json',
      },
      {
        name: 'includeTriggerData',
        type: 'boolean',
        description: 'Include trigger data in payload',
        defaultValue: true,
      },
      {
        name: 'includePreviousResults',
        type: 'boolean',
        description: 'Include previous action results in payload',
        defaultValue: false,
      },
      {
        name: 'signature',
        type: 'object',
        description: 'HMAC signature configuration',
        sensitive: true,
      },
      {
        name: 'headers',
        type: 'object',
        description: 'Custom HTTP headers',
      },
      {
        name: 'timeout',
        type: 'number',
        description: 'Request timeout in milliseconds',
        min: 1000,
        max: 300000,
      },
      {
        name: 'eventType',
        type: 'string',
        description: 'Custom event type header value',
      },
      {
        name: 'eventTypeHeader',
        type: 'string',
        description: 'Header name for event type',
      },
    ],
  };

  async execute(input: ActionInput): Promise<ActionOutput> {
    const config = input.interpolatedConfig as unknown as WebhookActionConfig;
    const { context, abortSignal } = input;

    // Build payload
    const payload = this.buildPayload(config, context);
    const payloadString = this.serializePayload(payload, config.payloadFormat);

    // Build headers including signature
    const headers = this.buildHeaders(config, payloadString);

    // Send webhook with timeout
    const timeout = config.timeout ?? this.getDefaultTimeout();

    const result = await executeWithTimeout(
      () => this.sendWebhook(config.url, headers, payloadString),
      timeout,
      abortSignal
    );

    return {
      data: result,
      metadata: {
        url: config.url,
        hasSig: !!config.signature,
        payloadFormat: config.payloadFormat ?? 'json',
      },
    };
  }

  /**
   * Build webhook payload
   */
  private buildPayload(
    config: WebhookActionConfig,
    context: import('../context').ExecutionContext
  ): Record<string, unknown> {
    const payload: Record<string, unknown> = {};
    const state = context.getState();

    // Add custom payload
    if (config.payload) {
      Object.assign(payload, config.payload);
    }

    // Include trigger data
    if (config.includeTriggerData !== false) {
      payload.trigger = state.triggerData;
    }

    // Include previous results
    if (config.includePreviousResults) {
      payload.previousResults = state.actionOutputs;
    }

    // Add metadata
    payload.meta = {
      botId: state.botId,
      runId: state.runId,
      timestamp: new Date().toISOString(),
    };

    return payload;
  }

  /**
   * Serialize payload based on format
   */
  private serializePayload(
    payload: Record<string, unknown>,
    format?: PayloadFormat
  ): string {
    const payloadFormat = format ?? 'json';

    if (payloadFormat === 'json') {
      return JSON.stringify(payload);
    }

    if (payloadFormat === 'form') {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(payload)) {
        params.set(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
      }
      return params.toString();
    }

    // Raw format
    return JSON.stringify(payload);
  }

  /**
   * Build request headers including signature
   */
  private buildHeaders(
    config: WebhookActionConfig,
    payload: string
  ): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': this.getContentType(config.payloadFormat),
      'User-Agent': 'Bottleneck-Bots/1.0',
    };

    // Add custom headers
    if (config.headers) {
      for (const [key, value] of Object.entries(config.headers)) {
        headers[key] = value;
      }
    }

    // Add event type header
    if (config.eventType) {
      const headerName = config.eventTypeHeader ?? this.DEFAULT_EVENT_HEADER;
      headers[headerName] = config.eventType;
    }

    // Add signature
    if (config.signature) {
      const timestamp = Date.now().toString();
      const signatureData = this.generateSignature(config.signature, payload, timestamp);

      headers[signatureData.header] = signatureData.value;

      if (config.signature.includeTimestamp) {
        const timestampHeader = config.signature.timestampHeader ?? this.DEFAULT_TIMESTAMP_HEADER;
        headers[timestampHeader] = timestamp;
      }
    }

    return headers;
  }

  /**
   * Generate HMAC signature
   */
  private generateSignature(
    config: SignatureConfig,
    payload: string,
    timestamp: string
  ): { header: string; value: string } {
    const algorithm = config.algorithm ?? 'sha256';
    const encoding = config.encoding ?? 'hex';
    const headerName = config.headerName ?? this.DEFAULT_SIGNATURE_HEADER;
    const prefix = config.signaturePrefix ?? `${algorithm}=`;

    // Build signature payload
    let signaturePayload = payload;
    if (config.includeTimestamp) {
      signaturePayload = `${timestamp}.${payload}`;
    }

    // Generate HMAC
    const hmac = crypto.createHmac(algorithm, config.secret);
    hmac.update(signaturePayload);
    const signature = hmac.digest(encoding as crypto.BinaryToTextEncoding);

    return {
      header: headerName,
      value: `${prefix}${signature}`,
    };
  }

  /**
   * Get content type based on payload format
   */
  private getContentType(format?: PayloadFormat): string {
    switch (format) {
      case 'form':
        return 'application/x-www-form-urlencoded';
      case 'raw':
        return 'text/plain';
      case 'json':
      default:
        return 'application/json';
    }
  }

  /**
   * Send webhook request
   */
  private async sendWebhook(
    url: string,
    headers: Record<string, string>,
    body: string
  ): Promise<WebhookResponseData> {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body,
    });

    // Parse response
    let responseBody: unknown;
    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      try {
        responseBody = await response.json();
      } catch {
        responseBody = await response.text();
      }
    } else {
      responseBody = await response.text();
    }

    // Extract response headers
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    if (!response.ok) {
      const error = new Error(`Webhook returned ${response.status}: ${response.statusText}`) as Error & { status: number };
      error.status = response.status;
      throw error;
    }

    return {
      status: response.status,
      statusText: response.statusText,
      body: responseBody,
      headers: responseHeaders,
      signature: headers[this.DEFAULT_SIGNATURE_HEADER],
    };
  }
}

// Export singleton instance
export const webhookAction = new WebhookAction();
