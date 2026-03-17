/**
 * Multi-Step Workflow (Pipeline) Execution Service
 *
 * Orchestrates chained workflows where agents execute sequential tasks
 * with data passing between steps via a shared context.
 *
 * Data flow:
 *   input → step1 → context → step2 → context → ... → stepN → output
 *
 * Each step can:
 *   - Read from shared context via inputMapping
 *   - Write to shared context via outputMapping
 *   - Be conditionally skipped
 *   - Retry on failure
 *   - Continue pipeline on error (configurable)
 */

import { getDb } from "../db";
import { eq, and, desc } from "drizzle-orm";
import {
  pipelines,
  pipelineExecutions,
  type PipelineStepJson,
  type PipelineStepResultJson,
} from "../../drizzle/schema-pipelines";
import { automationWorkflows } from "../../drizzle/schema";
import { executeWorkflow } from "./workflowExecution.service";
import { evaluateExpression } from "../lib/safeExpressionParser";
import { substituteVariables } from "../_core/variableSubstitution";

// ========================================
// TYPES
// ========================================

export interface ExecutePipelineOptions {
  pipelineId: number;
  userId: number;
  variables?: Record<string, unknown>;
}

export interface PipelineExecutionResult {
  executionId: number;
  pipelineId: number;
  status: "completed" | "failed" | "cancelled";
  stepResults: PipelineStepResultJson[];
  sharedContext: Record<string, unknown>;
  output: unknown;
  duration: number;
  error?: string;
}

interface StepExecutionContext {
  pipelineId: number;
  executionId: number;
  userId: number;
  sharedContext: Record<string, unknown>;
  stepResults: PipelineStepResultJson[];
}

// ========================================
// CONTEXT MAPPING HELPERS
// ========================================

/**
 * Resolve input variables for a step by mapping shared context keys
 * inputMapping: { "targetUrl": "context.extractedUrl", "apiKey": "context.credentials.key" }
 */
function resolveInputMapping(
  mapping: Record<string, string> | undefined,
  sharedContext: Record<string, unknown>
): Record<string, unknown> {
  if (!mapping) return {};

  const resolved: Record<string, unknown> = {};
  for (const [stepVar, contextPath] of Object.entries(mapping)) {
    const value = resolveContextPath(contextPath, sharedContext);
    if (value !== undefined) {
      resolved[stepVar] = value;
    }
  }
  return resolved;
}

/**
 * Write step outputs back to shared context using output mapping
 * outputMapping: { "context.extractedData": "result.data", "context.status": "result.status" }
 */
function applyOutputMapping(
  mapping: Record<string, string> | undefined,
  stepOutput: unknown,
  sharedContext: Record<string, unknown>
): void {
  if (!mapping || !stepOutput || typeof stepOutput !== "object") return;

  for (const [contextPath, outputPath] of Object.entries(mapping)) {
    const value = resolveContextPath(outputPath, stepOutput as Record<string, unknown>);
    if (value !== undefined) {
      setContextPath(contextPath, value, sharedContext);
    }
  }
}

/**
 * Resolve a dot-notation path from an object
 * e.g., "context.user.name" → context["user"]["name"]
 */
function resolveContextPath(
  path: string,
  obj: Record<string, unknown>
): unknown {
  // Strip "context." prefix if present for convenience
  const cleanPath = path.startsWith("context.")
    ? path.slice(8)
    : path.startsWith("result.")
      ? path.slice(7)
      : path;

  const parts = cleanPath.split(".");
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/**
 * Set a value at a dot-notation path in an object
 */
function setContextPath(
  path: string,
  value: unknown,
  obj: Record<string, unknown>
): void {
  const cleanPath = path.startsWith("context.") ? path.slice(8) : path;
  const parts = cleanPath.split(".");

  let current: Record<string, unknown> = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!(part in current) || typeof current[part] !== "object" || current[part] === null) {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }

  current[parts[parts.length - 1]] = value;
}

// ========================================
// STEP HANDLERS
// ========================================

/**
 * Execute a workflow-type step (delegates to existing workflowExecution service)
 */
async function executeWorkflowStep(
  step: PipelineStepJson,
  ctx: StepExecutionContext
): Promise<{ output: unknown; error?: string }> {
  const config = step.config as {
    workflowId: number;
    geolocation?: { city?: string; state?: string; country?: string };
  };

  if (!config.workflowId) {
    throw new Error("Workflow step requires workflowId in config");
  }

  // Merge shared context into workflow variables via inputMapping
  const inputVars = resolveInputMapping(step.inputMapping, ctx.sharedContext);
  const variables = { ...inputVars };

  const result = await executeWorkflow({
    workflowId: config.workflowId,
    userId: ctx.userId,
    variables,
    geolocation: config.geolocation,
  });

  return {
    output: {
      executionId: result.executionId,
      status: result.status,
      stepResults: result.stepResults,
      data: result.output,
    },
  };
}

/**
 * Execute an API call step
 */
async function executeApiCallStep(
  step: PipelineStepJson,
  ctx: StepExecutionContext
): Promise<{ output: unknown; error?: string }> {
  const config = step.config as {
    url: string;
    method?: string;
    headers?: Record<string, string>;
    body?: unknown;
  };

  if (!config.url) {
    throw new Error("API call step requires url in config");
  }

  const url = substituteVariables(config.url, ctx.sharedContext) as string;
  const method = (config.method || "GET").toUpperCase();
  const headers = config.headers
    ? (substituteVariables(config.headers, ctx.sharedContext) as Record<string, string>)
    : {};
  const body = config.body
    ? substituteVariables(config.body, ctx.sharedContext)
    : undefined;

  const fetchOptions: RequestInit = {
    method,
    headers: { "Content-Type": "application/json", ...headers },
  };

  if (body && method !== "GET" && method !== "HEAD") {
    fetchOptions.body = typeof body === "string" ? body : JSON.stringify(body);
  }

  const response = await fetch(url, fetchOptions);
  const responseData = await response.json().catch(() => response.text());

  return {
    output: {
      status: response.status,
      statusText: response.statusText,
      data: responseData,
    },
  };
}

/**
 * Execute a transform step (map/reshape data in shared context)
 */
async function executeTransformStep(
  step: PipelineStepJson,
  ctx: StepExecutionContext
): Promise<{ output: unknown; error?: string }> {
  const config = step.config as {
    operations: Array<{
      type: "set" | "delete" | "merge" | "map";
      path: string;
      value?: unknown;
      sourcePath?: string;
    }>;
  };

  if (!config.operations || !Array.isArray(config.operations)) {
    throw new Error("Transform step requires operations array");
  }

  const results: Array<{ operation: string; path: string; success: boolean }> = [];

  for (const op of config.operations) {
    switch (op.type) {
      case "set": {
        const value = op.sourcePath
          ? resolveContextPath(op.sourcePath, ctx.sharedContext)
          : op.value;
        setContextPath(op.path, value, ctx.sharedContext);
        results.push({ operation: "set", path: op.path, success: true });
        break;
      }
      case "delete": {
        setContextPath(op.path, undefined, ctx.sharedContext);
        results.push({ operation: "delete", path: op.path, success: true });
        break;
      }
      case "merge": {
        const source = op.sourcePath
          ? resolveContextPath(op.sourcePath, ctx.sharedContext)
          : op.value;
        const target = resolveContextPath(op.path, ctx.sharedContext);
        if (typeof target === "object" && typeof source === "object" && target && source) {
          setContextPath(op.path, { ...target as object, ...source as object }, ctx.sharedContext);
        }
        results.push({ operation: "merge", path: op.path, success: true });
        break;
      }
      default:
        results.push({ operation: op.type, path: op.path, success: false });
    }
  }

  return { output: { operations: results } };
}

/**
 * Execute a condition step (evaluate expression, set flag in context)
 */
async function executeConditionStep(
  step: PipelineStepJson,
  ctx: StepExecutionContext
): Promise<{ output: unknown; error?: string }> {
  const config = step.config as {
    expression: string;
    trueValue?: unknown;
    falseValue?: unknown;
  };

  if (!config.expression) {
    throw new Error("Condition step requires expression");
  }

  const exprResult = evaluateExpression(config.expression, ctx.sharedContext);
  const passed = exprResult.success ? exprResult.result : false;

  return {
    output: {
      expression: config.expression,
      passed,
      value: passed ? (config.trueValue ?? true) : (config.falseValue ?? false),
      evaluationError: exprResult.success ? undefined : exprResult.error,
    },
  };
}

/**
 * Execute a delay step
 */
async function executeDelayStep(
  step: PipelineStepJson,
  _ctx: StepExecutionContext
): Promise<{ output: unknown; error?: string }> {
  const config = step.config as { delayMs: number };
  const delayMs = Math.min(config.delayMs || 1000, 300000); // Max 5 min delay

  await new Promise((resolve) => setTimeout(resolve, delayMs));

  return { output: { delayed: delayMs } };
}

// ========================================
// STEP DISPATCHER
// ========================================

async function executeStepByType(
  step: PipelineStepJson,
  ctx: StepExecutionContext
): Promise<{ output: unknown; error?: string }> {
  switch (step.type) {
    case "workflow":
      return executeWorkflowStep(step, ctx);
    case "apiCall":
      return executeApiCallStep(step, ctx);
    case "transform":
      return executeTransformStep(step, ctx);
    case "condition":
      return executeConditionStep(step, ctx);
    case "delay":
      return executeDelayStep(step, ctx);
    default:
      throw new Error(`Unknown pipeline step type: ${step.type}`);
  }
}

// ========================================
// EXECUTION STATUS HELPERS
// ========================================

async function updatePipelineExecution(
  executionId: number,
  updates: Partial<{
    status: string;
    currentStepIndex: number;
    sharedContext: Record<string, unknown>;
    stepResults: PipelineStepResultJson[];
    output: unknown;
    error: string;
    completedAt: Date;
    duration: number;
  }>
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db
    .update(pipelineExecutions)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(pipelineExecutions.id, executionId));
}

// ========================================
// CORE PIPELINE EXECUTION
// ========================================

/**
 * Execute a complete pipeline: run each step sequentially,
 * passing data through shared context.
 */
export async function executePipeline(
  options: ExecutePipelineOptions
): Promise<PipelineExecutionResult> {
  const { pipelineId, userId, variables = {} } = options;

  const db = await getDb();
  if (!db) {
    throw new Error("Database not initialized");
  }

  // 1. Fetch pipeline definition
  const [pipeline] = await db
    .select()
    .from(pipelines)
    .where(and(eq(pipelines.id, pipelineId), eq(pipelines.userId, userId)))
    .limit(1);

  if (!pipeline) {
    throw new Error("Pipeline not found");
  }

  if (!pipeline.isActive) {
    throw new Error("Pipeline is not active");
  }

  const steps = (pipeline.steps as PipelineStepJson[]) || [];
  if (steps.length === 0) {
    throw new Error("Pipeline has no steps");
  }

  // Sort steps by order
  steps.sort((a, b) => a.order - b.order);

  // 2. Create execution record
  const startTime = Date.now();
  const [execution] = await db
    .insert(pipelineExecutions)
    .values({
      pipelineId,
      userId,
      status: "running",
      currentStepIndex: 0,
      sharedContext: { ...variables },
      input: variables,
      stepResults: [],
      startedAt: new Date(),
    })
    .returning();

  const executionId = execution.id;

  // 3. Build execution context
  const ctx: StepExecutionContext = {
    pipelineId,
    executionId,
    userId,
    sharedContext: { ...variables },
    stepResults: [],
  };

  try {
    // 4. Execute steps sequentially
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const stepStartTime = Date.now();

      const stepResult: PipelineStepResultJson = {
        stepIndex: i,
        stepName: step.name,
        type: step.type,
        status: "running",
        startedAt: new Date().toISOString(),
      };

      // Check condition — skip if condition evaluates to false
      if (step.condition) {
        const condResult = evaluateExpression(step.condition, ctx.sharedContext);
        if (condResult.success && !condResult.result) {
          stepResult.status = "skipped";
          stepResult.completedAt = new Date().toISOString();
          stepResult.duration = Date.now() - stepStartTime;
          ctx.stepResults.push(stepResult);

          await updatePipelineExecution(executionId, {
            currentStepIndex: i + 1,
            stepResults: ctx.stepResults,
            sharedContext: ctx.sharedContext,
          });
          continue;
        }
      }

      // Update progress
      await updatePipelineExecution(executionId, {
        currentStepIndex: i,
        stepResults: ctx.stepResults,
        sharedContext: ctx.sharedContext,
      });

      console.log(
        `[Pipeline ${pipelineId}] Executing step ${i + 1}/${steps.length}: ${step.name} (${step.type})`
      );

      // Execute with optional timeout
      let result: { output: unknown; error?: string };
      const stepTimeout = step.timeoutMs || pipeline.timeoutMs || 3600000;

      let retries = step.retryCount || 0;
      let lastError: string | undefined;

      while (true) {
        try {
          result = await Promise.race([
            executeStepByType(step, ctx),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error(`Step timed out after ${stepTimeout}ms`)), stepTimeout)
            ),
          ]);
          lastError = undefined;
          break;
        } catch (err) {
          lastError = err instanceof Error ? err.message : String(err);
          if (retries > 0) {
            retries--;
            console.log(
              `[Pipeline ${pipelineId}] Step ${step.name} failed, retrying (${retries} left): ${lastError}`
            );
            continue;
          }
          break;
        }
      }

      const stepDuration = Date.now() - stepStartTime;

      if (lastError) {
        stepResult.status = "failed";
        stepResult.error = lastError;
        stepResult.completedAt = new Date().toISOString();
        stepResult.duration = stepDuration;
        ctx.stepResults.push(stepResult);

        if (!step.continueOnError) {
          throw new Error(`Step "${step.name}" failed: ${lastError}`);
        }

        // Update and continue to next step
        await updatePipelineExecution(executionId, {
          currentStepIndex: i + 1,
          stepResults: ctx.stepResults,
          sharedContext: ctx.sharedContext,
        });
        continue;
      }

      // Apply output mapping to shared context
      applyOutputMapping(step.outputMapping, result!.output, ctx.sharedContext);

      // Also store step output directly as step_N in context for convenience
      ctx.sharedContext[`step_${i}`] = result!.output;

      stepResult.status = "completed";
      stepResult.output = result!.output;
      stepResult.completedAt = new Date().toISOString();
      stepResult.duration = stepDuration;
      ctx.stepResults.push(stepResult);

      // Update progress
      await updatePipelineExecution(executionId, {
        currentStepIndex: i + 1,
        stepResults: ctx.stepResults,
        sharedContext: ctx.sharedContext,
      });
    }

    // 5. Mark as completed
    const totalDuration = Date.now() - startTime;

    await updatePipelineExecution(executionId, {
      status: "completed",
      completedAt: new Date(),
      duration: totalDuration,
      output: ctx.sharedContext,
      stepResults: ctx.stepResults,
      sharedContext: ctx.sharedContext,
    });

    // Update pipeline statistics
    await db
      .update(pipelines)
      .set({
        executionCount: (pipeline.executionCount || 0) + 1,
        lastExecutedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(pipelines.id, pipelineId));

    return {
      executionId,
      pipelineId,
      status: "completed",
      stepResults: ctx.stepResults,
      sharedContext: ctx.sharedContext,
      output: ctx.sharedContext,
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
      stepResults: ctx.stepResults,
      sharedContext: ctx.sharedContext,
    });

    return {
      executionId,
      pipelineId,
      status: "failed",
      stepResults: ctx.stepResults,
      sharedContext: ctx.sharedContext,
      output: ctx.sharedContext,
      duration: totalDuration,
      error: errorMsg,
    };
  }
}

/**
 * Get pipeline execution status
 */
export async function getPipelineExecutionStatus(
  executionId: number,
  userId: number
): Promise<PipelineExecution | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not initialized");

  const [execution] = await db
    .select()
    .from(pipelineExecutions)
    .where(
      and(
        eq(pipelineExecutions.id, executionId),
        eq(pipelineExecutions.userId, userId)
      )
    )
    .limit(1);

  return execution || null;
}

/**
 * Cancel a running pipeline execution
 */
export async function cancelPipelineExecution(
  executionId: number,
  userId: number
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not initialized");

  const [execution] = await db
    .select()
    .from(pipelineExecutions)
    .where(
      and(
        eq(pipelineExecutions.id, executionId),
        eq(pipelineExecutions.userId, userId)
      )
    )
    .limit(1);

  if (!execution) {
    throw new Error("Pipeline execution not found");
  }

  if (execution.status !== "running" && execution.status !== "pending") {
    throw new Error("Only running or pending executions can be cancelled");
  }

  await updatePipelineExecution(executionId, {
    status: "cancelled",
    completedAt: new Date(),
    error: "Cancelled by user",
  });
}
