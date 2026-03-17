/**
 * Tests for ExecutionRetryService
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ErrorType, ErrorSeverity } from "../../lib/errorTypes";

// Mock dependencies before importing the service
vi.mock("../../db", () => ({
  getDb: vi.fn().mockResolvedValue(null),
}));

vi.mock("../agentOrchestrator.service", () => ({
  getAgentOrchestrator: vi.fn().mockReturnValue({
    executeTask: vi.fn(),
  }),
}));

// Import after mocks
import { getExecutionRetryService } from "../executionRetry.service";
import { getAgentOrchestrator } from "../agentOrchestrator.service";
import type { AgentExecutionResult } from "../agentOrchestrator.service";

describe("ExecutionRetryService", () => {
  let service: ReturnType<typeof getExecutionRetryService>;
  let mockOrchestrator: ReturnType<typeof getAgentOrchestrator>;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset singleton by clearing the module cache effect
    service = getExecutionRetryService();
    mockOrchestrator = getAgentOrchestrator();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const makeResult = (
    overrides: Partial<AgentExecutionResult> = {}
  ): AgentExecutionResult => ({
    executionId: 1,
    status: "completed",
    plan: null,
    output: {},
    thinkingSteps: [],
    toolHistory: [],
    iterations: 5,
    duration: 10000,
    ...overrides,
  });

  describe("executeWithRetry", () => {
    it("should return immediately on successful execution", async () => {
      const successResult = makeResult({ status: "completed" });
      vi.mocked(mockOrchestrator.executeTask).mockResolvedValueOnce(successResult);

      const result = await service.executeWithRetry({
        userId: 1,
        taskDescription: "test task",
        taskId: 100,
      });

      expect(result.finalSuccess).toBe(true);
      expect(result.totalAttempts).toBe(1);
      expect(result.retriedErrors).toHaveLength(0);
      expect(result.executionResult.status).toBe("completed");
      expect(mockOrchestrator.executeTask).toHaveBeenCalledTimes(1);
    });

    it("should return immediately on needs_input status", async () => {
      const needsInputResult = makeResult({ status: "needs_input" });
      vi.mocked(mockOrchestrator.executeTask).mockResolvedValueOnce(needsInputResult);

      const result = await service.executeWithRetry({
        userId: 1,
        taskDescription: "test task",
        taskId: 100,
      });

      expect(result.finalSuccess).toBe(false);
      expect(result.totalAttempts).toBe(1);
      expect(result.executionResult.status).toBe("needs_input");
    });

    it("should retry on transient failure and succeed", async () => {
      const failResult = makeResult({
        status: "failed",
        error: "Connection timeout",
      });
      const successResult = makeResult({ status: "completed" });

      vi.mocked(mockOrchestrator.executeTask)
        .mockResolvedValueOnce(failResult)
        .mockResolvedValueOnce(successResult);

      const result = await service.executeWithRetry(
        {
          userId: 1,
          taskDescription: "test task",
          taskId: 100,
        },
        {
          retryPolicy: { maxAttempts: 3, initialDelayMs: 10, maxDelayMs: 50 },
        }
      );

      expect(result.finalSuccess).toBe(true);
      expect(result.totalAttempts).toBe(2);
      expect(result.retriedErrors).toHaveLength(1);
      expect(result.retriedErrors[0].errorType).toBe(ErrorType.TIMEOUT);
      expect(mockOrchestrator.executeTask).toHaveBeenCalledTimes(2);
    });

    it("should not retry non-retryable errors", async () => {
      const failResult = makeResult({
        status: "failed",
        error: "Permission denied: access forbidden",
      });

      vi.mocked(mockOrchestrator.executeTask).mockResolvedValueOnce(failResult);

      const result = await service.executeWithRetry(
        {
          userId: 1,
          taskDescription: "test task",
          taskId: 100,
        },
        {
          retryPolicy: { maxAttempts: 3, initialDelayMs: 10 },
        }
      );

      expect(result.finalSuccess).toBe(false);
      expect(result.totalAttempts).toBe(1);
      expect(result.retriedErrors).toHaveLength(0);
      expect(mockOrchestrator.executeTask).toHaveBeenCalledTimes(1);
    });

    it("should stop retrying after max attempts", async () => {
      const failResult = makeResult({
        status: "failed",
        error: "Network error: connection reset",
      });

      vi.mocked(mockOrchestrator.executeTask).mockResolvedValue(failResult);

      const result = await service.executeWithRetry(
        {
          userId: 1,
          taskDescription: "test task",
          taskId: 100,
        },
        {
          retryPolicy: { maxAttempts: 2, initialDelayMs: 10, maxDelayMs: 50 },
        }
      );

      expect(result.finalSuccess).toBe(false);
      expect(result.totalAttempts).toBe(2);
      expect(result.retriedErrors).toHaveLength(1);
      expect(mockOrchestrator.executeTask).toHaveBeenCalledTimes(2);
    });

    it("should call onRetry callback", async () => {
      const failResult = makeResult({
        status: "failed",
        error: "Server error: status 500",
      });
      const successResult = makeResult({ status: "completed" });

      vi.mocked(mockOrchestrator.executeTask)
        .mockResolvedValueOnce(failResult)
        .mockResolvedValueOnce(successResult);

      const onRetry = vi.fn();

      await service.executeWithRetry(
        {
          userId: 1,
          taskDescription: "test task",
          taskId: 100,
        },
        {
          retryPolicy: { maxAttempts: 3, initialDelayMs: 10, maxDelayMs: 50 },
          onRetry,
        }
      );

      expect(onRetry).toHaveBeenCalledTimes(1);
      expect(onRetry).toHaveBeenCalledWith(
        1,
        "Server error: status 500",
        expect.any(Number)
      );
    });

    it("should handle thrown errors with retry", async () => {
      vi.mocked(mockOrchestrator.executeTask)
        .mockRejectedValueOnce(new Error("Network error: fetch failed"))
        .mockResolvedValueOnce(makeResult({ status: "completed" }));

      const result = await service.executeWithRetry(
        {
          userId: 1,
          taskDescription: "test task",
          taskId: 100,
        },
        {
          retryPolicy: { maxAttempts: 3, initialDelayMs: 10, maxDelayMs: 50 },
        }
      );

      expect(result.finalSuccess).toBe(true);
      expect(result.totalAttempts).toBe(2);
    });

    it("should throw on non-retryable thrown errors", async () => {
      vi.mocked(mockOrchestrator.executeTask).mockRejectedValueOnce(
        new Error("Validation error: invalid input")
      );

      await expect(
        service.executeWithRetry(
          {
            userId: 1,
            taskDescription: "test task",
            taskId: 100,
          },
          {
            retryPolicy: { maxAttempts: 3, initialDelayMs: 10 },
          }
        )
      ).rejects.toThrow("Validation error");
    });
  });

  describe("isRetryEligible", () => {
    it("should return eligible for timeout errors", () => {
      const result = service.isRetryEligible("Connection timeout");
      expect(result.eligible).toBe(true);
      expect(result.errorType).toBe(ErrorType.TIMEOUT);
    });

    it("should return eligible for network errors", () => {
      const result = service.isRetryEligible("Network error: fetch failed");
      expect(result.eligible).toBe(true);
      expect(result.errorType).toBe(ErrorType.NETWORK_ERROR);
    });

    it("should return eligible for 5xx server errors", () => {
      const result = service.isRetryEligible("Server error: status 503");
      expect(result.eligible).toBe(true);
      expect(result.errorType).toBe(ErrorType.HTTP_5XX);
    });

    it("should return not eligible for auth errors", () => {
      const result = service.isRetryEligible("Authentication failed: unauthorized");
      expect(result.eligible).toBe(false);
      expect(result.errorType).toBe(ErrorType.AUTH_FAILED);
    });

    it("should return not eligible for permission errors", () => {
      const result = service.isRetryEligible("Permission denied");
      expect(result.eligible).toBe(false);
      expect(result.errorType).toBe(ErrorType.PERMISSION_DENIED);
    });

    it("should return not eligible for validation errors", () => {
      const result = service.isRetryEligible("Validation error: field required");
      expect(result.eligible).toBe(false);
      expect(result.errorType).toBe(ErrorType.VALIDATION_ERROR);
    });
  });

  describe("cancelRetry", () => {
    it("should return false when no active retry", () => {
      expect(service.cancelRetry(999)).toBe(false);
    });

    it("should return true and cancel active retry", async () => {
      // Start a retry that will take a while
      const failResult = makeResult({
        status: "failed",
        error: "Network error: connection reset",
      });
      vi.mocked(mockOrchestrator.executeTask).mockResolvedValue(failResult);

      // Start the retry in the background (it will keep retrying)
      const retryPromise = service.executeWithRetry(
        {
          userId: 1,
          taskDescription: "test task",
          taskId: 200,
        },
        {
          retryPolicy: { maxAttempts: 5, initialDelayMs: 100, maxDelayMs: 200 },
        }
      );

      // Wait a bit then check if we can detect the active retry
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(service.isRetrying(200)).toBe(true);

      // Cancel it
      expect(service.cancelRetry(200)).toBe(true);

      // Wait for the promise to resolve
      const result = await retryPromise;
      expect(result.finalSuccess).toBe(false);
    });
  });

  describe("getRetryAttempt", () => {
    it("should return null when no active retry", () => {
      expect(service.getRetryAttempt(999)).toBeNull();
    });
  });
});
