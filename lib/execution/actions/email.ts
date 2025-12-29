/**
 * Email Action for Bottleneck-Bots via Resend
 * Send emails with HTML/text templates and attachments
 */

import {
  BaseAction,
  ActionInput,
  ActionOutput,
  ActionConfigSchema,
  executeWithTimeout,
} from './base';
import { ActionType } from '../types';

/**
 * Email attachment (URL-based)
 */
export interface EmailAttachment {
  /** Attachment filename */
  filename: string;
  /** URL to fetch the attachment content from */
  url?: string;
  /** Base64 encoded content (alternative to URL) */
  content?: string;
  /** Content type (e.g., 'application/pdf') */
  contentType?: string;
}

/**
 * Email recipient with optional name
 */
export interface EmailRecipient {
  email: string;
  name?: string;
}

/**
 * Email action configuration
 */
export interface EmailActionConfig {
  /** Recipient email(s) - string or array */
  to: string | string[] | EmailRecipient | EmailRecipient[];
  /** Email subject */
  subject: string;
  /** HTML email body */
  html?: string;
  /** Plain text email body */
  text?: string;
  /** Sender email (defaults to configured default) */
  from?: string;
  /** Reply-to address */
  replyTo?: string | string[];
  /** CC recipients */
  cc?: string | string[] | EmailRecipient | EmailRecipient[];
  /** BCC recipients */
  bcc?: string | string[] | EmailRecipient | EmailRecipient[];
  /** Email attachments (URLs) */
  attachments?: EmailAttachment[];
  /** Custom headers */
  headers?: Record<string, string>;
  /** Email tags for tracking */
  tags?: Array<{ name: string; value: string }>;
}

/**
 * Resend API response
 */
interface ResendResponse {
  id?: string;
  message?: string;
  statusCode?: number;
  name?: string;
}

/**
 * Email Action Implementation
 */
export class EmailAction extends BaseAction {
  readonly type = ActionType.EMAIL;
  readonly name = 'Send Email';
  readonly description = 'Send emails via Resend with HTML/text templates';

  protected defaultTimeoutMs = 60000; // Emails may take longer

  private readonly RESEND_API_URL = 'https://api.resend.com/emails';
  private readonly DEFAULT_FROM = 'Bottleneck Bots <bots@bottleneckbots.com>';

  readonly configSchema: ActionConfigSchema = {
    required: [
      {
        name: 'to',
        type: 'string',
        description: 'Recipient email address(es)',
      },
      {
        name: 'subject',
        type: 'string',
        description: 'Email subject',
      },
    ],
    optional: [
      {
        name: 'html',
        type: 'string',
        description: 'HTML email body',
      },
      {
        name: 'text',
        type: 'string',
        description: 'Plain text email body',
      },
      {
        name: 'from',
        type: 'string',
        description: 'Sender email address',
      },
      {
        name: 'replyTo',
        type: 'string',
        description: 'Reply-to email address',
      },
      {
        name: 'cc',
        type: 'string',
        description: 'CC recipients',
      },
      {
        name: 'bcc',
        type: 'string',
        description: 'BCC recipients',
      },
      {
        name: 'attachments',
        type: 'array',
        description: 'Email attachments',
      },
      {
        name: 'headers',
        type: 'object',
        description: 'Custom email headers',
      },
      {
        name: 'tags',
        type: 'array',
        description: 'Email tags for tracking',
      },
    ],
  };

  async execute(input: ActionInput): Promise<ActionOutput> {
    const config = input.interpolatedConfig as unknown as EmailActionConfig;
    const { context, abortSignal } = input;

    // Get API key from context or environment
    const apiKey = context.getSecret('RESEND_API_KEY') || process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error('RESEND_API_KEY is not configured');
    }

    // Build payload
    const payload = await this.buildPayload(config);

    // Send email with timeout
    const result = await executeWithTimeout(
      () => this.sendEmail(apiKey, payload),
      this.getDefaultTimeout(),
      abortSignal
    );

    return {
      data: result,
      metadata: {
        messageId: result.messageId,
        recipientCount: Array.isArray(config.to) ? config.to.length : 1,
        hasAttachments: !!(config.attachments?.length),
      },
    };
  }

  /**
   * Build Resend API payload
   */
  private async buildPayload(config: EmailActionConfig): Promise<Record<string, unknown>> {
    const payload: Record<string, unknown> = {};

    // From
    payload.from = config.from || this.DEFAULT_FROM;

    // To
    payload.to = this.processRecipients(config.to);

    // Subject
    payload.subject = config.subject;

    // HTML body
    if (config.html) {
      payload.html = config.html;
    }

    // Text body
    if (config.text) {
      payload.text = config.text;
    }

    // Reply-to
    if (config.replyTo) {
      payload.reply_to = Array.isArray(config.replyTo) ? config.replyTo : config.replyTo;
    }

    // CC
    if (config.cc) {
      payload.cc = this.processRecipients(config.cc);
    }

    // BCC
    if (config.bcc) {
      payload.bcc = this.processRecipients(config.bcc);
    }

    // Headers
    if (config.headers) {
      payload.headers = config.headers;
    }

    // Tags
    if (config.tags) {
      payload.tags = config.tags;
    }

    // Attachments
    if (config.attachments?.length) {
      payload.attachments = await this.processAttachments(config.attachments);
    }

    return payload;
  }

  /**
   * Process recipients
   */
  private processRecipients(
    recipients: string | string[] | EmailRecipient | EmailRecipient[]
  ): string[] {
    const normalized = this.normalizeRecipients(recipients);

    return normalized.map(recipient => {
      if (typeof recipient === 'string') {
        return recipient;
      }

      if (recipient.name) {
        return `${recipient.name} <${recipient.email}>`;
      }
      return recipient.email;
    });
  }

  /**
   * Normalize recipients to array
   */
  private normalizeRecipients(
    recipients: string | string[] | EmailRecipient | EmailRecipient[]
  ): Array<string | EmailRecipient> {
    if (Array.isArray(recipients)) {
      return recipients;
    }
    return [recipients];
  }

  /**
   * Process attachments (fetch URL content if needed)
   */
  private async processAttachments(
    attachments: EmailAttachment[]
  ): Promise<Array<{ filename: string; content: string; type?: string }>> {
    const processed: Array<{ filename: string; content: string; type?: string }> = [];

    for (const attachment of attachments) {
      let content: string;

      if (attachment.content) {
        // Already base64 encoded
        content = attachment.content;
      } else if (attachment.url) {
        // Fetch from URL and encode
        try {
          const response = await fetch(attachment.url);
          if (!response.ok) {
            throw new Error(`Failed to fetch attachment: ${response.status}`);
          }
          const buffer = await response.arrayBuffer();
          content = Buffer.from(buffer).toString('base64');
        } catch (error) {
          throw new Error(
            `Failed to fetch attachment ${attachment.filename}: ${
              error instanceof Error ? error.message : 'Unknown error'
            }`
          );
        }
      } else {
        continue;
      }

      processed.push({
        filename: attachment.filename,
        content,
        type: attachment.contentType,
      });
    }

    return processed;
  }

  /**
   * Send email via Resend API
   */
  private async sendEmail(
    apiKey: string,
    payload: Record<string, unknown>
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const response = await fetch(this.RESEND_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = (await response.json()) as ResendResponse;

    if (!response.ok) {
      throw new Error(`Resend error: ${data.message || data.name || `HTTP ${response.status}`}`);
    }

    return {
      success: true,
      messageId: data.id,
    };
  }
}

// Export singleton instance
export const emailAction = new EmailAction();
