/**
 * Pipeline Execution Service Tests
 * Tests for multi-step workflow pipeline execution with data passing
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import type { PipelineStepDefinition } from "../types";

// ========================================
// MOCK SETUP
// ========================================

/**
 * Create a chainable mock DB that supports multiple query chains.
 * Each call to select/insert/update starts a fresh chain.
 */
function createMockDb() {
  const queryResults: unknown[][] = [];
  let resultIndex = 0;

  function createChain(): Record<string, any> {
    const chain: Record<string, any> = {};
    const methods = ["select", "from", "where", "limit", "insert", "values",
      "returning", "update", "set", "orderBy", "offset"];
    for (const m of methods) {
      chain[m] = vi.fn(() => chain);
    }
    // limit() and returning() resolve from the queue
    chain.limit = vi.fn(() => {
      const idx = resultIndex++;
      return Promise.resolve(queryResults[idx] ?? []);
    });
    chain.returning = vi.fn(() => {
      const idx = resultIndex++;
      return Promise.resolve(queryResults[idx] ?? []);
    });
    // where() after update().set() also needs to resolve
    const origWhere = chain.where;
    chain.where = vi.fn((...args: any[]) => {
      // Return the chain so limit/returning can be called
      return chain;
    });
    return chain;
  }

  const rootChain = createChain();

  return {
    ...rootChain,
    _results: queryResults,
    _resetIndex() { resultIndex = 0; },
    _pushResult(result: unknown[]) { queryResults.push(result); },
  };
}

const mockDb = createMockDb();

vi.mock("../db", () => ({
  getDb: vi.fn(() => Promise.resolve(mockDb)),
}));

vi.mock("../lib/safeExpressionParser", () => ({
  evaluateExpression: vi.fn((expr: string, vars: Record<string, unknown>) => {
    if (expr === "true") return { success: true, result: true };
    if (expr === "false") return { success: true, result: false };
    // Simple variable lookup
    if (vars[expr] !== undefined) return { success: true, result: vars[expr] };
    return { success: true, result: true };
  }),
}));

vi.mock("../_core/variableSubstitution", () => ({
  substituteVariables: vi.fn((val: unknown, vars: Record<string, unknown>) => {
    if (typeof val === "string") {
      // Simple {{var}} substitution for tests
      return val.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (_match, key) => {
        const parts = key.split(".");
        let current: any = vars;
        for (const part of parts) {
          current = current?.[part];
        }
        return current !== undefined ? String(current) : "";
      });
    }
    return val;
  }),
}));

// Mock the workflow execution service (used by workflow-type steps)
vi.mock("./workflowExecution.service", () => ({
  executeWorkflow: vi.fn(() =>
    Promise.resolve({
      executionId: 100,
      status: "completed",
      output: { extractedData: [{ data: "test" }], finalVariables: { result: "ok" } },
      stepResults: [],
    })
  ),
}));

// ========================================
// IMPORT AFTER MOCKS
// ========================================

import {
  executePipeline,
  getPipelineExecutionStatus,
  cancelPipelineExecution,
} from "./pipelineExecution.service";

// ========================================
// HELPERS
// ========================================

function mockPipeline(steps: PipelineStepDefinition[], overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    userId: 1,
    name: "Test Pipeline",
    description: "Test",
    steps,
    trigger: "manual",
    isActive: true,
    executionCount: 0,
    lastExecutedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function mockExecution(overrides: Record<string, unknown> = {}) {
  return {
    id: 10,
    pipelineId: 1,
    userId: 1,
    status: "running",
    input: {},
    output: null,
    error: null,
    currentStepIndex: 0,
    totalSteps: 2,
    stepResults: null,
    startedAt: new Date(),
    completedAt: null,
    duration: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// ========================================
// TESTS
// ========================================

describe("Pipeline Execution Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb._results.length = 0;
    mockDb._resetIndex();
  });

  describe("executePipeline", () => {
    it("should execute a pipeline with an inline notification step", async () => {
      const steps: PipelineStepDefinition[] = [
        {
          stepId: "step1",
          type: "inline",
          inlineConfig: { type: "notification", message: "Test notification" },
        },
      ];

      // 1: select pipeline, 2: insert execution, 3+: updates (progress, completion, stats)
      mockDb._pushResult([mockPipeline(steps)]);
      mockDb._pushResult([mockExecution({ totalSteps: 1 })]);

      const result = await executePipeline({
        pipelineId: 1,
        userId: 1,
        variables: { name: "Julian" },
      });

      expect(result.status).toBe("completed");
      expect(result.stepResults).toHaveLength(1);
      expect(result.stepResults[0].stepId).toBe("step1");
      expect(result.stepResults[0].status).toBe("completed");
    });

    it("should pass data between steps via inputMapping", async () => {
      const steps: PipelineStepDefinition[] = [
        {
          stepId: "step1",
          type: "inline",
          inlineConfig: { type: "notification", message: "First" },
        },
        {
          stepId: "step2",
          type: "inline",
          inlineConfig: { type: "notification", message: "Got: {{step1.message}}" },
          inputMapping: { prevResult: "{{step1}}" },
        },
      ];

      mockDb._pushResult([mockPipeline(steps)]);
      mockDb._pushResult([mockExecution({ totalSteps: 2 })]);

      const result = await executePipeline({
        pipelineId: 1,
        userId: 1,
      });

      expect(result.status).toBe("completed");
      expect(result.stepResults).toHaveLength(2);
      expect(result.stepResults[0].status).toBe("completed");
      expect(result.stepResults[1].status).toBe("completed");
    });

    it("should skip steps when condition evaluates to false", async () => {
      const steps: PipelineStepDefinition[] = [
        {
          stepId: "step1",
          type: "inline",
          inlineConfig: { type: "notification", message: "Always runs" },
        },
        {
          stepId: "step2",
          type: "inline",
          inlineConfig: { type: "notification", message: "Skipped" },
          condition: "false",
        },
      ];

      mockDb._pushResult([mockPipeline(steps)]);
      mockDb._pushResult([mockExecution({ totalSteps: 2 })]);

      const result = await executePipeline({
        pipelineId: 1,
        userId: 1,
      });

      expect(result.status).toBe("completed");
      expect(result.stepResults).toHaveLength(2);
      expect(result.stepResults[0].status).toBe("completed");
      expect(result.stepResults[1].status).toBe("skipped");
    });

    it("should fail pipeline when step fails and continueOnError is false", async () => {
      const steps: PipelineStepDefinition[] = [
        {
          stepId: "bad_step",
          type: "inline",
          // Missing inlineConfig — will throw
        } as PipelineStepDefinition,
      ];

      mockDb._pushResult([mockPipeline(steps)]);
      mockDb._pushResult([mockExecution({ totalSteps: 1 })]);

      await expect(
        executePipeline({ pipelineId: 1, userId: 1 })
      ).rejects.toThrow('Pipeline step "bad_step" failed');
    });

    it("should continue when step fails and continueOnError is true", async () => {
      const steps: PipelineStepDefinition[] = [
        {
          stepId: "bad_step",
          type: "inline",
          continueOnError: true,
          // Missing inlineConfig — will fail but continue
        } as PipelineStepDefinition,
        {
          stepId: "good_step",
          type: "inline",
          inlineConfig: { type: "notification", message: "Still running" },
        },
      ];

      mockDb._pushResult([mockPipeline(steps)]);
      mockDb._pushResult([mockExecution({ totalSteps: 2 })]);

      const result = await executePipeline({
        pipelineId: 1,
        userId: 1,
      });

      expect(result.status).toBe("completed");
      expect(result.stepResults[0].status).toBe("failed");
      expect(result.stepResults[1].status).toBe("completed");
    });

    it("should throw if pipeline not found", async () => {
      mockDb._pushResult([]);

      await expect(
        executePipeline({ pipelineId: 999, userId: 1 })
      ).rejects.toThrow("Pipeline not found");
    });

    it("should throw if pipeline is inactive", async () => {
      mockDb._pushResult([mockPipeline([], { isActive: false })]);

      await expect(
        executePipeline({ pipelineId: 1, userId: 1 })
      ).rejects.toThrow("Pipeline is not active");
    });
  });

  describe("getPipelineExecutionStatus", () => {
    it("should return execution status", async () => {
      mockDb._pushResult([
        mockExecution({
          status: "completed",
          stepResults: [{ stepId: "s1", status: "completed" }],
        }),
      ]);

      const status = await getPipelineExecutionStatus(10);
      expect(status.executionId).toBe(10);
      expect(status.status).toBe("completed");
      expect(status.stepResults).toHaveLength(1);
    });

    it("should throw if execution not found", async () => {
      mockDb._pushResult([]);

      await expect(getPipelineExecutionStatus(999)).rejects.toThrow(
        "Pipeline execution not found"
      );
    });
  });

  describe("cancelPipelineExecution", () => {
    it("should cancel a running execution", async () => {
      mockDb._pushResult([mockExecution({ status: "running" })]);

      await expect(cancelPipelineExecution(10)).resolves.toBeUndefined();
    });

    it("should throw when cancelling a non-running execution", async () => {
      mockDb._pushResult([mockExecution({ status: "completed" })]);

      await expect(cancelPipelineExecution(10)).rejects.toThrow(
        "Only running pipeline executions can be cancelled"
      );
    });
  });
});
