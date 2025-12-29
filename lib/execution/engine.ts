/**
 * Bot Execution Engine - Core Execution Engine
 * Processes bot configurations and executes action chains
 */

import { ExecutionContext, createExecutionContext } from "./context";
import { actionRegistry } from "./actions/registry";
import { ActionInput, ActionOutput, executeWithTimeout, calculateRetryDelay } from "./actions/base";
import {
  BotConfig,
  ActionConfig,
  ActionResult,
  ExecutionResult,
  ExecutionStatus,
  ExecutionError,
  ExecutionOptions,
  TriggerType,
  RetryConfig,
  DEFAULT_RETRY_CONFIG,
  DEFAULT_TIMEOUT_CONFIG,
} from "./types";

/**
 * Event types emitted by the executor
 */
export type ExecutorEvent =
  | { type: "execution_started"; runId: string; botId: string }
  | { type: "action_started"; actionId: string; actionIndex: number }
  | { type: "action_completed"; result: ActionResult }
  | { type: "action_failed"; result: ActionResult; willRetry: boolean }
  | { type: "action_skipped"; result: ActionResult }
  | { type: "execution_completed"; result: ExecutionResult }
  | { type: "execution_failed"; result: ExecutionResult };

/**
 * Event listener for executor events
 */
export type ExecutorEventListener = (event: ExecutorEvent) => void;

/**
 * BotExecutor processes bot configurations and executes actions in sequence.
 * Supports retry logic, timeout handling, and context passing between actions.
 */
export class BotExecutor {
  private eventListeners: Set<ExecutorEventListener> = new Set();
  private abortController: AbortController | null = null;
  private isRunning: boolean = false;

  /**
   * Subscribe to executor events
   */
  on(listener: ExecutorEventListener): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  /**
   * Emit an event to all listeners
   */
  private emit(event: ExecutorEvent): void {
    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch (error) {
        console.error("Error in event listener:", error);
      }
    }
  }

  /**
   * Execute a bot configuration
   */
  async execute(
    bot: BotConfig,
    triggerType: TriggerType,
    triggerData?: Record<string, unknown>,
    options: ExecutionOptions = {}
  ): Promise<ExecutionResult> {
    const runId = this.generateRunId();
    const startedAt = new Date();

    // Create abort controller for cancellation
    this.abortController = new AbortController();
    this.isRunning = true;

    // Set up execution timeout
    let executionTimeoutId: NodeJS.Timeout | undefined;
    const maxExecutionTime = options.maxExecutionTimeMs || 600000; // 10 minutes default

    const executionTimeoutPromise = new Promise<never>((_, reject) => {
      executionTimeoutId = setTimeout(() => {
        this.abort();
        reject(new Error(`Execution timed out after ${maxExecutionTime}ms`));
      }, maxExecutionTime);
    });

    // Create execution context
    const context = createExecutionContext({
      runId,
      botId: bot.id,
      triggerData,
      initialVariables: {
        ...bot.settings?.variables,
        ...options.initialContext,
      },
      envAccessAllowed: true,
    });

    // Build result object
    const result: ExecutionResult = {
      runId,
      botId: bot.id,
      botName: bot.name,
      status: ExecutionStatus.PENDING,
      triggerType,
      triggerData,
      startedAt,
      actionResults: [],
    };

    try {
      this.emit({ type: "execution_started", runId, botId: bot.id });

      result.status = ExecutionStatus.RUNNING;
      options.onStatusChange?.(ExecutionStatus.RUNNING, result);

      // Execute actions with timeout
      const executionPromise = this.executeActions(bot, context, result, options);

      await Promise.race([executionPromise, executionTimeoutPromise]);

      // Execution completed successfully
      result.status = ExecutionStatus.COMPLETED;
      result.completedAt = new Date();
      result.durationMs = result.completedAt.getTime() - startedAt.getTime();
      result.contextSnapshot = context.getSnapshot();
      result.output = this.buildFinalOutput(result.actionResults);

      this.emit({ type: "execution_completed", result });
      options.onStatusChange?.(ExecutionStatus.COMPLETED, result);

    } catch (error) {
      result.status = this.abortController.signal.aborted
        ? ExecutionStatus.CANCELLED
        : error instanceof Error && error.message.includes("timed out")
        ? ExecutionStatus.TIMEOUT
        : ExecutionStatus.FAILED;

      result.completedAt = new Date();
      result.durationMs = result.completedAt.getTime() - startedAt.getTime();
      result.error = this.toExecutionError(error);
      result.contextSnapshot = context.getSnapshot();

      this.emit({ type: "execution_failed", result });
      options.onStatusChange?.(result.status, result);

    } finally {
      if (executionTimeoutId) clearTimeout(executionTimeoutId);
      this.isRunning = false;
      this.abortController = null;
    }

    return result;
  }

  /**
   * Execute all actions in sequence
   */
  private async executeActions(
    bot: BotConfig,
    context: ExecutionContext,
    result: ExecutionResult,
    options: ExecutionOptions
  ): Promise<void> {
    // Sort actions by order
    const sortedActions = [...bot.actions]
      .filter((a) => a.enabled !== false)
      .sort((a, b) => a.order - b.order);

    const totalActions = sortedActions.length;
    const stopOnError = bot.settings?.stopOnError ?? true;

    for (let i = 0; i < sortedActions.length; i++) {
      // Check for abort
      if (this.abortController?.signal.aborted) {
        throw new Error("Execution was cancelled");
      }

      const actionConfig = sortedActions[i];
      context.setCurrentActionIndex(i, totalActions);

      this.emit({ type: "action_started", actionId: actionConfig.id, actionIndex: i });

      // Check condition if present
      if (actionConfig.condition) {
        const conditionMet = context.evaluateCondition(actionConfig.condition);
        if (!conditionMet) {
          const skippedResult: ActionResult = {
            actionId: actionConfig.id,
            actionType: actionConfig.type,
            actionName: actionConfig.name,
            status: ExecutionStatus.COMPLETED,
            startedAt: new Date(),
            completedAt: new Date(),
            durationMs: 0,
            skipped: true,
            skipReason: "Condition not met: " + actionConfig.condition,
          };

          result.actionResults.push(skippedResult);
          this.emit({ type: "action_skipped", result: skippedResult });
          options.onActionComplete?.(skippedResult);
          continue;
        }
      }

      // Execute action with retry logic
      const actionResult = await this.executeActionWithRetry(
        actionConfig,
        context,
        bot.settings?.retry,
        options
      );

      result.actionResults.push(actionResult);
      options.onActionComplete?.(actionResult);

      // Store output for context chaining
      if (actionResult.status === ExecutionStatus.COMPLETED && actionResult.output !== undefined) {
        context.setActionOutput(actionConfig.id, actionResult.output);
      }

      // Handle failures
      if (actionResult.status === ExecutionStatus.FAILED) {
        if (stopOnError && !actionConfig.continueOnError) {
          throw new Error(
            `Action "${actionConfig.name}" failed: ${actionResult.error?.message}`
          );
        }
      }
    }
  }

  /**
   * Execute a single action with retry logic
   */
  private async executeActionWithRetry(
    actionConfig: ActionConfig,
    context: ExecutionContext,
    globalRetryConfig?: Partial<RetryConfig>,
    options?: ExecutionOptions
  ): Promise<ActionResult> {
    const retryConfig: RetryConfig = {
      ...DEFAULT_RETRY_CONFIG,
      ...globalRetryConfig,
      ...options?.retry,
      ...actionConfig.retry,
    };

    const timeoutMs = actionConfig.timeoutMs
      ?? options?.timeout?.defaultTimeoutMs
      ?? DEFAULT_TIMEOUT_CONFIG.defaultTimeoutMs;

    let lastError: ExecutionError | undefined;
    let retryCount = 0;

    for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
      const startedAt = new Date();

      try {
        const output = await this.executeAction(actionConfig, context, timeoutMs, options);

        return {
          actionId: actionConfig.id,
          actionType: actionConfig.type,
          actionName: actionConfig.name,
          status: ExecutionStatus.COMPLETED,
          startedAt,
          completedAt: new Date(),
          durationMs: new Date().getTime() - startedAt.getTime(),
          output: output.data,
          retryCount,
        };
      } catch (error) {
        lastError = this.toExecutionError(error);
        retryCount = attempt;

        const failedResult: ActionResult = {
          actionId: actionConfig.id,
          actionType: actionConfig.type,
          actionName: actionConfig.name,
          status: ExecutionStatus.FAILED,
          startedAt,
          completedAt: new Date(),
          durationMs: new Date().getTime() - startedAt.getTime(),
          error: lastError,
          retryCount,
        };

        // Check if we should retry
        const canRetry = attempt < retryConfig.maxRetries && lastError.retryable;

        this.emit({
          type: "action_failed",
          result: failedResult,
          willRetry: canRetry,
        });

        if (!canRetry) {
          return failedResult;
        }

        // Calculate delay and wait before retry
        const delay = calculateRetryDelay(attempt + 1, retryConfig);
        console.log(
          `Action "${actionConfig.name}" failed, retrying in ${delay}ms (attempt ${attempt + 1}/${retryConfig.maxRetries})`
        );
        await this.sleep(delay);
      }
    }

    // Should not reach here, but just in case
    return {
      actionId: actionConfig.id,
      actionType: actionConfig.type,
      actionName: actionConfig.name,
      status: ExecutionStatus.FAILED,
      startedAt: new Date(),
      completedAt: new Date(),
      durationMs: 0,
      error: lastError,
      retryCount,
    };
  }

  /**
   * Execute a single action
   */
  private async executeAction(
    actionConfig: ActionConfig,
    context: ExecutionContext,
    timeoutMs: number,
    options?: ExecutionOptions
  ): Promise<ActionOutput> {
    // Get action handler from registry
    const action = actionRegistry.get(actionConfig.type);

    if (!action) {
      throw new Error(`No handler registered for action type: ${actionConfig.type}`);
    }

    // Interpolate configuration values
    const interpolatedConfig = context.interpolateValue(actionConfig.config) as Record<
      string,
      unknown
    >;

    // Validate configuration
    const validation = action.validate(interpolatedConfig);
    if (!validation.valid) {
      throw new Error(`Invalid action configuration: ${validation.errors.join(", ")}`);
    }

    // Log warnings
    for (const warning of validation.warnings) {
      console.warn(`Action "${actionConfig.name}" config warning: ${warning}`);
    }

    // Build action input
    const input: ActionInput = {
      config: actionConfig,
      context,
      interpolatedConfig,
      abortSignal: this.abortController?.signal,
    };

    // Execute with timeout (skip for dry run)
    if (options?.dryRun) {
      return {
        data: { dryRun: true, wouldExecute: actionConfig.type },
        metadata: { interpolatedConfig },
      };
    }

    return executeWithTimeout(
      () => action.execute(input),
      timeoutMs,
      this.abortController?.signal
    );
  }

  /**
   * Build final output from action results
   */
  private buildFinalOutput(actionResults: ActionResult[]): Record<string, unknown> {
    const output: Record<string, unknown> = {
      actionCount: actionResults.length,
      successCount: actionResults.filter((r) => r.status === ExecutionStatus.COMPLETED).length,
      failedCount: actionResults.filter((r) => r.status === ExecutionStatus.FAILED).length,
      skippedCount: actionResults.filter((r) => r.skipped).length,
    };

    // Include outputs from each action
    const actionOutputs: Record<string, unknown> = {};
    for (const result of actionResults) {
      if (result.output !== undefined) {
        actionOutputs[result.actionId] = result.output;
      }
    }
    output.actionOutputs = actionOutputs;

    // Include the last action's output as "result"
    const lastResult = actionResults[actionResults.length - 1];
    if (lastResult?.output !== undefined) {
      output.result = lastResult.output;
    }

    return output;
  }

  /**
   * Convert an error to ExecutionError format
   */
  private toExecutionError(error: unknown): ExecutionError {
    if (error instanceof Error) {
      const nodeError = error as NodeJS.ErrnoException;
      return {
        code: nodeError.code || "UNKNOWN_ERROR",
        message: error.message,
        stack: error.stack,
        retryable: this.isRetryableError(error),
        details: {
          name: error.name,
        },
      };
    }

    return {
      code: "UNKNOWN_ERROR",
      message: String(error),
      retryable: false,
    };
  }

  /**
   * Check if an error is retryable
   */
  private isRetryableError(error: Error): boolean {
    const message = error.message.toLowerCase();
    return (
      message.includes("timeout") ||
      message.includes("rate limit") ||
      message.includes("too many requests") ||
      message.includes("temporary") ||
      message.includes("unavailable") ||
      message.includes("econnreset") ||
      message.includes("econnrefused")
    );
  }

  /**
   * Generate a unique run ID
   */
  private generateRunId(): string {
    return `run_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Sleep for a specified duration
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Abort the current execution
   */
  abort(): void {
    if (this.abortController && !this.abortController.signal.aborted) {
      this.abortController.abort();
    }
  }

  /**
   * Check if an execution is currently running
   */
  isExecuting(): boolean {
    return this.isRunning;
  }

  /**
   * Validate a bot configuration without executing
   */
  validateBot(bot: BotConfig): {
    valid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check basic configuration
    if (!bot.id) {
      errors.push("Bot must have an id");
    }

    if (!bot.name) {
      errors.push("Bot must have a name");
    }

    if (!bot.actions || bot.actions.length === 0) {
      errors.push("Bot must have at least one action");
    }

    // Validate each action
    for (const action of bot.actions || []) {
      if (!action.id) {
        errors.push(`Action at order ${action.order} must have an id`);
      }

      if (!actionRegistry.has(action.type)) {
        errors.push(`Unknown action type: ${action.type}`);
        continue;
      }

      const actionHandler = actionRegistry.get(action.type);
      if (actionHandler) {
        const validation = actionHandler.validate(action.config);
        for (const error of validation.errors) {
          errors.push(`Action "${action.name}": ${error}`);
        }
        for (const warning of validation.warnings) {
          warnings.push(`Action "${action.name}": ${warning}`);
        }
      }
    }

    // Check for duplicate action IDs
    const actionIds = bot.actions?.map((a) => a.id) || [];
    const duplicates = actionIds.filter((id, index) => actionIds.indexOf(id) !== index);
    for (const duplicate of duplicates) {
      errors.push(`Duplicate action id: ${duplicate}`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }
}

/**
 * Create a new BotExecutor instance
 */
export function createBotExecutor(): BotExecutor {
  return new BotExecutor();
}

/**
 * Default global executor instance
 */
export const botExecutor = new BotExecutor();
