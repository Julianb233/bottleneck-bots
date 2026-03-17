/**
 * E2E Test: Agent Training Pipeline
 *
 * Full end-to-end test covering:
 * 1. Create agent session
 * 2. Train with documents (RAG ingestion)
 * 3. Customize settings (knowledge entries, brand voice)
 * 4. Execute task
 * 5. Verify output quality
 *
 * Linear: AI-2875
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { TRPCError } from "@trpc/server";

// Hoist mock functions and env vars so vi.mock factories can reference them
const {
  mockRagIngest,
  mockRagRetrieve,
  mockRagBuildSystemPrompt,
  mockRagBuildContext,
  mockRagDeleteSource,
  mockRagUpdateSource,
  mockRagIngestUrl,
  mockExecuteTask,
  mockGetExecutionStatus,
} = vi.hoisted(() => {
  process.env.ENCRYPTION_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
  process.env.ANTHROPIC_API_KEY = "test-anthropic-api-key";
  process.env.OPENAI_API_KEY = "test-openai-api-key";
  process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
  process.env.GOOGLE_CLIENT_ID = "test-google-client-id";
  process.env.GOOGLE_CLIENT_SECRET = "test-google-secret";

  return {
    mockRagIngest: vi.fn(),
    mockRagRetrieve: vi.fn(),
    mockRagBuildSystemPrompt: vi.fn(),
    mockRagBuildContext: vi.fn(),
    mockRagDeleteSource: vi.fn(),
    mockRagUpdateSource: vi.fn(),
    mockRagIngestUrl: vi.fn(),
    mockExecuteTask: vi.fn(),
    mockGetExecutionStatus: vi.fn(),
  };
});

// ========================================
// Mock dependencies
// ========================================

vi.mock("@/server/db");

// Mock stagehand to prevent module loading errors
vi.mock("@browserbasehq/stagehand", () => ({
  Stagehand: vi.fn().mockImplementation(() => ({
    init: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    act: vi.fn().mockResolvedValue({ success: true }),
    observe: vi.fn().mockResolvedValue([]),
    extract: vi.fn().mockResolvedValue({}),
    context: { pages: vi.fn().mockReturnValue([]) },
    page: {},
  })),
}));

// Mock browserbase SDK
vi.mock("@/server/_core/browserbaseSDK", () => ({
  browserbaseSDK: {
    createSession: vi.fn().mockResolvedValue({ id: "session-123" }),
    terminateSession: vi.fn().mockResolvedValue({ success: true }),
  },
}));

// Mock RAG service
vi.mock("@/server/services/rag.service", () => ({
  ragService: {
    ingest: mockRagIngest,
    retrieve: mockRagRetrieve,
    buildSystemPrompt: mockRagBuildSystemPrompt,
    buildContext: mockRagBuildContext,
    deleteSource: mockRagDeleteSource,
    updateSource: mockRagUpdateSource,
    ingestUrl: mockRagIngestUrl,
  },
}));

// Mock platform detection service
vi.mock("@/server/services/platformDetection.service", () => ({
  platformDetectionService: {
    detect: vi.fn().mockResolvedValue({
      platforms: ["general"],
      primaryPlatform: "general",
      isDnsRelated: false,
      isDomainRelated: false,
    }),
    seedPlatformKeywords: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock document parser service
vi.mock("@/server/services/document-parser.service", () => ({
  documentParserService: {
    parse: vi.fn().mockResolvedValue({
      text: "This is parsed document content for training the AI agent. It contains important business processes and workflows that the agent needs to learn.",
      metadata: {
        format: "markdown",
        title: "Training Document",
        wordCount: 25,
        pageCount: 1,
      },
    }),
  },
}));

// Mock agent orchestrator
vi.mock("@/server/services/agentOrchestrator.service", () => ({
  getAgentOrchestrator: vi.fn(() => ({
    executeTask: mockExecuteTask,
    getExecutionStatus: mockGetExecutionStatus,
  })),
}));

// Mock subscription service
vi.mock("@/server/services/subscription.service", () => ({
  getSubscriptionService: vi.fn(() => ({
    canExecuteTask: vi.fn().mockResolvedValue({
      allowed: true,
      reason: null,
      upgradeRequired: false,
      suggestedAction: null,
      currentUsage: 5,
      limit: 100,
    }),
    incrementExecutionUsage: vi.fn().mockResolvedValue(undefined),
  })),
}));

// Mock validation services
vi.mock("@/server/services/apiKeyValidation.service", () => ({
  apiKeyValidationService: {
    validateOpenAI: vi.fn().mockResolvedValue({ valid: true }),
    validateAnthropic: vi.fn().mockResolvedValue({ valid: true }),
    validateService: vi.fn().mockResolvedValue({ valid: true }),
  },
}));

vi.mock("@/server/services/validationCache.service", () => ({
  validationCache: {
    get: vi.fn().mockReturnValue(null),
    set: vi.fn(),
  },
  ValidationCacheService: {
    generateKey: vi.fn().mockReturnValue("cache-key"),
  },
}));

import { ragRouter } from "./rag";
import { knowledgeManagementRouter } from "./knowledgeManagement";
import { agentRouter } from "./agent";
import {
  createMockContext,
  mockEnv,
} from "@/__tests__/helpers/test-helpers";
import { createTestDb } from "@/__tests__/helpers/test-db";

// ========================================
// TEST SUITE
// ========================================

describe("Agent Training E2E Pipeline", () => {
  let mockCtx: any;
  let restoreEnv: () => void;

  beforeEach(() => {
    mockCtx = createMockContext({ id: 1 });
    vi.clearAllMocks();

    restoreEnv = mockEnv({
      DATABASE_URL: "postgresql://test:test@localhost/test",
      ANTHROPIC_API_KEY: "test-anthropic-api-key",
      OPENAI_API_KEY: "test-openai-api-key",
    });
  });

  afterEach(() => {
    restoreEnv();
    vi.restoreAllMocks();
  });

  // ========================================
  // STEP 1: Document Ingestion (RAG Training)
  // ========================================

  describe("Step 1: Train agent with documents", () => {
    it("should ingest a text document into the RAG system", async () => {
      mockRagIngest.mockResolvedValueOnce({
        sourceId: 1,
        chunkCount: 3,
        totalTokens: 450,
      });

      const caller = ragRouter.createCaller(mockCtx);
      const result = await caller.ingestDocument({
        platform: "general",
        category: "training",
        title: "Customer Service Guidelines",
        content:
          "When a customer calls with a complaint, always start by acknowledging their frustration. " +
          "Use empathetic language such as 'I understand how frustrating this must be.' " +
          "Then ask clarifying questions to understand the root cause. " +
          "Document the issue in the CRM system and provide a resolution timeline.",
      });

      expect(result.success).toBe(true);
      expect(result.sourceId).toBe(1);
      expect(result.chunkCount).toBe(3);
      expect(result.totalTokens).toBe(450);
      expect(mockRagIngest).toHaveBeenCalledWith(
        expect.objectContaining({
          platform: "general",
          category: "training",
          title: "Customer Service Guidelines",
          userId: 1,
        })
      );
    });

    it("should upload and parse a file document for training", async () => {
      mockRagIngest.mockResolvedValueOnce({
        sourceId: 2,
        chunkCount: 5,
        totalTokens: 800,
      });

      // Base64-encoded content simulating a small text file
      const fileContent = Buffer.from(
        "Standard Operating Procedures for lead follow-up. Step 1: Contact lead within 24 hours."
      ).toString("base64");

      const caller = ragRouter.createCaller(mockCtx);
      const result = await caller.uploadDocument({
        fileContent,
        filename: "sop-lead-followup.md",
        mimeType: "text/markdown",
        platform: "general",
        category: "training",
        title: "Lead Follow-up SOP",
      });

      expect(result.success).toBe(true);
      expect(result.sourceId).toBe(2);
      expect(result.chunkCount).toBe(5);
      expect(result.metadata).toBeDefined();
      expect(result.metadata.format).toBe("markdown");
    });

    it("should reject documents that are too short", async () => {
      const { documentParserService } = await import(
        "@/server/services/document-parser.service"
      );
      vi.mocked(documentParserService.parse).mockResolvedValueOnce({
        text: "Too short",
        metadata: { format: "markdown", title: "Short", wordCount: 2, pageCount: 1 },
      } as any);

      const caller = ragRouter.createCaller(mockCtx);
      await expect(
        caller.uploadDocument({
          fileContent: Buffer.from("hi").toString("base64"),
          filename: "short.md",
        })
      ).rejects.toThrow();
    });

    it("should ingest multiple training documents for comprehensive training", async () => {
      // Simulate ingesting a workflow doc
      mockRagIngest.mockResolvedValueOnce({
        sourceId: 3,
        chunkCount: 2,
        totalTokens: 300,
      });

      const caller = ragRouter.createCaller(mockCtx);
      const result1 = await caller.ingestDocument({
        platform: "general",
        category: "workflow",
        title: "Email Response Workflow",
        content:
          "When receiving a new email inquiry: 1) Check if the sender is an existing client. " +
          "2) If yes, pull their profile from the CRM. 3) Craft a personalized response. " +
          "4) Include relevant product recommendations based on their purchase history.",
      });

      expect(result1.success).toBe(true);
      expect(result1.sourceId).toBe(3);

      // Simulate ingesting a brand voice doc
      mockRagIngest.mockResolvedValueOnce({
        sourceId: 4,
        chunkCount: 1,
        totalTokens: 150,
      });

      const result2 = await caller.ingestDocument({
        platform: "general",
        category: "training",
        title: "Brand Voice Guide",
        content:
          "Our brand voice is professional yet approachable. We use clear, jargon-free language. " +
          "Always sign off with the company name. Avoid using exclamation marks excessively.",
      });

      expect(result2.success).toBe(true);
      expect(result2.sourceId).toBe(4);
    });
  });

  // ========================================
  // STEP 2: Knowledge Entry Creation
  // ========================================

  describe("Step 2: Customize agent with knowledge entries", () => {
    it("should create a workflow knowledge entry", async () => {
      const entry = {
        id: 1,
        userId: 1,
        category: "workflow",
        context: "When handling customer complaints",
        content:
          "Follow the CARE framework: Connect, Acknowledge, Resolve, Evaluate. " +
          "Always log the interaction in the system.",
        examples: [
          { scenario: "Billing dispute", resolution: "Offer credit and escalate" },
        ],
        confidence: "0.95",
        usageCount: 0,
        isActive: true,
        createdAt: new Date(),
      };

      const db = createTestDb({
        insertResponse: [entry],
      });

      const dbModule = await import("@/server/db");
      vi.mocked(dbModule.getDb).mockImplementation(() =>
        Promise.resolve(db as any)
      );

      const caller = knowledgeManagementRouter.createCaller(mockCtx);
      const result = await caller.createEntry({
        category: "workflow",
        context: "When handling customer complaints",
        content:
          "Follow the CARE framework: Connect, Acknowledge, Resolve, Evaluate. " +
          "Always log the interaction in the system.",
        examples: [
          { scenario: "Billing dispute", resolution: "Offer credit and escalate" },
        ],
        confidence: 0.95,
      });

      expect(result.success).toBe(true);
      expect(result.entry).toBeDefined();
      expect(result.entry.category).toBe("workflow");
      expect(result.entry.confidence).toBe("0.95");
    });

    it("should create a brand_voice knowledge entry", async () => {
      const entry = {
        id: 2,
        userId: 1,
        category: "brand_voice",
        context: "All customer communications",
        content:
          "Tone: Professional but friendly. Never use slang. " +
          "Always address the customer by their first name. " +
          "Sign off with 'Best regards, The Support Team'.",
        examples: null,
        confidence: "1.00",
        usageCount: 0,
        isActive: true,
        createdAt: new Date(),
      };

      const db = createTestDb({
        insertResponse: [entry],
      });

      const dbModule = await import("@/server/db");
      vi.mocked(dbModule.getDb).mockImplementation(() =>
        Promise.resolve(db as any)
      );

      const caller = knowledgeManagementRouter.createCaller(mockCtx);
      const result = await caller.createEntry({
        category: "brand_voice",
        context: "All customer communications",
        content:
          "Tone: Professional but friendly. Never use slang. " +
          "Always address the customer by their first name. " +
          "Sign off with 'Best regards, The Support Team'.",
        confidence: 1.0,
      });

      expect(result.success).toBe(true);
      expect(result.entry.category).toBe("brand_voice");
    });

    it("should create a technical knowledge entry", async () => {
      const entry = {
        id: 3,
        userId: 1,
        category: "technical",
        context: "API integration patterns",
        content:
          "Use retry with exponential backoff for all external API calls. " +
          "Maximum 3 retries. Log all failures to the monitoring system. " +
          "Set timeout to 30 seconds for HTTP requests.",
        examples: [
          { api: "Stripe", retryPolicy: "3 retries, 1s/2s/4s backoff" },
          { api: "SendGrid", retryPolicy: "3 retries, 2s/4s/8s backoff" },
        ],
        confidence: "0.90",
        usageCount: 0,
        isActive: true,
        createdAt: new Date(),
      };

      const db = createTestDb({
        insertResponse: [entry],
      });

      const dbModule = await import("@/server/db");
      vi.mocked(dbModule.getDb).mockImplementation(() =>
        Promise.resolve(db as any)
      );

      const caller = knowledgeManagementRouter.createCaller(mockCtx);
      const result = await caller.createEntry({
        category: "technical",
        context: "API integration patterns",
        content:
          "Use retry with exponential backoff for all external API calls. " +
          "Maximum 3 retries. Log all failures to the monitoring system. " +
          "Set timeout to 30 seconds for HTTP requests.",
        examples: [
          { api: "Stripe", retryPolicy: "3 retries, 1s/2s/4s backoff" },
          { api: "SendGrid", retryPolicy: "3 retries, 2s/4s/8s backoff" },
        ],
        confidence: 0.9,
      });

      expect(result.success).toBe(true);
      expect(result.entry.category).toBe("technical");
    });

    it("should list all knowledge entries after creation", async () => {
      const entries = [
        {
          id: 1,
          userId: 1,
          category: "workflow",
          context: "When handling customer complaints",
          content: "Follow the CARE framework",
          confidence: "0.95",
          usageCount: 0,
          isActive: true,
          createdAt: new Date(),
        },
        {
          id: 2,
          userId: 1,
          category: "brand_voice",
          context: "All customer communications",
          content: "Tone: Professional but friendly",
          confidence: "1.00",
          usageCount: 0,
          isActive: true,
          createdAt: new Date(),
        },
        {
          id: 3,
          userId: 1,
          category: "technical",
          context: "API integration patterns",
          content: "Use retry with exponential backoff",
          confidence: "0.90",
          usageCount: 0,
          isActive: true,
          createdAt: new Date(),
        },
      ];

      // First call returns entries, second call returns count
      const db = createTestDb({
        selectResponse: entries,
      });

      const dbModule = await import("@/server/db");
      vi.mocked(dbModule.getDb).mockImplementation(() =>
        Promise.resolve(db as any)
      );

      const caller = knowledgeManagementRouter.createCaller(mockCtx);
      const result = await caller.getEntries({
        sortBy: "createdAt",
        sortOrder: "desc",
        limit: 50,
        offset: 0,
      });

      expect(result.entries).toHaveLength(3);
      expect(result.entries[0].category).toBe("workflow");
      expect(result.entries[1].category).toBe("brand_voice");
      expect(result.entries[2].category).toBe("technical");
    });

    it("should update a knowledge entry", async () => {
      const existingEntry = {
        id: 1,
        userId: 1,
        category: "workflow",
        context: "When handling customer complaints",
        content: "Follow the CARE framework",
        confidence: "0.95",
        usageCount: 3,
        isActive: true,
        createdAt: new Date(),
      };

      const updatedEntry = {
        ...existingEntry,
        content:
          "Follow the CARE+ framework: Connect, Acknowledge, Resolve, Evaluate, Follow-up. " +
          "Always schedule a follow-up within 48 hours.",
        confidence: "0.98",
      };

      // Mock: first select returns existing, then insert for edit history, then update returns updated
      const db = createTestDb({
        selectResponse: [existingEntry],
        updateResponse: [updatedEntry],
        insertResponse: [{ id: 1 }],
      });

      const dbModule = await import("@/server/db");
      vi.mocked(dbModule.getDb).mockImplementation(() =>
        Promise.resolve(db as any)
      );

      const caller = knowledgeManagementRouter.createCaller(mockCtx);
      const result = await caller.updateEntry({
        id: 1,
        content:
          "Follow the CARE+ framework: Connect, Acknowledge, Resolve, Evaluate, Follow-up. " +
          "Always schedule a follow-up within 48 hours.",
        confidence: 0.98,
        reason: "Added follow-up step based on customer feedback",
      });

      expect(result.success).toBe(true);
      expect(result.entry).toBeDefined();
    });
  });

  // ========================================
  // STEP 3: Agent Task Execution
  // ========================================

  describe("Step 3: Execute agent task with trained knowledge", () => {
    it("should execute a task using the trained agent", async () => {
      const executionResult = {
        executionId: 1,
        status: "completed" as const,
        plan: {
          goal: "Draft a response to customer complaint about billing",
          phases: [
            {
              id: 1,
              name: "Analyze complaint",
              description: "Understand the customer issue",
              successCriteria: ["Identify root cause"],
              status: "completed",
            },
            {
              id: 2,
              name: "Draft response",
              description: "Create empathetic response using brand voice",
              successCriteria: ["Response follows brand guidelines"],
              status: "completed",
            },
          ],
          currentPhaseId: 2,
          estimatedSteps: 4,
          estimatedDuration: 120000,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        thinkingSteps: [
          {
            timestamp: new Date(),
            phase: "analyzing",
            understanding: "Customer is upset about an unexpected billing charge",
            nextAction: "Draft empathetic response following CARE framework",
            reasoning:
              "Based on the knowledge entry, I should follow the CARE framework " +
              "and use the brand voice guidelines",
            toolSelected: "update_plan",
          },
          {
            timestamp: new Date(),
            phase: "executing",
            understanding: "Drafting response with professional but friendly tone",
            nextAction: "Complete the response and review",
            reasoning:
              "Following brand voice: professional yet approachable, addressing by first name",
          },
        ],
        toolHistory: [
          {
            timestamp: new Date(),
            toolName: "update_plan",
            parameters: { goal: "Draft customer response" },
            result: { success: true },
            success: true,
            duration: 150,
          },
        ],
        output:
          "Dear John,\n\n" +
          "I understand how frustrating unexpected charges can be, and I appreciate you reaching out. " +
          "After reviewing your account, I can see the charge was due to a system error. " +
          "I've issued a full refund which will appear within 3-5 business days.\n\n" +
          "Best regards, The Support Team",
        iterations: 5,
        duration: 8500,
      };

      mockExecuteTask.mockResolvedValueOnce(executionResult);

      const caller = agentRouter.createCaller(mockCtx);
      const result = await caller.executeTask({
        taskDescription:
          "Draft a professional response to a customer who is complaining about an unexpected billing charge of $49.99 on their account. The customer's name is John.",
        context: {
          customerName: "John",
          chargeAmount: 49.99,
          accountId: "ACC-12345",
        },
        maxIterations: 20,
      });

      expect(result.success).toBe(true);
      expect(result.executionId).toBe(1);
      expect(result.status).toBe("completed");
      expect(result.iterations).toBe(5);
      expect(result.duration).toBe(8500);

      // Verify plan was created
      expect(result.plan).toBeDefined();
      expect(result.plan!.phases).toHaveLength(2);

      // Verify thinking steps were recorded
      expect(result.thinkingSteps).toHaveLength(2);

      // Verify the output content quality
      expect(result.output).toBeDefined();
      const output = result.output as string;
      expect(output).toContain("John"); // Personalized
      expect(output).toContain("Best regards"); // Brand voice
    });

    it("should handle subscription limit checks before execution", async () => {
      const { getSubscriptionService } = await import(
        "@/server/services/subscription.service"
      );
      vi.mocked(getSubscriptionService).mockReturnValueOnce({
        canExecuteTask: vi.fn().mockResolvedValue({
          allowed: false,
          reason: "Monthly execution limit reached",
          upgradeRequired: true,
          suggestedAction: "Upgrade to Pro plan",
          currentUsage: 100,
          limit: 100,
        }),
        incrementExecutionUsage: vi.fn(),
      } as any);

      const caller = agentRouter.createCaller(mockCtx);

      await expect(
        caller.executeTask({
          taskDescription: "Test task",
        })
      ).rejects.toThrow("Monthly execution limit reached");
    });

    it("should handle agent execution failure gracefully", async () => {
      mockExecuteTask.mockRejectedValueOnce(
        new Error("Claude API rate limited")
      );

      const caller = agentRouter.createCaller(mockCtx);

      await expect(
        caller.executeTask({
          taskDescription: "Draft an email response",
        })
      ).rejects.toThrow("Agent execution failed");
    });
  });

  // ========================================
  // STEP 4: Verify Output Quality
  // ========================================

  describe("Step 4: Verify execution output quality", () => {
    it("should retrieve execution details for quality review", async () => {
      const executionRecord = {
        id: 1,
        taskId: null,
        executionUuid: "uuid-123",
        triggeredByUserId: 1,
        status: "success",
        currentStep: "Complete",
        stepsTotal: 4,
        stepsCompleted: 4,
        duration: 8500,
        attemptNumber: 1,
        startedAt: new Date(),
        completedAt: new Date(),
        logs: [
          { step: 1, action: "Analyzed complaint" },
          { step: 2, action: "Retrieved knowledge entries" },
          { step: 3, action: "Drafted response" },
          { step: 4, action: "Reviewed against brand voice" },
        ],
        stepResults: [
          { tool: "update_plan", success: true },
          { tool: "advance_phase", success: true },
        ],
        output:
          "Dear John, I understand how frustrating this must be. " +
          "After reviewing your account, the charge was a system error. " +
          "A full refund has been issued. Best regards, The Support Team",
        error: null,
        browserSessionId: null,
        screenshots: null,
        resourceUsage: null,
        metadata: null,
      };

      const db = createTestDb({
        selectResponse: [{ execution: executionRecord, task: null }],
      });

      const dbModule = await import("@/server/db");
      vi.mocked(dbModule.getDb).mockImplementation(() =>
        Promise.resolve(db as any)
      );

      const caller = agentRouter.createCaller(mockCtx);
      const result = await caller.getExecution({ executionId: 1 });

      expect(result.id).toBe(1);
      expect(result.status).toBe("success");
      expect(result.stepsCompleted).toBe(4);
      expect(result.stepsTotal).toBe(4);
      expect(result.output).toBeDefined();

      // Quality checks on output
      const output = result.output as string;
      expect(output.length).toBeGreaterThan(50); // Not trivially short
      expect(output).toContain("John"); // Personalized
      expect(output).toContain("Best regards"); // Correct sign-off
      expect(output).not.toContain("!!!"); // No excessive exclamation marks (brand voice)
    });

    it("should list execution history with success metrics", async () => {
      const executions = [
        {
          execution: {
            id: 1,
            taskId: null,
            executionUuid: "uuid-1",
            triggeredByUserId: 1,
            status: "success",
            currentStep: "Complete",
            stepsTotal: 4,
            stepsCompleted: 4,
            duration: 8500,
            attemptNumber: 1,
            startedAt: new Date(),
            completedAt: new Date(),
            error: null,
          },
          task: null,
        },
        {
          execution: {
            id: 2,
            taskId: null,
            executionUuid: "uuid-2",
            triggeredByUserId: 1,
            status: "success",
            currentStep: "Complete",
            stepsTotal: 3,
            stepsCompleted: 3,
            duration: 6200,
            attemptNumber: 1,
            startedAt: new Date(),
            completedAt: new Date(),
            error: null,
          },
          task: null,
        },
      ];

      const db = createTestDb({
        selectResponse: executions,
      });

      const dbModule = await import("@/server/db");
      vi.mocked(dbModule.getDb).mockImplementation(() =>
        Promise.resolve(db as any)
      );

      const caller = agentRouter.createCaller(mockCtx);
      const result = await caller.listExecutions({
        limit: 20,
        offset: 0,
        status: "success",
      });

      expect(result).toHaveLength(2);
      expect(result.every((e) => e.status === "success")).toBe(true);
      expect(result[0].stepsCompleted).toBe(result[0].stepsTotal); // All steps done
    });

    it("should get aggregate execution statistics", async () => {
      const mockExecutions = [
        { status: "success", duration: 8500 },
        { status: "success", duration: 6200 },
        { status: "success", duration: 7300 },
        { status: "failed", duration: 2000 },
        { status: "success", duration: 9100 },
      ];

      const db = createTestDb({
        selectResponse: mockExecutions,
      });

      const dbModule = await import("@/server/db");
      vi.mocked(dbModule.getDb).mockImplementation(() =>
        Promise.resolve(db as any)
      );

      const caller = agentRouter.createCaller(mockCtx);
      const stats = await caller.getStats();

      expect(stats.total).toBe(5);
      expect(stats.byStatus.success).toBe(4);
      expect(stats.byStatus.failed).toBe(1);
      expect(stats.successRate).toBe(80); // 4/5 = 80%
      expect(stats.averageDuration).toBeGreaterThan(0);
    });

    it("should cancel a running execution", async () => {
      const runningExecution = {
        id: 5,
        taskId: null,
        triggeredByUserId: 1,
        status: "running",
      };

      const db = createTestDb({
        selectResponse: [runningExecution],
        updateResponse: [{ ...runningExecution, status: "cancelled" }],
      });

      const dbModule = await import("@/server/db");
      vi.mocked(dbModule.getDb).mockImplementation(() =>
        Promise.resolve(db as any)
      );

      const caller = agentRouter.createCaller(mockCtx);
      const result = await caller.cancelExecution({
        executionId: 5,
        reason: "Testing cancellation flow",
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe("cancelled");
    });
  });

  // ========================================
  // STEP 5: RAG Retrieval Verification
  // ========================================

  describe("Step 5: Verify trained knowledge is retrievable", () => {
    it("should retrieve relevant documentation for a query", async () => {
      mockRagRetrieve.mockResolvedValueOnce([
        {
          id: 1,
          sourceId: 1,
          chunkIndex: 0,
          content:
            "When a customer calls with a complaint, always start by acknowledging their frustration.",
          tokenCount: 20,
          similarity: 0.92,
        },
        {
          id: 2,
          sourceId: 1,
          chunkIndex: 1,
          content:
            "Use empathetic language such as 'I understand how frustrating this must be.'",
          tokenCount: 15,
          similarity: 0.88,
        },
      ]);

      const caller = ragRouter.createCaller(mockCtx);
      const result = await caller.retrieve({
        query: "How should I handle customer complaints?",
        topK: 5,
      });

      expect(result.success).toBe(true);
      expect(result.chunks).toHaveLength(2);
      expect(result.chunks[0].similarity).toBeGreaterThan(0.8);
      expect(result.chunks[0].content).toContain("complaint");
    });

    it("should build a system prompt with RAG context for agent", async () => {
      mockRagBuildSystemPrompt.mockResolvedValueOnce({
        systemPrompt:
          "You are a professional customer support agent. " +
          "Use the following knowledge to assist customers:\n\n" +
          "CONTEXT: When a customer calls with a complaint, always start by acknowledging...\n\n" +
          "BRAND VOICE: Professional but friendly. Address customer by first name.",
        retrievedChunks: [
          {
            id: 1,
            sourceId: 1,
            chunkIndex: 0,
            content: "When a customer calls with a complaint...",
            tokenCount: 20,
          },
        ],
        detectedPlatforms: ["general"],
      });

      const caller = ragRouter.createCaller(mockCtx);
      const result = await caller.buildSystemPrompt({
        userPrompt: "Help me respond to a customer complaint about billing",
      });

      expect(result.success).toBe(true);
      expect(result.systemPrompt).toContain("customer support");
      expect(result.chunkCount).toBeGreaterThan(0);
      expect(result.detectedPlatforms).toContain("general");
    });

    it("should list all ingested documentation sources", async () => {
      const sources = [
        {
          id: 1,
          platform: "general",
          category: "training",
          title: "Customer Service Guidelines",
          sourceUrl: null,
          version: null,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 2,
          platform: "general",
          category: "training",
          title: "Lead Follow-up SOP",
          sourceUrl: null,
          version: null,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const db = createTestDb({
        selectResponse: sources,
      });

      const dbModule = await import("@/server/db");
      vi.mocked(dbModule.getDb).mockImplementation(() =>
        Promise.resolve(db as any)
      );

      const caller = ragRouter.createCaller(mockCtx);
      const result = await caller.listSources({
        platform: "general",
        category: "training",
      });

      expect(result.success).toBe(true);
      expect(result.sources).toHaveLength(2);
    });
  });

  // ========================================
  // STEP 6: Full Pipeline Integration
  // ========================================

  describe("Step 6: Full pipeline - train, configure, execute, verify", () => {
    it("should complete the full agent training and execution pipeline", async () => {
      // 1. Ingest training document
      mockRagIngest.mockResolvedValueOnce({
        sourceId: 10,
        chunkCount: 4,
        totalTokens: 600,
      });

      const ragCaller = ragRouter.createCaller(mockCtx);
      const ingestResult = await ragCaller.ingestDocument({
        platform: "general",
        category: "training",
        title: "Complete Training Manual",
        content:
          "This is the comprehensive training manual for customer support agents. " +
          "Chapter 1: Greeting customers - Always greet with a warm welcome. " +
          "Chapter 2: Problem solving - Use the 5-step problem resolution process. " +
          "Chapter 3: Follow-up - Schedule follow-ups within 48 hours of resolution.",
      });
      expect(ingestResult.success).toBe(true);

      // 2. Create knowledge entries
      const knowledgeEntry = {
        id: 10,
        userId: 1,
        category: "process",
        context: "5-step problem resolution",
        content:
          "1. Listen actively. 2. Identify the root cause. 3. Propose solutions. " +
          "4. Implement the chosen solution. 5. Verify resolution with customer.",
        examples: null,
        confidence: "1.00",
        usageCount: 0,
        isActive: true,
        createdAt: new Date(),
      };

      const db = createTestDb({
        insertResponse: [knowledgeEntry],
      });

      const dbModule = await import("@/server/db");
      vi.mocked(dbModule.getDb).mockImplementation(() =>
        Promise.resolve(db as any)
      );

      const kmCaller = knowledgeManagementRouter.createCaller(mockCtx);
      const kmResult = await kmCaller.createEntry({
        category: "process",
        context: "5-step problem resolution",
        content:
          "1. Listen actively. 2. Identify the root cause. 3. Propose solutions. " +
          "4. Implement the chosen solution. 5. Verify resolution with customer.",
        confidence: 1.0,
      });
      expect(kmResult.success).toBe(true);

      // 3. Execute task with trained agent
      mockExecuteTask.mockResolvedValueOnce({
        executionId: 10,
        status: "completed",
        plan: {
          goal: "Resolve shipping delay complaint",
          phases: [
            {
              id: 1,
              name: "Listen and identify",
              description: "Understand the shipping issue",
              successCriteria: ["Root cause identified"],
              status: "completed",
            },
            {
              id: 2,
              name: "Propose and implement",
              description: "Offer resolution options",
              successCriteria: ["Solution agreed upon"],
              status: "completed",
            },
          ],
          currentPhaseId: 2,
          estimatedSteps: 5,
          estimatedDuration: 60000,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        thinkingSteps: [
          {
            timestamp: new Date(),
            phase: "analyzing",
            understanding: "Customer upset about 2-week shipping delay",
            nextAction: "Apply 5-step resolution process from training",
            reasoning: "Knowledge entry says to listen actively first",
          },
        ],
        toolHistory: [],
        output:
          "Dear Sarah,\n\n" +
          "Thank you for reaching out about your shipping delay. I completely understand " +
          "how inconvenient this must be, especially when you were expecting your order sooner.\n\n" +
          "I've looked into your order #ORD-5678 and can see it was delayed due to a " +
          "warehouse processing issue. Here's what I've done to resolve this:\n\n" +
          "1. Expedited your shipment - it will arrive within 2 business days\n" +
          "2. Applied a 15% discount to your next order as an apology\n" +
          "3. Set up tracking notifications so you can monitor delivery in real-time\n\n" +
          "I'll follow up with you in 48 hours to make sure everything arrived safely.\n\n" +
          "Best regards, The Support Team",
        iterations: 4,
        duration: 6500,
      });

      const agentCaller = agentRouter.createCaller(mockCtx);
      const execResult = await agentCaller.executeTask({
        taskDescription:
          "Handle a customer complaint from Sarah about a 2-week shipping delay on order #ORD-5678",
        context: {
          customerName: "Sarah",
          orderId: "ORD-5678",
          delayDuration: "2 weeks",
        },
      });

      // 4. Verify output quality
      expect(execResult.success).toBe(true);
      expect(execResult.status).toBe("completed");

      const output = execResult.output as string;

      // Verify personalization
      expect(output).toContain("Sarah");

      // Verify brand voice compliance
      expect(output).toContain("Best regards");
      expect(output).not.toContain("!!!");

      // Verify empathetic language (from training)
      expect(output.toLowerCase()).toContain("understand");

      // Verify resolution process was followed (from knowledge entry)
      expect(output).toContain("resolve"); // Resolution proposed

      // Verify follow-up mentioned (from training manual)
      expect(output).toContain("48 hours");
      expect(output).toContain("follow up");

      // Verify reasoning referenced trained knowledge
      expect(execResult.thinkingSteps).toBeDefined();
      expect(execResult.thinkingSteps!.length).toBeGreaterThan(0);

      // Verify execution completed within reasonable bounds
      expect(execResult.iterations).toBeLessThanOrEqual(50);
      expect(execResult.duration).toBeLessThan(60000); // Under 1 minute
    });
  });
});
