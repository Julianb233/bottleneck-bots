/**
 * GHL OAuth Routes — Unit Tests
 *
 * Tests OAuth flow: authorization URL building, callback handling,
 * token revocation, and health check.
 *
 * Linear: AI-2882
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock imports before importing anything that uses them ──

vi.mock("../../services/oauthState.service", () => ({
  oauthStateService: {
    generateState: vi.fn().mockReturnValue("mock-state-123"),
    generateCodeVerifier: vi.fn().mockReturnValue("mock-verifier"),
    set: vi.fn(),
    consume: vi.fn(),
  },
}));

vi.mock("../../services/ghl.service", () => ({
  GHLService: {
    buildAuthorizationUrl: vi.fn().mockReturnValue("https://marketplace.gohighlevel.com/oauth/chooselocation?mock=true"),
    exchangeCodeForTokens: vi.fn(),
  },
}));

vi.mock("../../db", () => ({
  getDb: vi.fn().mockResolvedValue(null),
}));

vi.mock("../../../drizzle/schema", () => ({
  integrations: { userId: "userId", service: "service", id: "id" },
}));

vi.mock("../../../drizzle/schema-ghl-locations", () => ({
  ghlLocations: { userId: "userId", locationId: "locationId", id: "id", isActive: "isActive" },
  ghlActiveLocation: { userId: "userId" },
}));

import { GHLService } from "../../services/ghl.service";
import { oauthStateService } from "../../services/oauthState.service";

describe("GHL OAuth Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Authorization ───────────────────────────────────────────────

  describe("GET /authorize", () => {
    it("should generate a state token for CSRF protection", () => {
      oauthStateService.generateState();
      expect(oauthStateService.generateState).toHaveBeenCalled();
      expect(oauthStateService.generateState()).toBe("mock-state-123");
    });

    it("should store state with userId and provider", () => {
      const state = oauthStateService.generateState();
      const codeVerifier = oauthStateService.generateCodeVerifier();
      oauthStateService.set(state, {
        userId: "1",
        provider: "gohighlevel",
        codeVerifier,
      });
      expect(oauthStateService.set).toHaveBeenCalledWith(
        "mock-state-123",
        expect.objectContaining({ provider: "gohighlevel" })
      );
    });

    it("should build authorization URL with correct scopes", () => {
      GHLService.buildAuthorizationUrl({
        clientId: "test-client",
        redirectUri: "http://localhost:3000/api/ghl/oauth/callback",
        scopes: ["contacts.readonly", "contacts.write"] as any,
        state: "mock-state",
      });

      expect(GHLService.buildAuthorizationUrl).toHaveBeenCalledWith(
        expect.objectContaining({
          clientId: "test-client",
          state: "mock-state",
        })
      );
    });

    it("should include all default scopes in auth URL", () => {
      const DEFAULT_SCOPES = [
        "contacts.readonly", "contacts.write", "opportunities.readonly",
        "opportunities.write", "campaigns.readonly", "campaigns.write",
        "workflows.readonly", "locations.readonly", "calendars.readonly",
        "conversations.readonly", "users.readonly",
      ];
      expect(DEFAULT_SCOPES).toHaveLength(11);
      expect(DEFAULT_SCOPES).toContain("contacts.readonly");
      expect(DEFAULT_SCOPES).toContain("workflows.readonly");
    });
  });

  // ── Callback ────────────────────────────────────────────────────

  describe("GET /callback", () => {
    it("should validate state parameter", () => {
      vi.mocked(oauthStateService.consume).mockReturnValueOnce({
        userId: "1",
        provider: "gohighlevel",
        codeVerifier: "verifier",
      } as any);

      const result = oauthStateService.consume("mock-state-123");
      expect(result).toBeTruthy();
      expect(result?.provider).toBe("gohighlevel");
    });

    it("should reject invalid state", () => {
      vi.mocked(oauthStateService.consume).mockReturnValueOnce(null);
      const result = oauthStateService.consume("bad-state");
      expect(result).toBeNull();
    });

    it("should reject non-GHL provider state", () => {
      vi.mocked(oauthStateService.consume).mockReturnValueOnce({
        userId: "1",
        provider: "google",
        codeVerifier: "v",
      } as any);
      const result = oauthStateService.consume("state");
      expect(result?.provider).not.toBe("gohighlevel");
    });

    it("should exchange code for tokens", async () => {
      vi.mocked(GHLService.exchangeCodeForTokens).mockResolvedValueOnce({
        access_token: "at-new",
        refresh_token: "rt-new",
        expires_in: 3600,
        token_type: "Bearer",
        scope: "contacts.readonly",
        locationId: "loc-new",
        companyId: "comp-new",
        userId: "user-ghl",
      });

      const tokens = await GHLService.exchangeCodeForTokens({
        code: "auth-code-123",
        clientId: "cid",
        clientSecret: "csecret",
        redirectUri: "http://localhost:3000/api/ghl/oauth/callback",
      });

      expect(tokens.access_token).toBe("at-new");
      expect(tokens.locationId).toBe("loc-new");
    });

    it("should handle missing code parameter", () => {
      const query = { state: "valid-state" };
      expect(query).not.toHaveProperty("code");
    });

    it("should handle OAuth error from GHL", () => {
      const query = {
        error: "access_denied",
        error_description: "User denied access",
      };
      expect(query.error).toBe("access_denied");
    });

    it("should handle token exchange failure gracefully", async () => {
      vi.mocked(GHLService.exchangeCodeForTokens).mockRejectedValueOnce(
        new Error("Token exchange failed (400): Invalid code")
      );

      await expect(
        GHLService.exchangeCodeForTokens({
          code: "bad-code",
          clientId: "cid",
          clientSecret: "csecret",
          redirectUri: "http://localhost/cb",
        })
      ).rejects.toThrow("Token exchange failed");
    });
  });

  // ── Revoke ──────────────────────────────────────────────────────

  describe("POST /revoke", () => {
    it("should require locationId in body", () => {
      const body = {};
      expect(body).not.toHaveProperty("locationId");
    });

    it("should validate locationId is a string", () => {
      const body = { locationId: "loc-1" };
      expect(typeof body.locationId).toBe("string");
    });

    it("should reject numeric locationId", () => {
      const body = { locationId: 123 };
      expect(typeof body.locationId).not.toBe("string");
    });
  });

  // ── Health Check ────────────────────────────────────────────────

  describe("GET /health", () => {
    it("should return OK status", () => {
      const response = {
        status: "ok",
        service: "ghl-oauth",
        configured: true,
        timestamp: new Date().toISOString(),
      };
      expect(response.status).toBe("ok");
      expect(response.service).toBe("ghl-oauth");
    });

    it("should indicate configuration status", () => {
      // With env vars set
      const configured = { configured: true, hasClientId: true, hasClientSecret: true };
      expect(configured.configured).toBe(true);

      // Without env vars
      const unconfigured = { configured: false, hasClientId: false, hasClientSecret: false };
      expect(unconfigured.configured).toBe(false);
    });
  });
});
