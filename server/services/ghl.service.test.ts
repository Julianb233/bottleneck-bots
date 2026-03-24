/**
 * GHL Service — Unit Tests
 *
 * Tests all 18 service-layer methods + error categorization + rate limiter + factory.
 * Uses mocked fetch and DB to test logic in isolation.
 *
 * Linear: AI-2882
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Mocks ──────────────────────────────────────────────────────────

vi.mock("./credentialVault.service", () => ({
  getCredentialVault: () => ({
    retrieveCredential: vi.fn().mockResolvedValue({
      data: { accessToken: "mock-access-token", refreshToken: "mock-refresh-token" },
    }),
    storeCredential: vi.fn().mockResolvedValue(undefined),
  }),
}));

const mockDb = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  limit: vi.fn().mockResolvedValue([]),
  update: vi.fn().mockReturnThis(),
  set: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  values: vi.fn().mockResolvedValue(undefined),
  delete: vi.fn().mockReturnThis(),
};

vi.mock("../db", () => ({
  getDb: vi.fn().mockResolvedValue(null),
}));

vi.mock("../../drizzle/schema", () => ({
  integrations: {
    userId: "userId",
    service: "service",
    isActive: "isActive",
    id: "id",
  },
}));

const originalFetch = globalThis.fetch;

import {
  GHLService,
  GHLError,
  createGHLService,
  type GHLScope,
} from "./ghl.service";
import { getDb } from "../db";

describe("GHLService", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock;
    vi.mocked(getDb).mockResolvedValue(mockDb as any);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  // ── Factory ────────────────────────────────────────────────────

  describe("createGHLService", () => {
    it("should create a GHLService instance", () => {
      const service = createGHLService("loc-123", 1);
      expect(service).toBeInstanceOf(GHLService);
    });
  });

  // ── Static: buildAuthorizationUrl ──────────────────────────────

  describe("buildAuthorizationUrl", () => {
    it("should build a valid OAuth URL with all params", () => {
      const url = GHLService.buildAuthorizationUrl({
        clientId: "test-client-id",
        redirectUri: "http://localhost:3000/callback",
        scopes: ["contacts.readonly", "contacts.write"] as GHLScope[],
        state: "test-state-abc",
      });
      expect(url).toContain("marketplace.gohighlevel.com");
      expect(url).toContain("response_type=code");
      expect(url).toContain("client_id=test-client-id");
      expect(url).toContain("state=test-state-abc");
    });

    it("should handle single scope", () => {
      const url = GHLService.buildAuthorizationUrl({
        clientId: "cid",
        redirectUri: "http://localhost/cb",
        scopes: ["contacts.readonly"] as GHLScope[],
        state: "s",
      });
      expect(url).toContain("scope=contacts.readonly");
    });

    it("should handle many scopes", () => {
      const scopes: GHLScope[] = [
        "contacts.readonly", "contacts.write", "opportunities.readonly",
        "opportunities.write", "campaigns.readonly", "workflows.readonly", "locations.readonly",
      ];
      const url = GHLService.buildAuthorizationUrl({
        clientId: "cid", redirectUri: "http://localhost/cb", scopes, state: "s",
      });
      expect(url).toContain("contacts.readonly");
      expect(url).toContain("workflows.readonly");
    });
  });

  // ── Static: exchangeCodeForTokens ──────────────────────────────

  describe("exchangeCodeForTokens", () => {
    it("should exchange auth code for tokens on success", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          access_token: "at-123", refresh_token: "rt-456", expires_in: 3600,
          token_type: "Bearer", scope: "contacts.readonly",
          locationId: "loc-789", companyId: "comp-abc", userId: "user-def",
        }),
      });
      const result = await GHLService.exchangeCodeForTokens({
        code: "auth-code", clientId: "cid", clientSecret: "csecret",
        redirectUri: "http://localhost/cb",
      });
      expect(result.access_token).toBe("at-123");
      expect(result.locationId).toBe("loc-789");
      const [url, opts] = fetchMock.mock.calls[0];
      expect(url).toContain("oauth/token");
      expect(opts.method).toBe("POST");
    });

    it("should throw GHLError on failure", async () => {
      fetchMock.mockResolvedValueOnce({ ok: false, status: 400, text: vi.fn().mockResolvedValue("Invalid code") });
      await expect(
        GHLService.exchangeCodeForTokens({ code: "bad", clientId: "cid", clientSecret: "csecret", redirectUri: "http://localhost/cb" })
      ).rejects.toThrow(GHLError);
    });

    it("should categorize exchange failure as auth error", async () => {
      fetchMock.mockResolvedValueOnce({ ok: false, status: 401, text: vi.fn().mockResolvedValue("Unauthorized") });
      try {
        await GHLService.exchangeCodeForTokens({ code: "bad", clientId: "cid", clientSecret: "csecret", redirectUri: "http://localhost/cb" });
        expect.unreachable("Should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(GHLError);
        expect((err as GHLError).category).toBe("auth");
      }
    });
  });

  // ── Static: refreshAccessToken ─────────────────────────────────

  describe("refreshAccessToken", () => {
    it("should refresh tokens successfully", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          access_token: "new-at", refresh_token: "new-rt", expires_in: 7200,
          token_type: "Bearer", scope: "contacts.readonly contacts.write",
        }),
      });
      const result = await GHLService.refreshAccessToken({ refreshToken: "old-rt", clientId: "cid", clientSecret: "csecret" });
      expect(result.access_token).toBe("new-at");
      expect(result.expires_in).toBe(7200);
    });

    it("should throw on refresh failure", async () => {
      fetchMock.mockResolvedValueOnce({ ok: false, status: 400, text: vi.fn().mockResolvedValue("Invalid refresh token") });
      await expect(GHLService.refreshAccessToken({ refreshToken: "expired-rt", clientId: "cid", clientSecret: "csecret" })).rejects.toThrow(GHLError);
    });
  });

  // ── getAccessToken ─────────────────────────────────────────────

  describe("getAccessToken", () => {
    it("should throw when DB is not available", async () => {
      vi.mocked(getDb).mockResolvedValue(null);
      const service = new GHLService("loc-1", 1);
      await expect(service.getAccessToken()).rejects.toThrow("Database not available");
    });

    it("should throw when no integration found", async () => {
      mockDb.limit.mockResolvedValueOnce([]);
      const service = new GHLService("loc-1", 1);
      await expect(service.getAccessToken()).rejects.toThrow("No GHL connection found");
    });

    it("should return cached token from DB when still fresh", async () => {
      const futureExpiry = new Date(Date.now() + 30 * 60 * 1000);
      mockDb.limit.mockResolvedValueOnce([{
        userId: 1, service: "ghl:loc-1", isActive: "true",
        accessToken: "db-token-fresh", refreshToken: "rt",
        expiresAt: futureExpiry, metadata: JSON.stringify({ scope: "contacts.readonly" }),
      }]);
      const service = new GHLService("loc-1", 1);
      const token = await service.getAccessToken();
      expect(token).toBe("db-token-fresh");
    });
  });

  // ── getConnectionStatus ────────────────────────────────────────

  describe("getConnectionStatus", () => {
    it("should return disconnected when DB unavailable", async () => {
      vi.mocked(getDb).mockResolvedValue(null);
      const service = new GHLService("loc-1", 1);
      const status = await service.getConnectionStatus();
      expect(status.connected).toBe(false);
      expect(status.locationId).toBe("loc-1");
    });

    it("should return disconnected when no integration found", async () => {
      mockDb.limit.mockResolvedValueOnce([]);
      const service = new GHLService("loc-1", 1);
      const status = await service.getConnectionStatus();
      expect(status.connected).toBe(false);
    });

    it("should return connected status with metadata", async () => {
      mockDb.limit.mockResolvedValueOnce([{
        userId: 1, service: "ghl:loc-1", isActive: "true",
        expiresAt: new Date(Date.now() + 3600 * 1000),
        metadata: JSON.stringify({
          companyId: "comp-1", scope: "contacts.readonly contacts.write",
          lastRefreshedAt: new Date().toISOString(),
        }),
      }]);
      const service = new GHLService("loc-1", 1);
      const status = await service.getConnectionStatus();
      expect(status.connected).toBe(true);
      expect(status.companyId).toBe("comp-1");
      expect(status.scopes).toContain("contacts.readonly");
      expect(status.scopes).toContain("contacts.write");
    });
  });

  // ── disconnect ─────────────────────────────────────────────────

  describe("disconnect", () => {
    it("should throw when DB not available", async () => {
      vi.mocked(getDb).mockResolvedValue(null);
      const service = new GHLService("loc-1", 1);
      await expect(service.disconnect()).rejects.toThrow("Database not available");
    });

    it("should update integration to inactive", async () => {
      const service = new GHLService("loc-1", 1);
      mockDb.where.mockResolvedValueOnce(undefined);
      await service.disconnect();
      expect(mockDb.update).toHaveBeenCalled();
    });
  });

  // ── Contact Methods ────────────────────────────────────────────

  describe("searchContacts", () => {
    it("should call GET /contacts/ with correct params", async () => {
      const service = new GHLService("loc-1", 1);
      vi.spyOn(service, "getAccessToken").mockResolvedValue("mock-token");
      fetchMock.mockResolvedValueOnce({
        ok: true, status: 200,
        headers: { get: () => null },
        json: vi.fn().mockResolvedValue({ contacts: [], total: 0 }),
      });
      const result = await service.searchContacts({ query: "test", limit: 10 });
      expect(result.data).toHaveProperty("contacts");
      const [url] = fetchMock.mock.calls[0];
      expect(url).toContain("/contacts/");
      expect(url).toContain("locationId=loc-1");
      expect(url).toContain("query=test");
    });
  });

  describe("getContact", () => {
    it("should call GET /contacts/:id", async () => {
      const service = new GHLService("loc-1", 1);
      vi.spyOn(service, "getAccessToken").mockResolvedValue("mock-token");
      fetchMock.mockResolvedValueOnce({
        ok: true, status: 200, headers: { get: () => null },
        json: vi.fn().mockResolvedValue({ contact: { id: "c-1" } }),
      });
      const result = await service.getContact("c-1");
      expect(result.data).toHaveProperty("contact");
      expect(fetchMock.mock.calls[0][0]).toContain("/contacts/c-1");
    });
  });

  describe("createContact", () => {
    it("should POST to /contacts/ with locationId", async () => {
      const service = new GHLService("loc-1", 1);
      vi.spyOn(service, "getAccessToken").mockResolvedValue("mock-token");
      fetchMock.mockResolvedValueOnce({
        ok: true, status: 200, headers: { get: () => null },
        json: vi.fn().mockResolvedValue({ contact: { id: "new-c", firstName: "John" } }),
      });
      await service.createContact({ firstName: "John", lastName: "Doe", email: "john@test.com", tags: ["lead"] });
      const [url, opts] = fetchMock.mock.calls[0];
      expect(url).toContain("/contacts/");
      expect(opts.method).toBe("POST");
      expect(JSON.parse(opts.body).locationId).toBe("loc-1");
    });
  });

  describe("updateContact", () => {
    it("should PUT to /contacts/:id", async () => {
      const service = new GHLService("loc-1", 1);
      vi.spyOn(service, "getAccessToken").mockResolvedValue("mock-token");
      fetchMock.mockResolvedValueOnce({
        ok: true, status: 200, headers: { get: () => null },
        json: vi.fn().mockResolvedValue({ contact: { id: "c-1" } }),
      });
      await service.updateContact("c-1", { firstName: "Updated" });
      const [url, opts] = fetchMock.mock.calls[0];
      expect(url).toContain("/contacts/c-1");
      expect(opts.method).toBe("PUT");
    });
  });

  describe("addContactTags", () => {
    it("should POST tags to /contacts/:id/tags", async () => {
      const service = new GHLService("loc-1", 1);
      vi.spyOn(service, "getAccessToken").mockResolvedValue("mock-token");
      fetchMock.mockResolvedValueOnce({
        ok: true, status: 200, headers: { get: () => null },
        json: vi.fn().mockResolvedValue({ tags: ["vip"] }),
      });
      await service.addContactTags("c-1", ["vip"]);
      const [url, opts] = fetchMock.mock.calls[0];
      expect(url).toContain("/contacts/c-1/tags");
      expect(opts.method).toBe("POST");
    });
  });

  describe("removeContactTags", () => {
    it("should DELETE tags from /contacts/:id/tags", async () => {
      const service = new GHLService("loc-1", 1);
      vi.spyOn(service, "getAccessToken").mockResolvedValue("mock-token");
      fetchMock.mockResolvedValueOnce({
        ok: true, status: 200, headers: { get: () => null },
        json: vi.fn().mockResolvedValue({}),
      });
      await service.removeContactTags("c-1", ["old"]);
      const [url, opts] = fetchMock.mock.calls[0];
      expect(url).toContain("/contacts/c-1/tags");
      expect(opts.method).toBe("DELETE");
    });
  });

  // ── Pipeline / Opportunity ─────────────────────────────────────

  describe("listPipelines", () => {
    it("should GET /opportunities/pipelines", async () => {
      const service = new GHLService("loc-1", 1);
      vi.spyOn(service, "getAccessToken").mockResolvedValue("mock-token");
      fetchMock.mockResolvedValueOnce({
        ok: true, status: 200, headers: { get: () => null },
        json: vi.fn().mockResolvedValue({ pipelines: [{ id: "p-1", name: "Sales" }] }),
      });
      const result = await service.listPipelines();
      expect(result.data).toHaveProperty("pipelines");
      expect(fetchMock.mock.calls[0][0]).toContain("/opportunities/pipelines");
    });
  });

  describe("searchOpportunities", () => {
    it("should GET /opportunities/search with filters", async () => {
      const service = new GHLService("loc-1", 1);
      vi.spyOn(service, "getAccessToken").mockResolvedValue("mock-token");
      fetchMock.mockResolvedValueOnce({
        ok: true, status: 200, headers: { get: () => null },
        json: vi.fn().mockResolvedValue({ opportunities: [], meta: { total: 0 } }),
      });
      await service.searchOpportunities({ pipelineId: "p-1", status: "open" });
      const [url] = fetchMock.mock.calls[0];
      expect(url).toContain("pipeline_id=p-1");
      expect(url).toContain("status=open");
    });

    it("should omit status when 'all'", async () => {
      const service = new GHLService("loc-1", 1);
      vi.spyOn(service, "getAccessToken").mockResolvedValue("mock-token");
      fetchMock.mockResolvedValueOnce({
        ok: true, status: 200, headers: { get: () => null },
        json: vi.fn().mockResolvedValue({ opportunities: [], meta: { total: 0 } }),
      });
      await service.searchOpportunities({ status: "all" });
      expect(fetchMock.mock.calls[0][0]).not.toContain("status=");
    });
  });

  describe("createOpportunity", () => {
    it("should POST to /opportunities/", async () => {
      const service = new GHLService("loc-1", 1);
      vi.spyOn(service, "getAccessToken").mockResolvedValue("mock-token");
      fetchMock.mockResolvedValueOnce({
        ok: true, status: 200, headers: { get: () => null },
        json: vi.fn().mockResolvedValue({ opportunity: { id: "opp-1" } }),
      });
      await service.createOpportunity({
        pipelineId: "p-1", stageId: "s-1", contactId: "c-1", name: "Deal", monetaryValue: 5000,
      });
      const [, opts] = fetchMock.mock.calls[0];
      expect(opts.method).toBe("POST");
      expect(JSON.parse(opts.body).locationId).toBe("loc-1");
    });
  });

  describe("updateOpportunity", () => {
    it("should PUT to /opportunities/:id", async () => {
      const service = new GHLService("loc-1", 1);
      vi.spyOn(service, "getAccessToken").mockResolvedValue("mock-token");
      fetchMock.mockResolvedValueOnce({
        ok: true, status: 200, headers: { get: () => null },
        json: vi.fn().mockResolvedValue({ opportunity: { id: "opp-1", status: "won" } }),
      });
      await service.updateOpportunity("opp-1", { status: "won" });
      const [url, opts] = fetchMock.mock.calls[0];
      expect(url).toContain("/opportunities/opp-1");
      expect(opts.method).toBe("PUT");
    });
  });

  // ── Campaign Methods ───────────────────────────────────────────

  describe("listCampaigns", () => {
    it("should GET /campaigns/ with locationId", async () => {
      const service = new GHLService("loc-1", 1);
      vi.spyOn(service, "getAccessToken").mockResolvedValue("mock-token");
      fetchMock.mockResolvedValueOnce({
        ok: true, status: 200, headers: { get: () => null },
        json: vi.fn().mockResolvedValue({ campaigns: [] }),
      });
      await service.listCampaigns();
      expect(fetchMock.mock.calls[0][0]).toContain("/campaigns/");
    });
  });

  describe("addContactToCampaign", () => {
    it("should POST to /campaigns/:cid/contacts/:contactId", async () => {
      const service = new GHLService("loc-1", 1);
      vi.spyOn(service, "getAccessToken").mockResolvedValue("mock-token");
      fetchMock.mockResolvedValueOnce({
        ok: true, status: 200, headers: { get: () => null },
        json: vi.fn().mockResolvedValue({}),
      });
      await service.addContactToCampaign("camp-1", "c-1");
      const [url, opts] = fetchMock.mock.calls[0];
      expect(url).toContain("/campaigns/camp-1/contacts/c-1");
      expect(opts.method).toBe("POST");
    });
  });

  describe("removeContactFromCampaign", () => {
    it("should DELETE from /campaigns/:cid/contacts/:contactId", async () => {
      const service = new GHLService("loc-1", 1);
      vi.spyOn(service, "getAccessToken").mockResolvedValue("mock-token");
      fetchMock.mockResolvedValueOnce({
        ok: true, status: 200, headers: { get: () => null },
        json: vi.fn().mockResolvedValue({}),
      });
      await service.removeContactFromCampaign("camp-1", "c-1");
      const [url, opts] = fetchMock.mock.calls[0];
      expect(url).toContain("/campaigns/camp-1/contacts/c-1");
      expect(opts.method).toBe("DELETE");
    });
  });

  // ── Workflow Methods ───────────────────────────────────────────

  describe("listWorkflows", () => {
    it("should GET /workflows/ with locationId", async () => {
      const service = new GHLService("loc-1", 1);
      vi.spyOn(service, "getAccessToken").mockResolvedValue("mock-token");
      fetchMock.mockResolvedValueOnce({
        ok: true, status: 200, headers: { get: () => null },
        json: vi.fn().mockResolvedValue({ workflows: [] }),
      });
      await service.listWorkflows();
      expect(fetchMock.mock.calls[0][0]).toContain("/workflows/");
    });
  });

  // ── Static: listLocations ──────────────────────────────────────

  describe("listLocations", () => {
    it("should return empty array when DB unavailable", async () => {
      vi.mocked(getDb).mockResolvedValue(null);
      const result = await GHLService.listLocations(1);
      expect(result).toEqual([]);
    });

    it("should filter and map GHL integrations", async () => {
      mockDb.where.mockResolvedValueOnce([
        { service: "ghl:loc-1", isActive: "true", expiresAt: new Date(),
          metadata: JSON.stringify({ companyId: "comp-1", scope: "contacts.readonly" }) },
        { service: "ghl:loc-2", isActive: "true", expiresAt: null, metadata: null },
        { service: "google:user-1", isActive: "true", metadata: null },
      ]);
      const result = await GHLService.listLocations(1);
      expect(result).toHaveLength(2);
      expect(result[0].locationId).toBe("loc-1");
      expect(result[1].locationId).toBe("loc-2");
    });
  });

  // ── request() retry / error handling ───────────────────────────

  describe("request (retry and error handling)", () => {
    it("should retry on 500 errors", async () => {
      const service = new GHLService("loc-r1", 1);
      vi.spyOn(service, "getAccessToken").mockResolvedValue("mock-token");
      fetchMock
        .mockResolvedValueOnce({ ok: false, status: 500, headers: { get: () => null }, text: vi.fn().mockResolvedValue("err") })
        .mockResolvedValueOnce({ ok: false, status: 500, headers: { get: () => null }, text: vi.fn().mockResolvedValue("err") })
        .mockResolvedValueOnce({ ok: true, status: 200, headers: { get: () => null }, json: vi.fn().mockResolvedValue({ ok: true }) });
      const result = await service.request({ method: "GET", endpoint: "/test" });
      expect(result.status).toBe(200);
      expect(fetchMock).toHaveBeenCalledTimes(3);
    }, 30000);

    it("should throw after max retries", async () => {
      const service = new GHLService("loc-r2", 1);
      vi.spyOn(service, "getAccessToken").mockResolvedValue("mock-token");
      fetchMock.mockResolvedValue({ ok: false, status: 500, headers: { get: () => null }, text: vi.fn().mockResolvedValue("err") });
      await expect(service.request({ method: "GET", endpoint: "/test" })).rejects.toThrow(GHLError);
    }, 30000);

    it("should not retry on 400 client errors", async () => {
      const service = new GHLService("loc-r3", 1);
      vi.spyOn(service, "getAccessToken").mockResolvedValue("mock-token");
      fetchMock.mockResolvedValueOnce({ ok: false, status: 400, headers: { get: () => null }, text: vi.fn().mockResolvedValue("Bad") });
      try { await service.request({ method: "GET", endpoint: "/test" }); expect.unreachable(); }
      catch (err) { expect((err as GHLError).category).toBe("client"); expect((err as GHLError).retryable).toBe(false); }
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("should categorize 429 as rate_limit and retry", async () => {
      const service = new GHLService("loc-r4", 1);
      vi.spyOn(service, "getAccessToken").mockResolvedValue("mock-token");
      fetchMock
        .mockResolvedValueOnce({ ok: false, status: 429, headers: { get: () => null }, text: vi.fn().mockResolvedValue('{"retryAfter": 5}') })
        .mockResolvedValueOnce({ ok: true, status: 200, headers: { get: () => null }, json: vi.fn().mockResolvedValue({ ok: true }) });
      const result = await service.request({ method: "GET", endpoint: "/test" });
      expect(result.status).toBe(200);
    }, 15000);

    it("should handle network errors with retry", async () => {
      const service = new GHLService("loc-r5", 1);
      vi.spyOn(service, "getAccessToken").mockResolvedValue("mock-token");
      fetchMock
        .mockRejectedValueOnce(new Error("ECONNREFUSED"))
        .mockResolvedValueOnce({ ok: true, status: 200, headers: { get: () => null }, json: vi.fn().mockResolvedValue({ recovered: true }) });
      const result = await service.request({ method: "GET", endpoint: "/test" });
      expect(result.data).toEqual({ recovered: true });
    }, 15000);

    it("should include Version header", async () => {
      const service = new GHLService("loc-r6", 1);
      vi.spyOn(service, "getAccessToken").mockResolvedValue("mock-token");
      fetchMock.mockResolvedValueOnce({ ok: true, status: 200, headers: { get: () => null }, json: vi.fn().mockResolvedValue({}) });
      await service.request({ method: "GET", endpoint: "/test" });
      expect(fetchMock.mock.calls[0][1].headers.Version).toBe("2021-07-28");
    });

    it("should set Content-Type for POST with data", async () => {
      const service = new GHLService("loc-r7", 1);
      vi.spyOn(service, "getAccessToken").mockResolvedValue("mock-token");
      fetchMock.mockResolvedValueOnce({ ok: true, status: 200, headers: { get: () => null }, json: vi.fn().mockResolvedValue({}) });
      await service.request({ method: "POST", endpoint: "/test", data: { foo: "bar" } });
      const opts = fetchMock.mock.calls[0][1];
      expect(opts.headers["Content-Type"]).toBe("application/json");
      expect(opts.body).toBe('{"foo":"bar"}');
    });

    it("should not set body for GET even with data", async () => {
      const service = new GHLService("loc-r8", 1);
      vi.spyOn(service, "getAccessToken").mockResolvedValue("mock-token");
      fetchMock.mockResolvedValueOnce({ ok: true, status: 200, headers: { get: () => null }, json: vi.fn().mockResolvedValue({}) });
      await service.request({ method: "GET", endpoint: "/test", data: { foo: "bar" } });
      expect(fetchMock.mock.calls[0][1].body).toBeUndefined();
    });

    it("should parse rate limit headers", async () => {
      const service = new GHLService("loc-r9", 1);
      vi.spyOn(service, "getAccessToken").mockResolvedValue("mock-token");
      const headerMap: Record<string, string> = {
        "x-ratelimit-remaining": "50", "x-ratelimit-reset": "1234567890", "x-ratelimit-limit": "100",
      };
      fetchMock.mockResolvedValueOnce({
        ok: true, status: 200, headers: { get: (k: string) => headerMap[k] || null },
        json: vi.fn().mockResolvedValue({}),
      });
      const result = await service.request({ method: "GET", endpoint: "/test" });
      expect(result.rateLimit.remaining).toBe(50);
      expect(result.rateLimit.limit).toBe(100);
    });
  });

  // ── GHLError ───────────────────────────────────────────────────

  describe("GHLError", () => {
    it("should capture all properties", () => {
      const err = new GHLError("test error", "auth", 401, true, 30);
      expect(err.name).toBe("GHLError");
      expect(err.category).toBe("auth");
      expect(err.status).toBe(401);
      expect(err.retryable).toBe(true);
      expect(err.retryAfter).toBe(30);
    });

    it("should be an instance of Error", () => {
      const err = new GHLError("test", "client", 400, false);
      expect(err).toBeInstanceOf(Error);
    });
  });
});
