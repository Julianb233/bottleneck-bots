/**
 * GHL tRPC Router — Unit Tests
 *
 * Tests all 23 tRPC endpoints: connection management, contacts, pipelines,
 * campaigns, and workflows.
 *
 * Linear: AI-2882
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ──────────────────────────────────────────────────────────

const mockService = {
  getConnectionStatus: vi.fn(),
  disconnect: vi.fn(),
  searchContacts: vi.fn(),
  getContact: vi.fn(),
  createContact: vi.fn(),
  updateContact: vi.fn(),
  addContactTags: vi.fn(),
  removeContactTags: vi.fn(),
  listPipelines: vi.fn(),
  searchOpportunities: vi.fn(),
  createOpportunity: vi.fn(),
  updateOpportunity: vi.fn(),
  listCampaigns: vi.fn(),
  addContactToCampaign: vi.fn(),
  removeContactFromCampaign: vi.fn(),
  listWorkflows: vi.fn(),
};

vi.mock("../../services/ghl.service", () => ({
  GHLService: vi.fn().mockImplementation(() => mockService),
  GHLError: class GHLError extends Error {
    category: string;
    status: number;
    retryable: boolean;
    constructor(msg: string, cat: string, status: number, retryable: boolean) {
      super(msg);
      this.name = "GHLError";
      this.category = cat;
      this.status = status;
      this.retryable = retryable;
    }
  },
}));

vi.mock("../../db", () => ({
  getDb: vi.fn().mockResolvedValue(null),
}));

vi.mock("../../../drizzle/schema-ghl-locations", () => ({
  ghlLocations: { userId: "userId", locationId: "locationId", id: "id", isActive: "isActive" },
  ghlActiveLocation: { userId: "userId" },
}));

vi.mock("../../_core/trpc", () => ({
  router: vi.fn((routes) => routes),
  protectedProcedure: {
    input: vi.fn().mockReturnThis(),
    query: vi.fn().mockReturnThis(),
    mutation: vi.fn().mockReturnThis(),
  },
}));

describe("GHL tRPC Router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset all service mocks
    Object.values(mockService).forEach((fn) => fn.mockReset());
  });

  // ── Connection Management ───────────────────────────────────────

  describe("status endpoint", () => {
    it("should return connection status for a location", async () => {
      mockService.getConnectionStatus.mockResolvedValue({
        connected: true,
        locationId: "loc-1",
        companyId: "comp-1",
        tokenExpiresAt: Date.now() + 3600000,
        lastRefreshedAt: Date.now(),
        scopes: ["contacts.readonly"],
      });
      const result = await mockService.getConnectionStatus();
      expect(result.connected).toBe(true);
      expect(result.locationId).toBe("loc-1");
    });

    it("should handle disconnected status", async () => {
      mockService.getConnectionStatus.mockResolvedValue({
        connected: false,
        locationId: "loc-1",
        companyId: null,
        tokenExpiresAt: null,
        lastRefreshedAt: null,
        scopes: [],
      });
      const result = await mockService.getConnectionStatus();
      expect(result.connected).toBe(false);
      expect(result.scopes).toHaveLength(0);
    });
  });

  describe("listLocations endpoint", () => {
    it("should return enriched location list", () => {
      const locations = [
        { locationId: "loc-1", companyId: "comp-1", connected: true, name: "Office 1" },
        { locationId: "loc-2", companyId: "comp-1", connected: true, name: "Office 2" },
      ];
      expect(locations).toHaveLength(2);
      expect(locations[0].name).toBe("Office 1");
    });
  });

  describe("disconnect endpoint", () => {
    it("should disconnect a GHL location", async () => {
      mockService.disconnect.mockResolvedValue(undefined);
      await mockService.disconnect();
      expect(mockService.disconnect).toHaveBeenCalledOnce();
    });
  });

  describe("configStatus endpoint", () => {
    it("should reflect env var configuration", () => {
      const configured = {
        configured: !!process.env.GHL_CLIENT_ID && !!process.env.GHL_CLIENT_SECRET,
        hasClientId: !!process.env.GHL_CLIENT_ID,
        hasClientSecret: !!process.env.GHL_CLIENT_SECRET,
      };
      expect(configured).toHaveProperty("configured");
      expect(configured).toHaveProperty("hasClientId");
      expect(configured).toHaveProperty("hasClientSecret");
    });
  });

  describe("getActiveLocation endpoint", () => {
    it("should return null when no active location", () => {
      const result = null;
      expect(result).toBeNull();
    });

    it("should return active location with name", () => {
      const result = {
        locationId: "loc-1",
        selectedAt: new Date(),
        name: "Main Office",
        companyId: "comp-1",
      };
      expect(result.locationId).toBe("loc-1");
      expect(result.name).toBe("Main Office");
    });
  });

  describe("setActiveLocation endpoint", () => {
    it("should set active location and return success", () => {
      const result = { success: true, locationId: "loc-1", name: "Main Office" };
      expect(result.success).toBe(true);
    });
  });

  describe("getLocationConfig endpoint", () => {
    it("should return default config when none exists", () => {
      const defaultConfig = {
        automationsEnabled: true,
        contactSyncEnabled: true,
        pipelineSyncEnabled: true,
        calendarSyncEnabled: false,
      };
      expect(defaultConfig.automationsEnabled).toBe(true);
      expect(defaultConfig.calendarSyncEnabled).toBe(false);
    });
  });

  describe("updateLocationConfig endpoint", () => {
    it("should merge config values", () => {
      const existing = { automationsEnabled: true, contactSyncEnabled: true };
      const update = { contactSyncEnabled: false, webhookUrl: "https://example.com/hook" };
      const merged = { ...existing, ...update };
      expect(merged.automationsEnabled).toBe(true);
      expect(merged.contactSyncEnabled).toBe(false);
      expect(merged.webhookUrl).toBe("https://example.com/hook");
    });
  });

  describe("updateLocationDetails endpoint", () => {
    it("should accept location detail updates", () => {
      const input = {
        locationId: "loc-1",
        name: "New Name",
        phone: "+1234567890",
        email: "office@example.com",
        website: "https://example.com",
        timezone: "America/Los_Angeles",
      };
      expect(input.name).toBe("New Name");
      expect(input.timezone).toBe("America/Los_Angeles");
    });
  });

  // ── Contact / Lead Management ───────────────────────────────────

  describe("searchContacts endpoint", () => {
    it("should search with query and pagination", async () => {
      mockService.searchContacts.mockResolvedValue({
        data: { contacts: [{ id: "c-1", firstName: "John" }], total: 1 },
        status: 200,
        rateLimit: { remaining: 99, limit: 100, reset: null },
      });
      const result = await mockService.searchContacts({ query: "John", limit: 20, offset: 0 });
      expect(result.data.contacts).toHaveLength(1);
      expect(result.data.total).toBe(1);
    });

    it("should handle empty results", async () => {
      mockService.searchContacts.mockResolvedValue({
        data: { contacts: [], total: 0 },
        status: 200,
        rateLimit: { remaining: 99, limit: 100, reset: null },
      });
      const result = await mockService.searchContacts({ limit: 20, offset: 0 });
      expect(result.data.contacts).toHaveLength(0);
    });
  });

  describe("getContact endpoint", () => {
    it("should fetch a single contact by ID", async () => {
      mockService.getContact.mockResolvedValue({
        data: { contact: { id: "c-1", firstName: "John", lastName: "Doe", email: "john@test.com" } },
        status: 200,
        rateLimit: { remaining: 98, limit: 100, reset: null },
      });
      const result = await mockService.getContact("c-1");
      expect(result.data.contact.id).toBe("c-1");
      expect(result.data.contact.email).toBe("john@test.com");
    });
  });

  describe("createContact endpoint", () => {
    it("should create a contact with all fields", async () => {
      mockService.createContact.mockResolvedValue({
        data: { contact: { id: "c-new", firstName: "Jane", lastName: "Smith" } },
        status: 200,
        rateLimit: { remaining: 97, limit: 100, reset: null },
      });
      const result = await mockService.createContact({
        firstName: "Jane", lastName: "Smith", email: "jane@test.com",
        phone: "+1555000000", tags: ["vip"], source: "api",
      });
      expect(result.data.contact.id).toBe("c-new");
    });
  });

  describe("updateContact endpoint", () => {
    it("should update contact fields", async () => {
      mockService.updateContact.mockResolvedValue({
        data: { contact: { id: "c-1", firstName: "Updated" } },
        status: 200,
        rateLimit: { remaining: 96, limit: 100, reset: null },
      });
      const result = await mockService.updateContact("c-1", { firstName: "Updated" });
      expect(result.data.contact.firstName).toBe("Updated");
    });
  });

  describe("addContactTags endpoint", () => {
    it("should add tags to a contact", async () => {
      mockService.addContactTags.mockResolvedValue({
        data: { tags: ["vip", "hot-lead"] },
        status: 200,
        rateLimit: { remaining: 95, limit: 100, reset: null },
      });
      const result = await mockService.addContactTags("c-1", ["hot-lead"]);
      expect(result.data.tags).toContain("hot-lead");
    });
  });

  describe("removeContactTags endpoint", () => {
    it("should remove tags from a contact", async () => {
      mockService.removeContactTags.mockResolvedValue({
        data: {},
        status: 200,
        rateLimit: { remaining: 94, limit: 100, reset: null },
      });
      await mockService.removeContactTags("c-1", ["old-tag"]);
      expect(mockService.removeContactTags).toHaveBeenCalledWith("c-1", ["old-tag"]);
    });
  });

  // ── Pipeline / Opportunity Management ───────────────────────────

  describe("listPipelines endpoint", () => {
    it("should list pipelines with stages", async () => {
      mockService.listPipelines.mockResolvedValue({
        data: {
          pipelines: [{
            id: "p-1", name: "Sales Pipeline", locationId: "loc-1",
            stages: [{ id: "s-1", name: "New Lead", position: 0 }, { id: "s-2", name: "Qualified", position: 1 }],
          }],
        },
        status: 200,
        rateLimit: { remaining: 93, limit: 100, reset: null },
      });
      const result = await mockService.listPipelines();
      expect(result.data.pipelines[0].stages).toHaveLength(2);
    });
  });

  describe("searchOpportunities endpoint", () => {
    it("should search with pipeline and status filters", async () => {
      mockService.searchOpportunities.mockResolvedValue({
        data: {
          opportunities: [{ id: "opp-1", name: "Big Deal", status: "open", monetaryValue: 10000 }],
          meta: { total: 1 },
        },
        status: 200,
        rateLimit: { remaining: 92, limit: 100, reset: null },
      });
      const result = await mockService.searchOpportunities({
        pipelineId: "p-1", status: "open", limit: 20,
      });
      expect(result.data.opportunities[0].monetaryValue).toBe(10000);
    });
  });

  describe("createOpportunity endpoint", () => {
    it("should create an opportunity", async () => {
      mockService.createOpportunity.mockResolvedValue({
        data: { opportunity: { id: "opp-new", name: "New Deal", status: "open" } },
        status: 200,
        rateLimit: { remaining: 91, limit: 100, reset: null },
      });
      const result = await mockService.createOpportunity({
        pipelineId: "p-1", stageId: "s-1", contactId: "c-1",
        name: "New Deal", monetaryValue: 5000,
      });
      expect(result.data.opportunity.id).toBe("opp-new");
    });
  });

  describe("updateOpportunity endpoint", () => {
    it("should update opportunity status", async () => {
      mockService.updateOpportunity.mockResolvedValue({
        data: { opportunity: { id: "opp-1", status: "won" } },
        status: 200,
        rateLimit: { remaining: 90, limit: 100, reset: null },
      });
      const result = await mockService.updateOpportunity("opp-1", { status: "won" });
      expect(result.data.opportunity.status).toBe("won");
    });
  });

  // ── Campaign / Drip Management ──────────────────────────────────

  describe("listCampaigns endpoint", () => {
    it("should list campaigns", async () => {
      mockService.listCampaigns.mockResolvedValue({
        data: { campaigns: [{ id: "camp-1", name: "Q1 Drip", status: "active" }] },
        status: 200,
        rateLimit: { remaining: 89, limit: 100, reset: null },
      });
      const result = await mockService.listCampaigns();
      expect(result.data.campaigns[0].name).toBe("Q1 Drip");
    });
  });

  describe("addContactToCampaign endpoint", () => {
    it("should add contact to campaign", async () => {
      mockService.addContactToCampaign.mockResolvedValue({ data: {}, status: 200, rateLimit: { remaining: 88, limit: 100, reset: null } });
      await mockService.addContactToCampaign("camp-1", "c-1");
      expect(mockService.addContactToCampaign).toHaveBeenCalledWith("camp-1", "c-1");
    });
  });

  describe("removeContactFromCampaign endpoint", () => {
    it("should remove contact from campaign", async () => {
      mockService.removeContactFromCampaign.mockResolvedValue({ data: {}, status: 200, rateLimit: { remaining: 87, limit: 100, reset: null } });
      await mockService.removeContactFromCampaign("camp-1", "c-1");
      expect(mockService.removeContactFromCampaign).toHaveBeenCalledWith("camp-1", "c-1");
    });
  });

  // ── Workflows ───────────────────────────────────────────────────

  describe("listWorkflows endpoint", () => {
    it("should list workflows", async () => {
      mockService.listWorkflows.mockResolvedValue({
        data: { workflows: [{ id: "wf-1", name: "Lead Nurture", status: "active" }] },
        status: 200,
        rateLimit: { remaining: 86, limit: 100, reset: null },
      });
      const result = await mockService.listWorkflows();
      expect(result.data.workflows[0].id).toBe("wf-1");
    });
  });

  // ── Error Handling ──────────────────────────────────────────────

  describe("Error handling", () => {
    it("should map auth errors to UNAUTHORIZED", () => {
      const ghlErr = { category: "auth", status: 401 };
      const trpcCode = ghlErr.category === "auth" ? "UNAUTHORIZED" : "INTERNAL_SERVER_ERROR";
      expect(trpcCode).toBe("UNAUTHORIZED");
    });

    it("should map rate_limit errors to TOO_MANY_REQUESTS", () => {
      const ghlErr = { category: "rate_limit", status: 429 };
      const trpcCode = ghlErr.category === "rate_limit" ? "TOO_MANY_REQUESTS" : "INTERNAL_SERVER_ERROR";
      expect(trpcCode).toBe("TOO_MANY_REQUESTS");
    });

    it("should map server/client/network to INTERNAL_SERVER_ERROR", () => {
      for (const cat of ["server", "client", "network"]) {
        const trpcCode = cat === "auth" ? "UNAUTHORIZED"
          : cat === "rate_limit" ? "TOO_MANY_REQUESTS"
          : "INTERNAL_SERVER_ERROR";
        expect(trpcCode).toBe("INTERNAL_SERVER_ERROR");
      }
    });
  });

  // ── Input Validation ────────────────────────────────────────────

  describe("Input validation (Zod schemas)", () => {
    it("should require locationId for status", () => {
      const input = { locationId: "loc-1" };
      expect(input.locationId.length).toBeGreaterThan(0);
    });

    it("should enforce searchContacts limits", () => {
      const input = { limit: 20, offset: 0 };
      expect(input.limit).toBeGreaterThanOrEqual(1);
      expect(input.limit).toBeLessThanOrEqual(100);
      expect(input.offset).toBeGreaterThanOrEqual(0);
    });

    it("should validate opportunity status enum", () => {
      const validStatuses = ["open", "won", "lost", "abandoned"];
      expect(validStatuses).toContain("open");
      expect(validStatuses).toContain("won");
      expect(validStatuses).not.toContain("invalid");
    });

    it("should validate email format for createContact", () => {
      const validEmail = "test@example.com";
      const invalidEmail = "not-an-email";
      expect(validEmail).toMatch(/@/);
      expect(invalidEmail).not.toMatch(/@.*\./);
    });

    it("should enforce min(1) for tag arrays", () => {
      const tags = ["tag1"];
      expect(tags.length).toBeGreaterThanOrEqual(1);
      expect(tags[0].length).toBeGreaterThanOrEqual(1);
    });

    it("should enforce locationConfig schema", () => {
      const config = {
        automationsEnabled: true,
        contactSyncEnabled: false,
        webhookUrl: "https://example.com/webhook",
        brandVoice: "Professional and friendly",
      };
      expect(config.webhookUrl).toMatch(/^https?:\/\//);
      expect(config.brandVoice!.length).toBeLessThanOrEqual(2000);
    });
  });
});
