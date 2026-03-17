/**
 * Pipeline Execution Service
 * Handles chained multi-step workflow execution with data passing between steps.
 *
 * A pipeline runs a sequence of steps where each step can be:
 * - A reference to an existing automation workflow (executed via workflowExecution.service)
 * - An inline task (API call, notification, data transform)
 *
 * Output from each step is stored in a shared context and can be mapped
 * as input to subsequent steps via inputMapping expressions.
 */

import { getDb } from "../db";
import { eq, and, desc } from "drizzle-orm";
import {
  workflowPipelines,
  pipelineExecutions,
} from "../../drizzle/schema-pipelines";
import { automationWorkflows } from "../../drizzle/schema";
import { evaluateExpression } from "../lib/safeExpressionParser";
import { substituteVariables } from "../_core/variableSubstitution";
import type {
  PipelineStepDefinition,
  PipelineStepResult,
  PipelineExecutionStatus,
  ExecutePipelineOptions,
  InlineApiCallConfig,
  InlineNotificationConfig,
  InlineTransformConfig,
  HttpMethod,
} from "../types";

// ========================================
// CONTEXT & HELPERS
// ========================================

interface PipelineContext {
  pipelineId: number;
  executionId: number;
  userId: number;
  /** Shared variables — each step's output is stored under its stepId */
  variables: Record<string, unknown>;
  stepResults: PipelineStepResult[];
}

/**
 * Resolve inputMapping expressions against pipeline context.
 * Supports {{stepId.field.nested}} syntax to reference previous step outputs.
 */
function resolveInputMapping(
  mapping: Record<string, string>,
  variables: Record<string, unknown>
): Record<string, unknown> {
  const resolved: Record<string, unknown> = {};
  for (const [key, expression] of Object.entries(mapping)) {
    resolved[key] = substituteVariables(expression, variables);
  }
  return resolved;
}

/**
 * Update pipeline execution status in the database.
 */
async function updatePipelineExecution(
  executionId: number,
  updates: Partial<{
    status: string;
    currentStepIndex: number;
    output: unknown;
    stepResults: unknown[];
    completedAt: Date;
    duration: number;
    error: string;
  }>
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not initialized");

  await db
    .update(pipelineExecutions)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(pipelineExecutions.id, executionId));
}

// ========================================
// INLINE STEP HANDLERS
// ========================================

async function executeInlineApiCall(
  config: InlineApiCallConfig,
  variables: Record<string, unknown>
): Promise<unknown> {
  const url = String(substituteVariables(config.url, variables));
  const method = (config.method || "GET").toUpperCase() as HttpMethod;
  const headers = config.headers
    ? (substituteVariables(config.headers, variables) as Record<string, string>)
    : {};
  const body = config.body ? substituteVariables(config.body, variables) : undefined;

  const fetchOptions: RequestInit = {
    method,
    headers: { "Content-Type": "application/json", ...headers },
  };

  if (body && method !== "GET") {
    fetchOptions.body = typeof body === "string" ? body : JSON.stringify(body);
  }

  const response = await fetch(url, fetchOptions);
  const data = await response.json().catch(() => response.text());

  return {
    status: response.status,
    statusText: response.statusText,
    data,
  };
}

function executeInlineNotification(
  config: InlineNotificationConfig,
  variables: Record<string, unknown>
): unknown {
  const message = substituteVariables(config.message, variables);
  const type = config.notificationType || "info";
  console.log(`[Pipeline Notification - ${type}]: ${message}`);
  return { message, type, timestamp: new Date() };
}

function executeInlineTransform(
  config: InlineTransformConfig,
  variables: Record<string, unknown>
): unknown {
  const result = evaluateExpression(String(config.expression), variables);
  if (!result.success) {
    throw new Error(`Transform expression failed: ${result.error}`);
  }
  return result.result;
}

// ========================================
// WORKFLOW STEP HANDLER
// ========================================

/**
 * Execute a workflow step by running all its defined steps inline.
 * We load the workflow definition and execute its steps without spinning up
 * a Browserbase session (that's only needed for browser-type steps).
 * For non-browser workflows, we run the API/notification/condition steps directly.
 * For browser workflows, we delegate to the existing workflowExecution service.
 */
async function executeWorkflowStep(
  workflowId: number,
  userId: number,
  stepVariables: Record<string, unknown>
): Promise<unknown> {
  // Dynamic import to avoid circular dependencies
  const { executeWorkflow } = await import("./workflowExecution.service");

  const result = await executeWorkflow({
    workflowId,
    userId,
    variables: stepVariables,
  });

  return {
    executionId: result.executionId,
    status: result.status,
    output: result.output,
    stepResults: result.stepResults,
  };
}

// ========================================
// CORE PIPELINE EXECUTION
// ========================================

/**
 * Execute a complete pipeline — runs each step sequentially,
 * passing data between steps via the shared context.
 */
export async function executePipeline(
  options: ExecutePipelineOptions
): Promise<PipelineExecutionStatus> {
  const { pipelineId, userId, variables = {} } = options;

  const db = await getDb();
  if (!db) throw new Error("Database not initialized");

  // 1. Load pipeline definition
  const [pipeline] = await db
    .select()
    .from(workflowPipelines)
    .where(and(eq(workflowPipelines.id, pipelineId), eq(workflowPipelines.userId, userId)))
    .limit(1);

  if (!pipeline) throw new Error("Pipeline not found");
  if (!pipeline.isActive) throw new Error("Pipeline is not active");

  const steps = pipeline.steps as PipelineStepDefinition[];
  if (!Array.isArray(steps) || steps.length === 0) {
    throw new Error("Pipeline has no steps");
  }

  // 2. Create execution record
  const [execution] = await db
    .insert(pipelineExecutions)
    .values({
      pipelineId,
      userId,
      status: "running",
      input: variables,
      totalSteps: steps.length,
      currentStepIndex: 0,
      startedAt: new Date(),
    })
    .returning();

  const executionId = execution.id;
  const startTime = Date.now();

  // 3. Build pipeline context
  const context: PipelineContext = {
    pipelineId,
    executionId,
    userId,
    variables: { ...variables, __pipeline: { id: pipelineId, executionId } },
    stepResults: [],
  };

  try {
    // 4. Execute steps sequentially
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const stepStart = Date.now();

      // Update progress
      await updatePipelineExecution(executionId, {
        currentStepIndex: i,
        stepResults: context.stepResults,
      });

      // Check condition (skip if condition evaluates to false)
      if (step.condition) {
        const condResult = evaluateExpression(step.condition, context.variables);
        if (condResult.success && !condResult.result) {
          context.stepResults.push({
            stepId: step.stepId,
            stepIndex: i,
            type: step.type,
            status: "skipped",
            startedAt: new Date(stepStart),
            completedAt: new Date(),
            duration: Date.now() - stepStart,
          });
          continue;
        }
      }

      // Resolve input mapping
      const stepVariables: Record<string, unknown> = { ...variables };
      if (step.inputMapping) {
        const mapped = resolveInputMapping(step.inputMapping, context.variables);
        Object.assign(stepVariables, mapped);
      }

      let output: unknown;
      let retries = step.retryCount || 0;
      let lastError: Error | undefined;

      // Execute with retry logic
      while (true) {
        try {
          if (step.type === "workflow" && step.workflowId) {
            output = await executeWorkflowStep(step.workflowId, userId, stepVariables);
          } else if (step.type === "inline" && step.inlineConfig) {
            switch (step.inlineConfig.type) {
              case "apiCall":
                output = await executeInlineApiCall(
                  step.inlineConfig as InlineApiCallConfig,
                  stepVariables
                );
                break;
              case "notification":
                output = executeInlineNotification(
                  step.inlineConfig as InlineNotificationConfig,
                  stepVariables
                );
                break;
              case "transform":
                output = executeInlineTransform(
                  step.inlineConfig as InlineTransformConfig,
                  stepVariables
                );
                break;
              default:
                throw new Error(`Unknown inline step type: ${(step.inlineConfig as any).type}`);
            }
          } else {
            throw new Error(`Invalid step configuration for step "${step.stepId}"`);
          }

          lastError = undefined;
          break; // Success
        } catch (err) {
          lastError = err instanceof Error ? err : new Error(String(err));
          if (retries > 0) {
            retries--;
            const delay = step.retryDelayMs || 1000;
            await new Promise((r) => setTimeout(r, delay));
          } else {
            break; // No more retries
          }
        }
      }

      const stepDuration = Date.now() - stepStart;

      if (lastError) {
        // Step failed
        context.stepResults.push({
          stepId: step.stepId,
          stepIndex: i,
          type: step.type,
          status: "failed",
          error: lastError.message,
          startedAt: new Date(stepStart),
          completedAt: new Date(),
          duration: stepDuration,
        });

        if (!step.continueOnError) {
          throw new Error(`Pipeline step "${step.stepId}" failed: ${lastError.message}`);
        }
      } else {
        // Step succeeded — store output in context
        context.variables[step.stepId] = output;

        context.stepResults.push({
          stepId: step.stepId,
          stepIndex: i,
          type: step.type,
          status: "completed",
          output,
          startedAt: new Date(stepStart),
          completedAt: new Date(),
          duration: stepDuration,
        });
      }
    }

    // 5. Pipeline completed
    const totalDuration = Date.now() - startTime;

    await updatePipelineExecution(executionId, {
      status: "completed",
      completedAt: new Date(),
      duration: totalDuration,
      output: context.variables,
      stepResults: context.stepResults,
    });

    // Update pipeline statistics
    await db
      .update(workflowPipelines)
      .set({
        executionCount: (pipeline.executionCount || 0) + 1,
        lastExecutedAt: new Date(),
      })
      .where(eq(workflowPipelines.id, pipelineId));

    return {
      executionId,
      pipelineId,
      status: "completed",
      currentStepIndex: steps.length,
      totalSteps: steps.length,
      stepResults: context.stepResults,
      input: variables,
      output: context.variables,
      startedAt: execution.startedAt || undefined,
      completedAt: new Date(),
      duration: totalDuration,
    };
  } catch (error) {
    const totalDuration = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : "Unknown error";

    await updatePipelineExecution(executionId, {
      status: "failed",
      completedAt: new Date(),
      duration: totalDuration,
      error: errorMsg,
      stepResults: context.stepResults,
    });

    throw error;
  }
}

// ========================================
// STATUS & CANCELLATION
// ========================================

export async function getPipelineExecutionStatus(
  executionId: number
): Promise<PipelineExecutionStatus> {
  const db = await getDb();
  if (!db) throw new Error("Database not initialized");

  const [execution] = await db
    .select()
    .from(pipelineExecutions)
    .where(eq(pipelineExecutions.id, executionId))
    .limit(1);

  if (!execution) throw new Error("Pipeline execution not found");

  return {
    executionId: execution.id,
    pipelineId: execution.pipelineId,
    status: execution.status,
    currentStepIndex: execution.currentStepIndex,
    totalSteps: execution.totalSteps,
    stepResults: (execution.stepResults as PipelineStepResult[]) || [],
    input: execution.input,
    output: execution.output,
    error: execution.error || undefined,
    startedAt: execution.startedAt || undefined,
    completedAt: execution.completedAt || undefined,
    duration: execution.duration || undefined,
  };
}

export async function cancelPipelineExecution(executionId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not initialized");

  const [execution] = await db
    .select()
    .from(pipelineExecutions)
    .where(eq(pipelineExecutions.id, executionId))
    .limit(1);

  if (!execution) throw new Error("Pipeline execution not found");
  if (execution.status !== "running") {
    throw new Error("Only running pipeline executions can be cancelled");
  }

  await updatePipelineExecution(executionId, {
    status: "cancelled",
    completedAt: new Date(),
    error: "Cancelled by user",
  });
}
