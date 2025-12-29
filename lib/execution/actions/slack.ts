/**
 * Slack Webhook Action for Bottleneck-Bots
 * Send messages to Slack via incoming webhooks with rich formatting support
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
 * Slack Block Kit block types
 */
export interface SlackBlock {
  type: 'section' | 'divider' | 'header' | 'context' | 'actions' | 'image';
  text?: {
    type: 'plain_text' | 'mrkdwn';
    text: string;
    emoji?: boolean;
  };
  block_id?: string;
  accessory?: unknown;
  elements?: unknown[];
  fields?: Array<{
    type: 'plain_text' | 'mrkdwn';
    text: string;
  }>;
  image_url?: string;
  alt_text?: string;
}

/**
 * Slack attachment for legacy formatting
 */
export interface SlackAttachment {
  color?: string;
  pretext?: string;
  author_name?: string;
  author_link?: string;
  author_icon?: string;
  title?: string;
  title_link?: string;
  text?: string;
  fields?: Array<{
    title: string;
    value: string;
    short?: boolean;
  }>;
  image_url?: string;
  thumb_url?: string;
  footer?: string;
  footer_icon?: string;
  ts?: number;
}

/**
 * Slack action configuration
 */
export interface SlackActionConfig {
  /** Slack incoming webhook URL */
  webhookUrl: string;
  /** Message text (supports markdown) */
  message?: string;
  /** Override channel (if allowed by webhook) */
  channel?: string;
  /** Override username */
  username?: string;
  /** Emoji icon (e.g., ":robot:") */
  iconEmoji?: string;
  /** Icon URL (overrides iconEmoji) */
  iconUrl?: string;
  /** Block Kit blocks for rich formatting */
  blocks?: SlackBlock[];
  /** Legacy attachments */
  attachments?: SlackAttachment[];
  /** Thread timestamp to reply in thread */
  threadTs?: string;
  /** Whether to unfurl links */
  unfurlLinks?: boolean;
  /** Whether to unfurl media */
  unfurlMedia?: boolean;
  /** Parse mode */
  mrkdwn?: boolean;
}

/**
 * Slack webhook response
 */
interface SlackResponse {
  ok?: boolean;
  error?: string;
}

/**
 * Slack Action Implementation
 */
export class SlackAction extends BaseAction {
  readonly type = ActionType.SLACK;
  readonly name = 'Slack Message';
  readonly description = 'Send messages to Slack channels via webhooks';

  readonly configSchema: ActionConfigSchema = {
    required: [
      {
        name: 'webhookUrl',
        type: 'string',
        description: 'Slack incoming webhook URL',
        sensitive: true,
        pattern: /^https:\/\/hooks\.slack\.com\/services\//,
      },
    ],
    optional: [
      {
        name: 'message',
        type: 'string',
        description: 'Message text (supports markdown)',
      },
      {
        name: 'channel',
        type: 'string',
        description: 'Override channel',
      },
      {
        name: 'username',
        type: 'string',
        description: 'Override bot username',
      },
      {
        name: 'iconEmoji',
        type: 'string',
        description: 'Emoji icon (e.g., ":robot:")',
      },
      {
        name: 'iconUrl',
        type: 'string',
        description: 'Icon URL (overrides iconEmoji)',
      },
      {
        name: 'blocks',
        type: 'array',
        description: 'Block Kit blocks for rich formatting',
      },
      {
        name: 'attachments',
        type: 'array',
        description: 'Legacy attachments',
      },
      {
        name: 'threadTs',
        type: 'string',
        description: 'Thread timestamp to reply in thread',
      },
      {
        name: 'unfurlLinks',
        type: 'boolean',
        description: 'Whether to unfurl links',
      },
      {
        name: 'unfurlMedia',
        type: 'boolean',
        description: 'Whether to unfurl media',
      },
      {
        name: 'mrkdwn',
        type: 'boolean',
        description: 'Enable markdown parsing',
      },
    ],
  };

  async execute(input: ActionInput): Promise<ActionOutput> {
    const config = input.interpolatedConfig as unknown as SlackActionConfig;
    const { context, abortSignal } = input;

    // Build payload
    const payload = this.buildPayload(config);

    // Send to Slack webhook with timeout
    const result = await executeWithTimeout(
      () => this.sendWebhook(config.webhookUrl, payload),
      this.getDefaultTimeout(),
      abortSignal
    );

    return {
      data: result,
      metadata: {
        webhookUrl: config.webhookUrl.substring(0, 50) + '...',
        hasBlocks: !!(config.blocks?.length),
        hasAttachments: !!(config.attachments?.length),
      },
    };
  }

  /**
   * Build Slack webhook payload
   */
  private buildPayload(config: SlackActionConfig): Record<string, unknown> {
    const payload: Record<string, unknown> = {};

    // Text message
    if (config.message) {
      payload.text = config.message;
    }

    // Channel override
    if (config.channel) {
      payload.channel = this.formatChannel(config.channel);
    }

    // Username override
    if (config.username) {
      payload.username = config.username;
    }

    // Icon
    if (config.iconUrl) {
      payload.icon_url = config.iconUrl;
    } else if (config.iconEmoji) {
      payload.icon_emoji = config.iconEmoji;
    }

    // Thread reply
    if (config.threadTs) {
      payload.thread_ts = config.threadTs;
    }

    // Link unfurling
    if (config.unfurlLinks !== undefined) {
      payload.unfurl_links = config.unfurlLinks;
    }
    if (config.unfurlMedia !== undefined) {
      payload.unfurl_media = config.unfurlMedia;
    }

    // Markdown
    if (config.mrkdwn !== undefined) {
      payload.mrkdwn = config.mrkdwn;
    }

    // Block Kit blocks
    if (config.blocks?.length) {
      payload.blocks = config.blocks;
    }

    // Legacy attachments
    if (config.attachments?.length) {
      payload.attachments = config.attachments;
    }

    return payload;
  }

  /**
   * Send payload to Slack webhook
   */
  private async sendWebhook(
    webhookUrl: string,
    payload: Record<string, unknown>
  ): Promise<{ success: boolean; response?: unknown; error?: string }> {
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const responseText = await response.text();

      if (!response.ok) {
        return {
          success: false,
          error: `Slack webhook failed: ${response.status} - ${responseText}`,
        };
      }

      // Try to parse as JSON
      let responseData: unknown = responseText;
      try {
        responseData = JSON.parse(responseText);
        const parsed = responseData as SlackResponse;
        if (parsed.ok === false) {
          return {
            success: false,
            error: `Slack API error: ${parsed.error || 'Unknown error'}`,
          };
        }
      } catch {
        // Response is plain text (usually "ok")
        if (responseText !== 'ok' && response.status !== 200) {
          return {
            success: false,
            error: `Unexpected Slack response: ${responseText}`,
          };
        }
      }

      return {
        success: true,
        response: responseData,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Format channel name (ensure # prefix for channels, @ for users)
   */
  private formatChannel(channel: string): string {
    if (!channel) return channel;

    // Already formatted
    if (channel.startsWith('#') || channel.startsWith('@') || channel.startsWith('C') || channel.startsWith('U')) {
      return channel;
    }

    // Assume it's a channel name
    return `#${channel}`;
  }
}

// Export singleton instance
export const slackAction = new SlackAction();
