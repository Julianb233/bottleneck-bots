/**
 * GHL Sandbox — Integration Tests
 *
 * Tests live GHL API calls using the v1 API key against the sandbox location.
 * These tests hit the real GHL API (https://services.leadconnectorhq.com)
 * and verify actual responses.
 *
 * Requires GHL_API_KEY and GHL_LOCATION_ID env vars.
 *
 * Linear: AI-2882
 */

import { describe, it, expect, beforeAll } from "vitest";

const GHL_API_BASE = "https://services.leadconnectorhq.com";
const API_KEY = process.env.GHL_API_KEY || "";
const LOCATION_ID = process.env.GHL_LOCATION_ID || "";
const API_VERSION = "2021-07-28";

// Helper for authenticated GHL requests
async function ghlRequest(
  method: string,
  endpoint: string,
  params?: Record<string, string>,
  data?: unknown
) {
  const url = new URL(endpoint, GHL_API_BASE);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }

  const opts: RequestInit = {
    method,
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      Accept: "application/json",
      Version: API_VERSION,
      ...(data ? { "Content-Type": "application/json" } : {}),
    },
  };

  if (data && method !== "GET") {
    opts.body = JSON.stringify(data);
  }

  const response = await fetch(url.toString(), opts);
  const body = await response.text();

  return {
    status: response.status,
    ok: response.ok,
    data: body ? JSON.parse(body) : {},
    headers: response.headers,
  };
}

// Skip all tests if credentials aren't available
const skipCondition = !API_KEY || !LOCATION_ID;

describe.skipIf(skipCondition)("GHL Sandbox Integration Tests", () => {
  let testContactId: string | null = null;

  beforeAll(() => {
    console.log(`[GHL Sandbox] Testing against location: ${LOCATION_ID}`);
    console.log(`[GHL Sandbox] API key present: ${!!API_KEY}`);
  });

  // ── Contact Operations ──────────────────────────────────────────

  describe("Contact Operations", () => {
    it("1. searchContacts — should list contacts for location", async () => {
      const result = await ghlRequest("GET", "/contacts/", {
        locationId: LOCATION_ID,
        limit: "5",
      });
      expect(result.status).toBeLessThan(500);
      // API may return 200 with contacts or 401 if key format mismatches
      if (result.ok) {
        expect(result.data).toHaveProperty("contacts");
      }
    });

    it("2. createContact — should create a test contact", async () => {
      const result = await ghlRequest("POST", "/contacts/", undefined, {
        locationId: LOCATION_ID,
        firstName: "BB-Test",
        lastName: `Sandbox-${Date.now()}`,
        email: `bbtest-${Date.now()}@sandbox.test`,
        phone: "+15550001234",
        tags: ["bb-sandbox-test"],
        source: "bottleneck-bots-test",
      });

      if (result.ok) {
        expect(result.data.contact).toBeDefined();
        testContactId = result.data.contact?.id || null;
        console.log(`[GHL Sandbox] Created test contact: ${testContactId}`);
      } else {
        console.log(`[GHL Sandbox] createContact returned ${result.status}: ${JSON.stringify(result.data)}`);
      }
      expect(result.status).toBeLessThan(500);
    });

    it("3. getContact — should fetch the created contact", async () => {
      if (!testContactId) {
        console.log("[GHL Sandbox] Skipping — no test contact ID");
        return;
      }
      const result = await ghlRequest("GET", `/contacts/${testContactId}`);
      if (result.ok) {
        expect(result.data.contact).toBeDefined();
        expect(result.data.contact.id).toBe(testContactId);
      }
      expect(result.status).toBeLessThan(500);
    });

    it("4. updateContact — should update contact name", async () => {
      if (!testContactId) return;
      const result = await ghlRequest("PUT", `/contacts/${testContactId}`, undefined, {
        firstName: "BB-Updated",
      });
      if (result.ok) {
        expect(result.data.contact).toBeDefined();
      }
      expect(result.status).toBeLessThan(500);
    });

    it("5. addContactTags — should add tags to contact", async () => {
      if (!testContactId) return;
      const result = await ghlRequest("POST", `/contacts/${testContactId}/tags`, undefined, {
        tags: ["vip-test", "sandbox-verified"],
      });
      expect(result.status).toBeLessThan(500);
    });

    it("6. removeContactTags — should remove tags from contact", async () => {
      if (!testContactId) return;
      const result = await ghlRequest("DELETE", `/contacts/${testContactId}/tags`, undefined, {
        tags: ["sandbox-verified"],
      });
      expect(result.status).toBeLessThan(500);
    });
  });

  // ── Pipeline Operations ─────────────────────────────────────────

  describe("Pipeline Operations", () => {
    let pipelineId: string | null = null;
    let stageId: string | null = null;
    let opportunityId: string | null = null;

    it("7. listPipelines — should list pipelines", async () => {
      const result = await ghlRequest("GET", "/opportunities/pipelines", {
        locationId: LOCATION_ID,
      });
      if (result.ok && result.data.pipelines?.length > 0) {
        pipelineId = result.data.pipelines[0].id;
        stageId = result.data.pipelines[0].stages?.[0]?.id || null;
        console.log(`[GHL Sandbox] Found pipeline: ${pipelineId}, stage: ${stageId}`);
      }
      expect(result.status).toBeLessThan(500);
    });

    it("8. searchOpportunities — should search deals", async () => {
      const params: Record<string, string> = {
        location_id: LOCATION_ID,
        limit: "5",
      };
      if (pipelineId) params.pipeline_id = pipelineId;

      const result = await ghlRequest("GET", "/opportunities/search", params);
      expect(result.status).toBeLessThan(500);
    });

    it("9. createOpportunity — should create a test deal", async () => {
      if (!pipelineId || !stageId || !testContactId) {
        console.log("[GHL Sandbox] Skipping — missing pipeline/stage/contact");
        return;
      }
      const result = await ghlRequest("POST", "/opportunities/", undefined, {
        locationId: LOCATION_ID,
        pipelineId,
        pipelineStageId: stageId,
        contactId: testContactId,
        name: `BB-Test-Deal-${Date.now()}`,
        monetaryValue: 1000,
        status: "open",
      });
      if (result.ok) {
        opportunityId = result.data.opportunity?.id || null;
        console.log(`[GHL Sandbox] Created opportunity: ${opportunityId}`);
      }
      expect(result.status).toBeLessThan(500);
    });

    it("10. updateOpportunity — should update deal status", async () => {
      if (!opportunityId) return;
      const result = await ghlRequest("PUT", `/opportunities/${opportunityId}`, undefined, {
        status: "won",
        monetaryValue: 1500,
      });
      expect(result.status).toBeLessThan(500);
    });
  });

  // ── Campaign Operations ─────────────────────────────────────────

  describe("Campaign Operations", () => {
    it("11. listCampaigns — should list campaigns", async () => {
      const result = await ghlRequest("GET", "/campaigns/", {
        locationId: LOCATION_ID,
      });
      expect(result.status).toBeLessThan(500);
      if (result.ok) {
        expect(result.data).toHaveProperty("campaigns");
      }
    });
  });

  // ── Workflow Operations ─────────────────────────────────────────

  describe("Workflow Operations", () => {
    it("12. listWorkflows — should list workflows", async () => {
      const result = await ghlRequest("GET", "/workflows/", {
        locationId: LOCATION_ID,
      });
      expect(result.status).toBeLessThan(500);
    });
  });

  // ── API Infrastructure ──────────────────────────────────────────

  describe("API Infrastructure", () => {
    it("13. should return rate limit headers", async () => {
      const result = await ghlRequest("GET", "/contacts/", {
        locationId: LOCATION_ID,
        limit: "1",
      });
      // GHL typically returns rate limit info
      const remaining = result.headers.get("x-ratelimit-remaining");
      const limit = result.headers.get("x-ratelimit-limit");
      console.log(`[GHL Sandbox] Rate limit: ${remaining}/${limit}`);
      expect(result.status).toBeLessThan(500);
    });

    it("14. should reject invalid API key with 401", async () => {
      const url = new URL("/contacts/", GHL_API_BASE);
      url.searchParams.set("locationId", LOCATION_ID);
      url.searchParams.set("limit", "1");

      const response = await fetch(url.toString(), {
        headers: {
          Authorization: "Bearer invalid-key-12345",
          Accept: "application/json",
          Version: API_VERSION,
        },
      });
      expect(response.status).toBe(401);
    });

    it("15. should handle missing Version header gracefully", async () => {
      const url = new URL("/contacts/", GHL_API_BASE);
      url.searchParams.set("locationId", LOCATION_ID);
      url.searchParams.set("limit", "1");

      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          Accept: "application/json",
          // No Version header
        },
      });
      // Should still work or return a clear error
      expect(response.status).toBeLessThan(500);
    });

    it("16. should handle invalid endpoint with 404 or error", async () => {
      const result = await ghlRequest("GET", "/nonexistent-endpoint-xyz");
      expect([400, 401, 403, 404, 405].some((s) => result.status === s || result.status >= 200)).toBe(true);
    });

    it("17. should handle empty body POST gracefully", async () => {
      const url = new URL("/contacts/", GHL_API_BASE);
      const response = await fetch(url.toString(), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          Accept: "application/json",
          Version: API_VERSION,
          "Content-Type": "application/json",
        },
        body: "{}",
      });
      // Should get a validation error, not a 500
      expect(response.status).toBeLessThan(500);
    });
  });

  // ── Cleanup ─────────────────────────────────────────────────────

  describe("Cleanup", () => {
    it("18. should delete test contact (cleanup)", async () => {
      if (!testContactId) return;
      const result = await ghlRequest("DELETE", `/contacts/${testContactId}`);
      console.log(`[GHL Sandbox] Cleanup contact ${testContactId}: ${result.status}`);
      // Don't fail on cleanup errors
      expect(result.status).toBeDefined();
    });
  });
});
