/**
 * Comprehensive Tests for GHL Core Service
 *
 * Tests OAuth, token management, rate limiting, HTTP client, error handling.
 * Covers 24 test cases across 6 categories.
 *
 * Linear: AI-2882
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  GHLService,
  GHLError,
  createGHLService,
} from "./ghl.service";

// Mock dependencies
vi.mock("./credentialVault.service", () => ({
  getCredentialVault: vi.fn(() => ({
    retrieveCredential: vi.fn().mockResolvedValue({
      data: { accessToken: "vault-token", refreshToken: "vault-refresh" },
    }),
    storeCredential: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock("../db", () => ({
  getDb: vi.fn(),
}));

vi.mock("../../drizzle/schema", () => ({
  integrations: {
    userId: "userId",
    service: "service",
    isActive: "isActive",
    accessToken: "accessToken",
    refreshToken: "refreshToken",
    expiresAt: "expiresAt",
    metadata: "metadata",
    updatedAt: "updatedAt",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((_col, val) => ({ _type: "eq", val })),
  and: vi.fn((...args: unknown[]) => ({ _type: "and", args })),
}));

// ========================================
// TESTS: GHL ERROR CLASS (4 tests)
// ========================================

describe("GHLError", () => {
  it("should create error with all fields", () => {
    const error = new GHLError("Auth failed", "auth", 401, true, 60);
    expect(error.message).toBe("Auth failed");
    expect(error.category).toBe("auth");
    expect(error.status).toBe(401);
    expect(error.retryable).toBe(true);
    expect(error.retryAfter).toBe(60);
    expect(error.name).toBe("GHLError");
  });

  it("should create non-retryable client error", () => {
    const error = new GHLError("Bad request", "client", 400, false);
    expect(error.retryable).toBe(false);
    expect(error.retryAfter).toBeUndefined();
  });

  it("should create rate limit error with retryAfter", () => {
    const error = new GHLError("Rate limited", "rate_limit", 429, true, 30);
    expect(error.category).toBe("rate_limit");
    expect(error.retryAfter).toBe(30);
  });

  it("should extend Error base class", () => {
    const error = new GHLError("Test", "server", 500, true);
    expect(error instanceof Error).toBe(true);
    expect(error instanceof GHLError).toBe(true);
  });
});

// ========================================
// TESTS: FACTORY FUNCTION (2 tests)
// ========================================

describe("createGHLService", () => {
  it("should create a GHLService instance with correct params", () => {
    const service = createGHLService("loc-123", 42);
    expect(service).toBeInstanceOf(GHLService);
  });

  it("should create independent instances for different locations", () => {
    const s1 = createGHLService("loc-1", 1);
    const s2 = createGHLService("loc-2", 2);
    expect(s1).not.toBe(s2);
  });
});

// ========================================
// TESTS: BUILD AUTHORIZATION URL (4 tests)
// ========================================

describe("GHLService.buildAuthorizationUrl", () => {
  it("should build correct OAuth URL with all params", () => {
    const url = GHLService.buildAuthorizationUrl({
      clientId: "client-123",
      redirectUri: "https://app.example.com/callback",
      scopes: ["contacts.readonly", "contacts.write"],
      state: "state-abc",
    });

    expect(url).toContain("marketplace.gohighlevel.com");
    expect(url).toContain("oauth/chooselocation");
    expect(url).toContain("client_id=client-123");
    expect(url).toContain("redirect_uri=");
    expect(url).toContain("state=state-abc");
    expect(url).toContain("response_type=code");
  });

  it("should encode scopes as space-separated string", () => {
    const url = GHLService.buildAuthorizationUrl({
      clientId: "c1",
      redirectUri: "https://app.example.com/cb",
      scopes: ["contacts.readonly", "workflows.write"],
      state: "s1",
    });

    // URL-encoded space-separated scopes
    expect(url).toContain("scope=contacts.readonly");
    expect(url).toContain("workflows.write");
  });

  it("should URL-encode redirect URI", () => {
    const url = GHLService.buildAuthorizationUrl({
      clientId: "c1",
      redirectUri: "https://app.example.com/auth/callback?type=ghl",
      scopes: ["contacts.readonly"],
      state: "s1",
    });

    expect(url).toContain("redirect_uri=");
    // Should be properly encoded
    const parsed = new URL(url);
    expect(parsed.searchParams.get("redirect_uri")).toBe(
      "https://app.example.com/auth/callback?type=ghl"
    );
  });

  it("should handle single scope", () => {
    const url = GHLService.buildAuthorizationUrl({
      clientId: "c1",
      redirectUri: "https://example.com/cb",
      scopes: ["contacts.readonly"],
      state: "s1",
    });

    const parsed = new URL(url);
    expect(parsed.searchParams.get("scope")).toBe("contacts.readonly");
  });
});

// ========================================
// TESTS: EXCHANGE CODE FOR TOKENS (3 tests)
// ========================================

describe("GHLService.exchangeCodeForTokens", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should exchange authorization code for tokens", async () => {
    const tokenResponse = {
      access_token: "acc-123",
      refresh_token: "ref-456",
      expires_in: 86400,
      token_type: "Bearer",
      scope: "contacts.readonly contacts.write",
      locationId: "loc-789",
      companyId: "comp-012",
      userId: "user-345",
    };

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(tokenResponse),
    } as any);

    const result = await GHLService.exchangeCodeForTokens({
      code: "auth-code-xyz",
      clientId: "client-123",
      clientSecret: "secret-456",
      redirectUri: "https://app.example.com/callback",
    });

    expect(result.access_token).toBe("acc-123");
    expect(result.refresh_token).toBe("ref-456");
    expect(result.locationId).toBe("loc-789");

    // Verify fetch was called with correct params
    const [url, opts] = vi.mocked(global.fetch).mock.calls[0];
    expect(url).toContain("oauth/token");
    expect(opts.method).toBe("POST");
  });

  it("should throw GHLError on failed exchange", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      status: 400,
      text: vi.fn().mockResolvedValue("Invalid code"),
    } as any);

    await expect(
      GHLService.exchangeCodeForTokens({
        code: "bad-code",
        clientId: "c",
        clientSecret: "s",
        redirectUri: "https://example.com/cb",
      })
    ).rejects.toThrow(GHLError);
  });

  it("should send form-urlencoded body", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ access_token: "t" }),
    } as any);

    await GHLService.exchangeCodeForTokens({
      code: "code-1",
      clientId: "c1",
      clientSecret: "s1",
      redirectUri: "https://example.com/cb",
    });

    const [, opts] = vi.mocked(global.fetch).mock.calls[0];
    expect(opts.headers["Content-Type"]).toBe(
      "application/x-www-form-urlencoded"
    );
  });
});

// ========================================
// TESTS: REFRESH ACCESS TOKEN (3 tests)
// ========================================

describe("GHLService.refreshAccessToken", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should refresh using refresh token", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        access_token: "new-acc",
        refresh_token: "new-ref",
        expires_in: 86400,
        token_type: "Bearer",
        scope: "contacts.readonly",
      }),
    } as any);

    const result = await GHLService.refreshAccessToken({
      refreshToken: "old-refresh",
      clientId: "c1",
      clientSecret: "s1",
    });

    expect(result.access_token).toBe("new-acc");
    expect(result.refresh_token).toBe("new-ref");
  });

  it("should throw GHLError on refresh failure", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      status: 401,
      text: vi.fn().mockResolvedValue("Invalid refresh token"),
    } as any);

    await expect(
      GHLService.refreshAccessToken({
        refreshToken: "expired-token",
        clientId: "c1",
        clientSecret: "s1",
      })
    ).rejects.toThrow(GHLError);
  });

  it("should use grant_type=refresh_token", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ access_token: "t" }),
    } as any);

    await GHLService.refreshAccessToken({
      refreshToken: "ref",
      clientId: "c",
      clientSecret: "s",
    });

    const [, opts] = vi.mocked(global.fetch).mock.calls[0];
    const body = opts.body as URLSearchParams;
    expect(body.toString()).toContain("grant_type=refresh_token");
  });
});

// ========================================
// TESTS: CONNECTION STATUS (4 tests)
// ========================================

describe("GHLService.getConnectionStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return disconnected when db is unavailable", async () => {
    const { getDb } = await import("../db");
    vi.mocked(getDb).mockResolvedValue(null);

    const service = createGHLService("loc-1", 1);
    const status = await service.getConnectionStatus();

    expect(status.connected).toBe(false);
    expect(status.locationId).toBe("loc-1");
    expect(status.scopes).toEqual([]);
  });

  it("should return disconnected when no integration found", async () => {
    const { getDb } = await import("../db");
    const mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    };
    vi.mocked(getDb).mockResolvedValue(mockDb as any);

    const service = createGHLService("loc-1", 1);
    const status = await service.getConnectionStatus();

    expect(status.connected).toBe(false);
  });

  it("should return connected with scopes when integration exists", async () => {
    const { getDb } = await import("../db");
    const mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([
        {
          userId: 1,
          service: "ghl:loc-1",
          isActive: "true",
          expiresAt: new Date(Date.now() + 3600000),
          metadata: JSON.stringify({
            companyId: "comp-1",
            scope: "contacts.readonly contacts.write",
            lastRefreshedAt: new Date().toISOString(),
          }),
        },
      ]),
    };
    vi.mocked(getDb).mockResolvedValue(mockDb as any);

    const service = createGHLService("loc-1", 1);
    const status = await service.getConnectionStatus();

    expect(status.connected).toBe(true);
    expect(status.companyId).toBe("comp-1");
    expect(status.scopes).toEqual(["contacts.readonly", "contacts.write"]);
  });

  it("should return empty scopes when metadata has no scope", async () => {
    const { getDb } = await import("../db");
    const mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([
        {
          userId: 1,
          service: "ghl:loc-1",
          isActive: "true",
          expiresAt: null,
          metadata: JSON.stringify({}),
        },
      ]),
    };
    vi.mocked(getDb).mockResolvedValue(mockDb as any);

    const service = createGHLService("loc-1", 1);
    const status = await service.getConnectionStatus();

    expect(status.connected).toBe(true);
    expect(status.scopes).toEqual([]);
  });
});

// ========================================
// TESTS: DISCONNECT (2 tests)
// ========================================

describe("GHLService.disconnect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should throw when db is unavailable", async () => {
    const { getDb } = await import("../db");
    vi.mocked(getDb).mockResolvedValue(null);

    const service = createGHLService("loc-1", 1);
    await expect(service.disconnect()).rejects.toThrow(GHLError);
  });

  it("should update integration to inactive and clear tokens", async () => {
    const { getDb } = await import("../db");
    const setFn = vi.fn().mockReturnThis();
    const mockDb = {
      update: vi.fn().mockReturnValue({
        set: setFn,
      }),
    };
    setFn.mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
    vi.mocked(getDb).mockResolvedValue(mockDb as any);

    const service = createGHLService("loc-1", 1);
    await service.disconnect();

    expect(mockDb.update).toHaveBeenCalled();
    expect(setFn).toHaveBeenCalledWith(
      expect.objectContaining({
        isActive: "false",
        accessToken: null,
        refreshToken: null,
      })
    );
  });
});

// ========================================
// TESTS: LIST LOCATIONS (2 tests)
// ========================================

describe("GHLService.listLocations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return empty array when db unavailable", async () => {
    const { getDb } = await import("../db");
    vi.mocked(getDb).mockResolvedValue(null);

    const locations = await GHLService.listLocations(1);
    expect(locations).toEqual([]);
  });

  it("should filter and map GHL integrations", async () => {
    const { getDb } = await import("../db");
    const mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([
        {
          userId: 1,
          service: "ghl:loc-A",
          isActive: "true",
          expiresAt: new Date(Date.now() + 3600000),
          metadata: JSON.stringify({
            companyId: "comp-A",
            scope: "contacts.readonly",
          }),
        },
        {
          userId: 1,
          service: "ghl:loc-B",
          isActive: "true",
          expiresAt: null,
          metadata: null,
        },
        {
          userId: 1,
          service: "stripe:cust_123",
          isActive: "true",
          expiresAt: null,
          metadata: null,
        },
      ]),
    };
    vi.mocked(getDb).mockResolvedValue(mockDb as any);

    const locations = await GHLService.listLocations(1);

    // Should only include ghl: prefixed integrations
    expect(locations).toHaveLength(2);
    expect(locations[0].locationId).toBe("loc-A");
    expect(locations[0].companyId).toBe("comp-A");
    expect(locations[0].scopes).toEqual(["contacts.readonly"]);
    expect(locations[1].locationId).toBe("loc-B");
    expect(locations[1].scopes).toEqual([]);
  });
});
