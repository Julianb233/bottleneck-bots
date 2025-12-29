/**
 * Bot Execution Engine - Execution Context Management
 * Manages context and variable interpolation between action executions
 */

import { ContextState, ContextVariable } from "./types";

/**
 * Pattern for variable interpolation: {{variable.path}}
 */
const INTERPOLATION_PATTERN = /\{\{([^}]+)\}\}/g;

/**
 * Reserved variable prefixes
 */
const RESERVED_PREFIXES = ["env", "secrets", "previous", "trigger", "context", "action"] as const;
type ReservedPrefix = (typeof RESERVED_PREFIXES)[number];

/**
 * ExecutionContext manages data flow between actions during bot execution.
 * Supports variable interpolation, environment access, and secrets management.
 */
export class ExecutionContext {
  private state: ContextState;
  private secrets: Map<string, string> = new Map();
  private envAccessAllowed: boolean;
  private sensitivePatterns: RegExp[] = [
    /password/i,
    /secret/i,
    /token/i,
    /api[_-]?key/i,
    /credential/i,
    /auth/i,
    /private[_-]?key/i,
  ];

  constructor(options: {
    runId: string;
    botId: string;
    triggerData?: Record<string, unknown>;
    initialVariables?: Record<string, unknown>;
    envAccessAllowed?: boolean;
    secrets?: Record<string, string>;
  }) {
    this.envAccessAllowed = options.envAccessAllowed ?? false;

    this.state = {
      contextId: this.generateContextId(),
      runId: options.runId,
      botId: options.botId,
      variables: {},
      actionOutputs: {},
      triggerData: options.triggerData || {},
      startedAt: new Date(),
      currentActionIndex: 0,
      totalActions: 0,
    };

    // Initialize with provided variables
    if (options.initialVariables) {
      for (const [key, value] of Object.entries(options.initialVariables)) {
        this.setVariable(key, value, "config");
      }
    }

    // Store secrets
    if (options.secrets) {
      for (const [key, value] of Object.entries(options.secrets)) {
        this.setSecret(key, value);
      }
    }
  }

  /**
   * Generate a unique context ID
   */
  private generateContextId(): string {
    return `ctx_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Check if a variable name suggests sensitive data
   */
  private isSensitiveName(name: string): boolean {
    return this.sensitivePatterns.some((pattern) => pattern.test(name));
  }

  /**
   * Set a variable in the context
   */
  setVariable(
    name: string,
    value: unknown,
    source: ContextVariable["source"] = "config",
    sensitive?: boolean
  ): void {
    const isSensitive = sensitive ?? this.isSensitiveName(name);

    this.state.variables[name] = {
      value,
      sensitive: isSensitive,
      source,
      setAt: new Date(),
    };
  }

  /**
   * Get a variable from the context
   */
  getVariable(name: string): unknown {
    const variable = this.state.variables[name];
    return variable?.value;
  }

  /**
   * Check if a variable exists
   */
  hasVariable(name: string): boolean {
    return name in this.state.variables;
  }

  /**
   * Set a secret (always marked as sensitive)
   */
  setSecret(name: string, value: string): void {
    this.secrets.set(name, value);
    this.setVariable(name, "[REDACTED]", "secret", true);
  }

  /**
   * Get a secret value (for actual use in actions)
   */
  getSecret(name: string): string | undefined {
    return this.secrets.get(name);
  }

  /**
   * Store output from an action for use by subsequent actions
   */
  setActionOutput(actionId: string, output: unknown): void {
    this.state.actionOutputs[actionId] = output;

    // Also set as variable for interpolation: {{action.actionId.field}}
    this.setVariable(`action_${actionId}`, output, "action");
  }

  /**
   * Get output from a previous action
   */
  getActionOutput(actionId: string): unknown {
    return this.state.actionOutputs[actionId];
  }

  /**
   * Get the result of the immediately previous action
   */
  getPreviousOutput(): unknown {
    const actionIds = Object.keys(this.state.actionOutputs);
    if (actionIds.length === 0) return undefined;
    const lastActionId = actionIds[actionIds.length - 1];
    return this.state.actionOutputs[lastActionId];
  }

  /**
   * Get an environment variable (if allowed)
   */
  getEnvVariable(name: string): string | undefined {
    if (!this.envAccessAllowed) {
      console.warn(`Environment access not allowed for variable: ${name}`);
      return undefined;
    }
    return process.env[name];
  }

  /**
   * Update the current action index
   */
  setCurrentActionIndex(index: number, total: number): void {
    this.state.currentActionIndex = index;
    this.state.totalActions = total;
  }

  /**
   * Resolve a variable path like "previous.result.data" or "trigger.body.id"
   */
  private resolvePath(path: string): unknown {
    const parts = path.trim().split(".");
    if (parts.length === 0) return undefined;

    const prefix = parts[0] as ReservedPrefix | string;
    const remainingPath = parts.slice(1);

    let root: unknown;

    switch (prefix) {
      case "env":
        if (remainingPath.length === 0) return undefined;
        return this.getEnvVariable(remainingPath.join("."));

      case "secrets":
        if (remainingPath.length === 0) return undefined;
        return this.getSecret(remainingPath[0]);

      case "previous":
        root = this.getPreviousOutput();
        break;

      case "trigger":
        root = this.state.triggerData;
        break;

      case "context":
        // Access context metadata
        if (remainingPath.length === 0) return undefined;
        switch (remainingPath[0]) {
          case "runId":
            return this.state.runId;
          case "botId":
            return this.state.botId;
          case "startedAt":
            return this.state.startedAt.toISOString();
          case "currentAction":
            return this.state.currentActionIndex;
          case "totalActions":
            return this.state.totalActions;
          default:
            return undefined;
        }

      case "action":
        if (remainingPath.length === 0) return undefined;
        root = this.state.actionOutputs[remainingPath[0]];
        remainingPath.shift(); // Remove action ID from path
        break;

      default:
        // Check regular variables
        root = this.getVariable(prefix);
        break;
    }

    // Navigate the remaining path
    return this.navigatePath(root, remainingPath);
  }

  /**
   * Navigate an object path
   */
  private navigatePath(obj: unknown, path: string[]): unknown {
    if (path.length === 0) return obj;
    if (obj === null || obj === undefined) return undefined;

    let current: unknown = obj;

    for (const key of path) {
      if (typeof current !== "object" || current === null) {
        return undefined;
      }

      // Handle array index access
      if (Array.isArray(current) && /^\d+$/.test(key)) {
        current = current[parseInt(key, 10)];
      } else {
        current = (current as Record<string, unknown>)[key];
      }

      if (current === undefined) return undefined;
    }

    return current;
  }

  /**
   * Interpolate variables in a string
   * Replaces {{variable.path}} with the resolved value
   */
  interpolate(input: string): string {
    return input.replace(INTERPOLATION_PATTERN, (match, path) => {
      const value = this.resolvePath(path);

      if (value === undefined) {
        // Return original placeholder if variable not found
        return match;
      }

      if (typeof value === "object") {
        return JSON.stringify(value);
      }

      return String(value);
    });
  }

  /**
   * Interpolate variables in any value (string, object, array)
   */
  interpolateValue(value: unknown): unknown {
    if (typeof value === "string") {
      return this.interpolate(value);
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.interpolateValue(item));
    }

    if (typeof value === "object" && value !== null) {
      const result: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(value)) {
        result[key] = this.interpolateValue(val);
      }
      return result;
    }

    return value;
  }

  /**
   * Evaluate a condition string
   * Supports simple comparisons and variable interpolation
   */
  evaluateCondition(condition: string): boolean {
    // First interpolate any variables
    const interpolated = this.interpolate(condition);

    // Handle simple truthy checks
    if (interpolated === "true") return true;
    if (interpolated === "false") return false;

    // Handle comparison operators
    const comparisonMatch = interpolated.match(/^(.+?)\s*(===|!==|==|!=|>=|<=|>|<)\s*(.+)$/);
    if (comparisonMatch) {
      const [, left, operator, right] = comparisonMatch;
      return this.compare(left.trim(), operator, right.trim());
    }

    // Handle existence checks (just a variable reference)
    const value = this.resolvePath(interpolated);
    return value !== undefined && value !== null && value !== "" && value !== false;
  }

  /**
   * Compare two values with an operator
   */
  private compare(left: string, operator: string, right: string): boolean {
    // Try to parse as JSON for object/array/number comparison
    let leftVal: unknown = left;
    let rightVal: unknown = right;

    try {
      leftVal = JSON.parse(left);
    } catch {
      // Keep as string
    }

    try {
      rightVal = JSON.parse(right);
    } catch {
      // Keep as string
    }

    switch (operator) {
      case "===":
        return leftVal === rightVal;
      case "!==":
        return leftVal !== rightVal;
      case "==":
        return leftVal == rightVal;
      case "!=":
        return leftVal != rightVal;
      case ">":
        return Number(leftVal) > Number(rightVal);
      case "<":
        return Number(leftVal) < Number(rightVal);
      case ">=":
        return Number(leftVal) >= Number(rightVal);
      case "<=":
        return Number(leftVal) <= Number(rightVal);
      default:
        return false;
    }
  }

  /**
   * Get a snapshot of the current context state
   * Redacts sensitive values
   */
  getSnapshot(): Record<string, unknown> {
    const variables: Record<string, unknown> = {};

    for (const [key, variable] of Object.entries(this.state.variables)) {
      variables[key] = variable.sensitive ? "[REDACTED]" : variable.value;
    }

    return {
      contextId: this.state.contextId,
      runId: this.state.runId,
      botId: this.state.botId,
      startedAt: this.state.startedAt.toISOString(),
      currentActionIndex: this.state.currentActionIndex,
      totalActions: this.state.totalActions,
      variables,
      actionOutputs: this.state.actionOutputs,
      triggerData: this.state.triggerData,
    };
  }

  /**
   * Get the raw state (for internal use only)
   */
  getState(): Readonly<ContextState> {
    return { ...this.state };
  }

  /**
   * Clone the context (for parallel execution branches)
   */
  clone(): ExecutionContext {
    const cloned = new ExecutionContext({
      runId: this.state.runId,
      botId: this.state.botId,
      triggerData: { ...this.state.triggerData },
      envAccessAllowed: this.envAccessAllowed,
    });

    // Copy variables
    for (const [key, variable] of Object.entries(this.state.variables)) {
      cloned.state.variables[key] = { ...variable };
    }

    // Copy action outputs
    cloned.state.actionOutputs = { ...this.state.actionOutputs };

    // Copy secrets
    for (const [key, value] of this.secrets.entries()) {
      cloned.secrets.set(key, value);
    }

    cloned.state.currentActionIndex = this.state.currentActionIndex;
    cloned.state.totalActions = this.state.totalActions;

    return cloned;
  }

  /**
   * Merge another context's variables and outputs into this one
   */
  merge(other: ExecutionContext): void {
    const otherState = other.getState();

    // Merge variables (other takes precedence)
    for (const [key, variable] of Object.entries(otherState.variables)) {
      this.state.variables[key] = { ...variable };
    }

    // Merge action outputs
    for (const [key, output] of Object.entries(otherState.actionOutputs)) {
      this.state.actionOutputs[key] = output;
    }
  }
}

/**
 * Create a new execution context
 */
export function createExecutionContext(options: {
  runId: string;
  botId: string;
  triggerData?: Record<string, unknown>;
  initialVariables?: Record<string, unknown>;
  envAccessAllowed?: boolean;
  secrets?: Record<string, string>;
}): ExecutionContext {
  return new ExecutionContext(options);
}
