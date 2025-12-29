/**
 * Discord Webhook Action for Bottleneck-Bots
 * Send messages to Discord via webhooks with embed support
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
 * Discord embed field
 */
export interface DiscordEmbedField {
  name: string;
  value: string;
  inline?: boolean;
}

/**
 * Discord embed footer
 */
export interface DiscordEmbedFooter {
  text: string;
  icon_url?: string;
}

/**
 * Discord embed author
 */
export interface DiscordEmbedAuthor {
  name: string;
  url?: string;
  icon_url?: string;
}

/**
 * Discord embed thumbnail/image
 */
export interface DiscordEmbedMedia {
  url: string;
  height?: number;
  width?: number;
}

/**
 * Discord rich embed
 */
export interface DiscordEmbed {
  title?: string;
  description?: string;
  url?: string;
  color?: number;
  timestamp?: string;
  footer?: DiscordEmbedFooter;
  image?: DiscordEmbedMedia;
  thumbnail?: DiscordEmbedMedia;
  author?: DiscordEmbedAuthor;
  fields?: DiscordEmbedField[];
}

/**
 * Discord allowed mentions configuration
 */
export interface DiscordAllowedMentions {
  parse?: Array<'roles' | 'users' | 'everyone'>;
  roles?: string[];
  users?: string[];
  replied_user?: boolean;
}

/**
 * Discord action configuration
 */
export interface DiscordActionConfig {
  /** Discord webhook URL */
  webhookUrl: string;
  /** Message content (supports markdown) */
  content?: string;
  /** Override bot username */
  username?: string;
  /** Override bot avatar URL */
  avatarUrl?: string;
  /** Rich embeds (up to 10) */
  embeds?: DiscordEmbed[];
  /** Text-to-speech */
  tts?: boolean;
  /** Allowed mentions configuration */
  allowedMentions?: DiscordAllowedMentions;
  /** Thread name (creates a thread if webhook supports it) */
  threadName?: string;
}

/**
 * Discord API response
 */
interface DiscordResponse {
  id?: string;
  type?: number;
  channel_id?: string;
  message?: string;
  code?: number;
}

/**
 * Discord Action Implementation
 */
export class DiscordAction extends BaseAction {
  readonly type = ActionType.DISCORD;
  readonly name = 'Discord Message';
  readonly description = 'Send messages to Discord channels via webhooks';

  // Discord embed color presets
  static readonly COLORS = {
    DEFAULT: 0x7289da,
    SUCCESS: 0x43b581,
    WARNING: 0xfaa61a,
    ERROR: 0xf04747,
    INFO: 0x00b0f4,
  };

  readonly configSchema: ActionConfigSchema = {
    required: [
      {
        name: 'webhookUrl',
        type: 'string',
        description: 'Discord webhook URL',
        sensitive: true,
        pattern: /^https:\/\/(discord\.com|discordapp\.com)\/api\/webhooks\//,
      },
    ],
    optional: [
      {
        name: 'content',
        type: 'string',
        description: 'Message content (max 2000 characters)',
      },
      {
        name: 'username',
        type: 'string',
        description: 'Override bot username',
      },
      {
        name: 'avatarUrl',
        type: 'string',
        description: 'Override bot avatar URL',
      },
      {
        name: 'embeds',
        type: 'array',
        description: 'Rich embeds (up to 10)',
      },
      {
        name: 'tts',
        type: 'boolean',
        description: 'Text-to-speech',
      },
      {
        name: 'allowedMentions',
        type: 'object',
        description: 'Allowed mentions configuration',
      },
      {
        name: 'threadName',
        type: 'string',
        description: 'Thread name for thread-enabled webhooks',
      },
    ],
  };

  async execute(input: ActionInput): Promise<ActionOutput> {
    const config = input.interpolatedConfig as unknown as DiscordActionConfig;
    const { abortSignal } = input;

    // Build payload
    const payload = this.buildPayload(config);

    // Build webhook URL with query params
    const webhookUrl = this.buildWebhookUrl(config.webhookUrl);

    // Send to Discord webhook with timeout
    const result = await executeWithTimeout(
      () => this.sendWebhook(webhookUrl, payload),
      this.getDefaultTimeout(),
      abortSignal
    );

    return {
      data: result,
      metadata: {
        messageId: result.messageId,
        channelId: result.channelId,
        hasEmbeds: !!(config.embeds?.length),
      },
    };
  }

  /**
   * Build Discord webhook payload
   */
  private buildPayload(config: DiscordActionConfig): Record<string, unknown> {
    const payload: Record<string, unknown> = {};

    // Content
    if (config.content) {
      payload.content = config.content;
    }

    // Username override
    if (config.username) {
      payload.username = config.username;
    }

    // Avatar override
    if (config.avatarUrl) {
      payload.avatar_url = config.avatarUrl;
    }

    // Text-to-speech
    if (config.tts) {
      payload.tts = config.tts;
    }

    // Embeds
    if (config.embeds?.length) {
      payload.embeds = config.embeds.map(embed => this.processEmbed(embed));
    }

    // Allowed mentions
    if (config.allowedMentions) {
      payload.allowed_mentions = config.allowedMentions;
    }

    // Thread name
    if (config.threadName) {
      payload.thread_name = config.threadName;
    }

    return payload;
  }

  /**
   * Process embed with defaults
   */
  private processEmbed(embed: DiscordEmbed): DiscordEmbed {
    return {
      ...embed,
      timestamp: embed.timestamp || new Date().toISOString(),
    };
  }

  /**
   * Build webhook URL with query parameters
   */
  private buildWebhookUrl(webhookUrl: string): string {
    const url = new URL(webhookUrl);
    // Add wait parameter to get message response
    url.searchParams.set('wait', 'true');
    return url.toString();
  }

  /**
   * Send payload to Discord webhook
   */
  private async sendWebhook(
    webhookUrl: string,
    payload: Record<string, unknown>
  ): Promise<{ success: boolean; messageId?: string; channelId?: string; error?: string }> {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    let responseData: DiscordResponse = {};
    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      responseData = await response.json() as DiscordResponse;
    }

    if (!response.ok) {
      const errorMessage = responseData.message || `HTTP ${response.status}`;
      throw new Error(`Discord webhook failed: ${errorMessage} (code: ${responseData.code || 'unknown'})`);
    }

    return {
      success: true,
      messageId: responseData.id,
      channelId: responseData.channel_id,
    };
  }

  /**
   * Helper to create a simple embed
   */
  static createEmbed(options: {
    title?: string;
    description?: string;
    color?: number;
    url?: string;
    fields?: DiscordEmbedField[];
  }): DiscordEmbed {
    return {
      title: options.title,
      description: options.description,
      color: options.color ?? DiscordAction.COLORS.DEFAULT,
      url: options.url,
      fields: options.fields,
      timestamp: new Date().toISOString(),
    };
  }
}

// Export singleton instance
export const discordAction = new DiscordAction();
