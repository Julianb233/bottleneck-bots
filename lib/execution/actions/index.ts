/**
 * Bot Execution Engine - Actions Module Exports
 * Central export point for action-related functionality
 */

// Base action types and classes
export type {
  IAction,
  ActionInput,
  ActionOutput,
  ValidationResult,
  ActionConfigSchema,
  ActionFieldSchema,
} from "./base";

export {
  BaseAction,
  executeWithTimeout,
  calculateRetryDelay,
} from "./base";

// Action registry
export type {
  ActionRegistrationOptions,
  RegistryStats,
} from "./registry";

export {
  ActionRegistry,
  actionRegistry,
  RegisterAction,
  createAction,
} from "./registry";

// ============================================================================
// Action Implementations
// ============================================================================

// Slack Action
export type {
  SlackActionConfig,
  SlackBlock,
  SlackAttachment,
} from "./slack";

export {
  SlackAction,
  slackAction,
} from "./slack";

// Discord Action
export type {
  DiscordActionConfig,
  DiscordEmbed,
  DiscordEmbedField,
  DiscordEmbedFooter,
  DiscordEmbedAuthor,
  DiscordEmbedMedia,
  DiscordAllowedMentions,
} from "./discord";

export {
  DiscordAction,
  discordAction,
} from "./discord";

// Email Action
export type {
  EmailActionConfig,
  EmailAttachment,
  EmailRecipient,
} from "./email";

export {
  EmailAction,
  emailAction,
} from "./email";

// HTTP Action
export type {
  HttpActionConfig,
  HttpMethod,
  BodyType,
  ResponseType,
  HttpResponseData,
} from "./http";

export {
  HttpAction,
  httpAction,
} from "./http";

// Webhook Action
export type {
  WebhookActionConfig,
  SignatureConfig,
  SignatureAlgorithm,
  SignatureEncoding,
  PayloadFormat,
  WebhookResponseData,
} from "./webhook";

export {
  WebhookAction,
  webhookAction,
} from "./webhook";

// Delay Action
export type {
  DelayActionConfig,
  TimeUnit,
  DelayResultData,
} from "./delay";

export {
  DelayAction,
  delayAction,
  delay,
} from "./delay";

// Filter Action
export type {
  FilterActionConfig,
  FilterCondition,
  ConditionGroup,
  ComparisonOperator,
  LogicalOperator,
  FilterResultData,
  ConditionEvaluation,
} from "./filter";

export {
  FilterAction,
  filterAction,
  filter,
} from "./filter";

// Transform Action
export type {
  TransformActionConfig,
  TransformationType,
  FieldMapping,
  TransformFunction,
  TransformResultData,
} from "./transform";

export {
  TransformAction,
  transformAction,
} from "./transform";

// ============================================================================
// Auto-registration of all actions
// ============================================================================

import { actionRegistry } from "./registry";
import { slackAction } from "./slack";
import { discordAction } from "./discord";
import { emailAction } from "./email";
import { httpAction } from "./http";
import { webhookAction } from "./webhook";
import { delayAction } from "./delay";
import { filterAction } from "./filter";
import { transformAction } from "./transform";

/**
 * Register all built-in actions with the registry
 */
export function registerAllActions(): void {
  const actions = [
    slackAction,
    discordAction,
    emailAction,
    httpAction,
    webhookAction,
    delayAction,
    filterAction,
    transformAction,
  ];

  for (const action of actions) {
    if (!actionRegistry.has(action.type)) {
      actionRegistry.register(action, { override: false });
    }
  }
}

// Auto-register on module load
registerAllActions();

/**
 * Get all registered action types
 */
export function getRegisteredActionTypes(): string[] {
  return actionRegistry.getTypes();
}

/**
 * Get an action by type
 */
export function getAction(type: string) {
  return actionRegistry.get(type as any);
}

/**
 * Check if an action type is registered
 */
export function hasAction(type: string): boolean {
  return actionRegistry.has(type);
}

/**
 * Get all registered actions
 */
export function getAllActions() {
  return actionRegistry.getAll();
}

/**
 * Action categories for UI grouping
 */
export const ActionCategories = {
  communication: {
    name: "Communication",
    description: "Send messages and notifications",
    actions: ["slack", "discord", "email"],
  },
  requests: {
    name: "HTTP Requests",
    description: "Make HTTP requests and webhooks",
    actions: ["http", "webhook"],
  },
  controlFlow: {
    name: "Control Flow",
    description: "Control execution flow",
    actions: ["delay", "filter"],
  },
  data: {
    name: "Data",
    description: "Transform and manipulate data",
    actions: ["transform"],
  },
} as const;

/**
 * Get action info for UI
 */
export function getActionInfo(type: string) {
  const info = actionRegistry.getActionInfo(type as any);
  if (!info) return null;

  // Find category
  let category = "other";
  for (const [cat, catInfo] of Object.entries(ActionCategories)) {
    if ((catInfo.actions as readonly string[]).includes(type)) {
      category = cat;
      break;
    }
  }

  return {
    ...info,
    category,
  };
}

/**
 * Get all actions grouped by category
 */
export function getActionsByCategory() {
  const result: Record<
    string,
    Array<{ type: string; name: string; description: string }>
  > = {};

  for (const [category, info] of Object.entries(ActionCategories)) {
    const actions: Array<{ type: string; name: string; description: string }> = [];
    for (const type of info.actions) {
      const action = actionRegistry.get(type as any);
      if (action) {
        actions.push({
          type: String(action.type),
          name: action.name,
          description: action.description,
        });
      }
    }
    result[category] = actions;
  }

  return result;
}
