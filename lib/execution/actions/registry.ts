/**
 * Bot Execution Engine - Action Registry
 * Central registry for registering and retrieving action implementations
 */

import { ActionType } from "../types";
import { IAction, ValidationResult } from "./base";

/**
 * Registry entry for an action
 */
interface ActionRegistryEntry {
  /** Action implementation */
  action: IAction;
  /** Registration timestamp */
  registeredAt: Date;
  /** Whether the action is enabled */
  enabled: boolean;
  /** Action metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Registry options for action registration
 */
export interface ActionRegistrationOptions {
  /** Override existing registration */
  override?: boolean;
  /** Action metadata */
  metadata?: Record<string, unknown>;
  /** Whether the action is enabled */
  enabled?: boolean;
}

/**
 * Registry statistics
 */
export interface RegistryStats {
  /** Total registered actions */
  totalActions: number;
  /** Enabled actions count */
  enabledActions: number;
  /** Disabled actions count */
  disabledActions: number;
  /** Action types registered */
  actionTypes: ActionType[];
}

/**
 * ActionRegistry manages all available action implementations.
 * Provides registration, retrieval, and validation capabilities.
 */
export class ActionRegistry {
  private actions: Map<ActionType, ActionRegistryEntry> = new Map();
  private aliases: Map<string, ActionType> = new Map();

  /**
   * Register an action implementation
   */
  register(action: IAction, options: ActionRegistrationOptions = {}): void {
    const { override = false, metadata, enabled = true } = options;

    if (this.actions.has(action.type) && !override) {
      throw new Error(
        `Action type "${action.type}" is already registered. Use override: true to replace.`
      );
    }

    this.actions.set(action.type, {
      action,
      registeredAt: new Date(),
      enabled,
      metadata,
    });

    console.log(`Registered action: ${action.type} (${action.name})`);
  }

  /**
   * Register an alias for an action type
   */
  registerAlias(alias: string, actionType: ActionType): void {
    if (!this.actions.has(actionType)) {
      throw new Error(`Cannot create alias "${alias}": action type "${actionType}" not registered`);
    }

    if (this.aliases.has(alias)) {
      throw new Error(`Alias "${alias}" is already registered`);
    }

    this.aliases.set(alias, actionType);
  }

  /**
   * Unregister an action
   */
  unregister(type: ActionType): boolean {
    const deleted = this.actions.delete(type);

    // Remove any aliases pointing to this type
    for (const [alias, actionType] of this.aliases.entries()) {
      if (actionType === type) {
        this.aliases.delete(alias);
      }
    }

    return deleted;
  }

  /**
   * Get an action by type
   */
  get(type: ActionType | string): IAction | undefined {
    // Check if it's an alias first
    const resolvedType = this.aliases.get(type) || (type as ActionType);

    const entry = this.actions.get(resolvedType);
    if (!entry) return undefined;

    // Return only if enabled
    return entry.enabled ? entry.action : undefined;
  }

  /**
   * Get an action regardless of enabled status
   */
  getAny(type: ActionType | string): IAction | undefined {
    const resolvedType = this.aliases.get(type) || (type as ActionType);
    return this.actions.get(resolvedType)?.action;
  }

  /**
   * Check if an action type is registered
   */
  has(type: ActionType | string): boolean {
    const resolvedType = this.aliases.get(type) || (type as ActionType);
    return this.actions.has(resolvedType);
  }

  /**
   * Check if an action type is registered and enabled
   */
  isEnabled(type: ActionType | string): boolean {
    const resolvedType = this.aliases.get(type) || (type as ActionType);
    const entry = this.actions.get(resolvedType);
    return entry?.enabled ?? false;
  }

  /**
   * Enable an action
   */
  enable(type: ActionType): boolean {
    const entry = this.actions.get(type);
    if (!entry) return false;

    entry.enabled = true;
    return true;
  }

  /**
   * Disable an action
   */
  disable(type: ActionType): boolean {
    const entry = this.actions.get(type);
    if (!entry) return false;

    entry.enabled = false;
    return true;
  }

  /**
   * Get all registered action types
   */
  getTypes(): ActionType[] {
    return Array.from(this.actions.keys());
  }

  /**
   * Get all enabled action types
   */
  getEnabledTypes(): ActionType[] {
    return Array.from(this.actions.entries())
      .filter(([, entry]) => entry.enabled)
      .map(([type]) => type);
  }

  /**
   * Get all registered actions
   */
  getAll(): IAction[] {
    return Array.from(this.actions.values())
      .filter((entry) => entry.enabled)
      .map((entry) => entry.action);
  }

  /**
   * Validate configuration for an action type
   */
  validateConfig(type: ActionType, config: Record<string, unknown>): ValidationResult {
    const action = this.get(type);

    if (!action) {
      return {
        valid: false,
        errors: [`Action type "${type}" is not registered or not enabled`],
        warnings: [],
      };
    }

    return action.validate(config);
  }

  /**
   * Get registry statistics
   */
  getStats(): RegistryStats {
    const entries = Array.from(this.actions.values());

    return {
      totalActions: entries.length,
      enabledActions: entries.filter((e) => e.enabled).length,
      disabledActions: entries.filter((e) => !e.enabled).length,
      actionTypes: Array.from(this.actions.keys()),
    };
  }

  /**
   * Get action info for display/documentation
   */
  getActionInfo(type: ActionType): {
    type: ActionType;
    name: string;
    description: string;
    enabled: boolean;
    registeredAt: Date;
    configSchema: IAction["configSchema"];
    metadata?: Record<string, unknown>;
  } | undefined {
    const entry = this.actions.get(type);
    if (!entry) return undefined;

    return {
      type: entry.action.type,
      name: entry.action.name,
      description: entry.action.description,
      enabled: entry.enabled,
      registeredAt: entry.registeredAt,
      configSchema: entry.action.configSchema,
      metadata: entry.metadata,
    };
  }

  /**
   * Get info for all actions
   */
  getAllActionInfo(): Array<ReturnType<ActionRegistry["getActionInfo"]>> {
    return this.getTypes()
      .map((type) => this.getActionInfo(type))
      .filter((info): info is NonNullable<typeof info> => info !== undefined);
  }

  /**
   * Clear all registered actions
   */
  clear(): void {
    this.actions.clear();
    this.aliases.clear();
  }

  /**
   * Register multiple actions at once
   */
  registerBulk(
    actions: IAction[],
    options: ActionRegistrationOptions = {}
  ): { success: string[]; failed: Array<{ type: ActionType; error: string }> } {
    const success: string[] = [];
    const failed: Array<{ type: ActionType; error: string }> = [];

    for (const action of actions) {
      try {
        this.register(action, options);
        success.push(action.type);
      } catch (error) {
        failed.push({
          type: action.type,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return { success, failed };
  }
}

/**
 * Global singleton action registry instance
 */
export const actionRegistry = new ActionRegistry();

/**
 * Decorator for registering action classes
 * Usage: @RegisterAction()
 */
export function RegisterAction(options: ActionRegistrationOptions = {}) {
  return function <T extends new () => IAction>(constructor: T) {
    const instance = new constructor();
    actionRegistry.register(instance, options);
    return constructor;
  };
}

/**
 * Helper function to create and register an action
 */
export function createAction<T extends IAction>(
  ActionClass: new () => T,
  options?: ActionRegistrationOptions
): T {
  const instance = new ActionClass();
  actionRegistry.register(instance, options);
  return instance;
}
