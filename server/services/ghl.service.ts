/**
 * GoHighLevel (GHL) Core Service
 *
 * Production-ready GHL API client with:
 * - OAuth 2.0 token management (stored encrypted via credentialVault)
 * - Automatic token refresh (checks expiry before each call, refreshes 5 min early)
 * - Rate limiter (token bucket: 100 requests/min per location)
 * - Base HTTP client with retry (3 attempts, exponential backoff)
 * - Error categorization (auth errors vs rate limits vs server errors)
 * - Multi-location support
 *
 * Linear: AI-2877
 */

import { getCredentialVault } from "./credentialVault.service";
import { getDb } from "../db";
import { integrations } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";

// ========================================
// CONSTANTS
// ========================================

const GHL_API_BASE = "https://services.leadconnectorhq.com";
const GHL_AUTH_BASE = "https://marketplace.gohighlevel.com";
const GHL_TOKEN_URL = "https://services.leadconnectorhq.com/oauth/token";

/** Refresh tokens 5 minutes before expiry */
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;

/** Rate limit: 100 requests per minute per location */
const RATE_LIMIT_MAX_TOKENS = 100;
const RATE_LIMIT_REFILL_INTERVAL_MS = 60_000;

/** Retry config */
const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 10_000;

// ========================================
// TYPES
// ========================================

export type GHLScope =
  | "contacts.readonly"
  | "contacts.write"
  | "opportunities.readonly"
  | "opportunities.write"
  | "campaigns.readonly"
  | "campaigns.write"
  | "workflows.readonly"
  | "workflows.write"
  | "locations.readonly"
  | "locations.write"
  | "calendars.readonly"
  | "calendars.write"
  | "forms.readonly"
  | "conversations.readonly"
  | "conversations.write"
  | "users.readonly"
  | "medias.readonly"
  | "medias.write";

export interface GHLTokenSet {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // epoch ms
  tokenType: string;
  scope: string;
  locationId: string;
  companyId: string;
  userId: string;
}

export interface GHLRequestConfig {
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  endpoint: string;
  data?: unknown;
  params?: Record<string, string>;
}

export interface GHLApiResponse<T = unknown> {
  data: T;
  status: number;
  rateLimit: {
    remaining: number | null;
    reset: number | null;
    limit: number | null;
  };
}

export type GHLErrorCategory = "auth" | "rate_limit" | "server" | "client" | "network";

export class GHLError extends Error {
  category: GHLErrorCategory;
  status: number;
  retryable: boolean;
  retryAfter?: number;

  constructor(
    message: string,
    category: GHLErrorCategory,
    status: number,
    retryable: boolean,
    retryAfter?: number
  ) {
    super(message);
    this.name = "GHLError";
    this.category = category;
    this.status = status;
    this.retryable = retryable;
    this.retryAfter = retryAfter;
  }
}

export interface GHLConnectionStatus {
  connected: boolean;
  locationId: string | null;
  companyId: string | null;
  tokenExpiresAt: number | null;
  lastRefreshedAt: number | null;
  scopes: string[];
}

export interface GHLLocation {
  id: string;
  name: string;
  companyId: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  phone?: string;
  email?: string;
}

export interface GHLContact {
  id: string;
  locationId: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  email?: string;
  phone?: string;
  tags?: string[];
  source?: string;
  dateAdded?: string;
  customFields?: Array<{ id: string; value: string }>;
}

export interface GHLPipeline {
  id: string;
  name: string;
  locationId: string;
  stages: Array<{
    id: string;
    name: string;
    position: number;
  }>;
}

export interface GHLOpportunity {
  id: string;
  name: string;
  pipelineId: string;
  pipelineStageId: string;
  status: "open" | "won" | "lost" | "abandoned";
  monetaryValue?: number;
  contactId: string;
  locationId: string;
  createdAt?: string;
  updatedAt?: string;
  customFields?: Array<{ id: string; value: string }>;
}

export interface GHLCampaign {
  id: string;
  name: string;
  status: string;
  locationId: string;
}

export interface GHLWorkflow {
  id: string;
  name: string;
  status: string;
  locationId: string;
}

// ========================================
// TOKEN BUCKET RATE LIMITER
// ========================================

class TokenBucketRateLimiter {
  private tokens: number;
  private maxTokens: number;
  private refillIntervalMs: number;
  private lastRefill: number;

  constructor(maxTokens: number, refillIntervalMs: number) {
    this.maxTokens = maxTokens;
    this.tokens = maxTokens;
    this.refillIntervalMs = refillIntervalMs;
    this.lastRefill = Date.now();
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const tokensToAdd = Math.floor(
      (elapsed / this.refillIntervalMs) * this.maxTokens
    );
    if (tokensToAdd > 0) {
      this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
      this.lastRefill = now;
    }
  }

  async acquire(): Promise<void> {
    this.refill();
    if (this.tokens > 0) {
      this.tokens--;
      return;
    }
    // Wait until a token is available
    const waitMs = Math.ceil(
      (this.refillIntervalMs / this.maxTokens) * (1 - this.tokens)
    );
    await new Promise((resolve) => setTimeout(resolve, Math.max(waitMs, 100)));
    this.refill();
    if (this.tokens > 0) {
      this.tokens--;
      return;
    }
    throw new GHLError(
      "Rate limit exceeded — too many requests to GHL",
      "rate_limit",
      429,
      true,
      waitMs / 1000
    );
  }

  get remaining(): number {
    this.refill();
    return this.tokens;
  }
}

// ========================================
// PER-LOCATION RATE LIMITERS
// ========================================

const rateLimiters = new Map<string, TokenBucketRateLimiter>();

function getRateLimiter(locationId: string): TokenBucketRateLimiter {
  if (!rateLimiters.has(locationId)) {
    rateLimiters.set(
      locationId,
      new TokenBucketRateLimiter(RATE_LIMIT_MAX_TOKENS, RATE_LIMIT_REFILL_INTERVAL_MS)
    );
  }
  return rateLimiters.get(locationId)!;
}

// ========================================
// GHL SERVICE CLASS
// ========================================

export class GHLService {
  private locationId: string;
  private userId: number;
  private cachedToken: { accessToken: string; expiresAt: number } | null = null;

  constructor(locationId: string, userId: number) {
    this.locationId = locationId;
    this.userId = userId;
  }

  // ----------------------------------------
  // OAuth 2.0 helpers
  // ----------------------------------------

  /**
   * Build the GHL OAuth authorization URL
   */
  static buildAuthorizationUrl(params: {
    clientId: string;
    redirectUri: string;
    scopes: GHLScope[];
    state: string;
  }): string {
    const url = new URL("/oauth/chooselocation", GHL_AUTH_BASE);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", params.clientId);
    url.searchParams.set("redirect_uri", params.redirectUri);
    url.searchParams.set("scope", params.scopes.join(" "));
    url.searchParams.set("state", params.state);
    return url.toString();
  }

  /**
   * Exchange an authorization code for tokens
   */
  static async exchangeCodeForTokens(params: {
    code: string;
    clientId: string;
    clientSecret: string;
    redirectUri: string;
  }): Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
    token_type: string;
    scope: string;
    locationId: string;
    companyId: string;
    userId: string;
  }> {
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code: params.code,
      client_id: params.clientId,
      client_secret: params.clientSecret,
      redirect_uri: params.redirectUri,
    });

    const response = await fetch(GHL_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new GHLError(
        `Token exchange failed (${response.status}): ${text}`,
        "auth",
        response.status,
        false
      );
    }

    return response.json();
  }

  /**
   * Refresh an access token using a refresh token
   */
  static async refreshAccessToken(params: {
    refreshToken: string;
    clientId: string;
    clientSecret: string;
  }): Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
    token_type: string;
    scope: string;
  }> {
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: params.refreshToken,
      client_id: params.clientId,
      client_secret: params.clientSecret,
    });

    const response = await fetch(GHL_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new GHLError(
        `Token refresh failed (${response.status}): ${text}`,
        "auth",
        response.status,
        false
      );
    }

    return response.json();
  }

  // ----------------------------------------
  // Token management
  // ----------------------------------------

  /**
   * Get a valid access token, refreshing automatically if within 5 min of expiry.
   */
  async getAccessToken(): Promise<string> {
    // Check in-memory cache first
    if (
      this.cachedToken &&
      this.cachedToken.expiresAt > Date.now() + TOKEN_REFRESH_BUFFER_MS
    ) {
      return this.cachedToken.accessToken;
    }

    // Fetch from DB
    const db = await getDb();
    if (!db) throw new GHLError("Database not available", "server", 500, false);

    const [integration] = await db
      .select()
      .from(integrations)
      .where(
        and(
          eq(integrations.userId, this.userId),
          eq(integrations.service, `ghl:${this.locationId}`),
          eq(integrations.isActive, "true")
        )
      )
      .limit(1);

    if (!integration) {
      throw new GHLError(
        `No GHL connection found for location ${this.locationId}`,
        "auth",
        401,
        false
      );
    }

    // Parse metadata for expiry info
    const metadata = integration.metadata
      ? JSON.parse(integration.metadata)
      : {};
    const expiresAt = integration.expiresAt
      ? new Date(integration.expiresAt).getTime()
      : 0;

    // If token is still fresh, decrypt and return
    if (expiresAt > Date.now() + TOKEN_REFRESH_BUFFER_MS) {
      // Retrieve via credential vault if stored there, otherwise use integration table
      const vault = getCredentialVault();
      if (metadata.credentialId) {
        const cred = await vault.retrieveCredential(
          this.userId,
          metadata.credentialId
        );
        this.cachedToken = {
          accessToken: cred.data.accessToken!,
          expiresAt,
        };
        return cred.data.accessToken!;
      }

      // Fallback: access token stored directly in integrations table
      if (integration.accessToken) {
        this.cachedToken = {
          accessToken: integration.accessToken,
          expiresAt,
        };
        return integration.accessToken;
      }
    }

    // Token expired or about to expire — refresh
    const clientId = process.env.GHL_CLIENT_ID;
    const clientSecret = process.env.GHL_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      throw new GHLError(
        "GHL_CLIENT_ID and GHL_CLIENT_SECRET must be set",
        "auth",
        500,
        false
      );
    }

    // Get the refresh token
    let refreshToken: string | null = null;
    if (metadata.credentialId) {
      const vault = getCredentialVault();
      const cred = await vault.retrieveCredential(
        this.userId,
        metadata.credentialId
      );
      refreshToken = cred.data.refreshToken || null;
    }
    if (!refreshToken) {
      refreshToken = integration.refreshToken || null;
    }
    if (!refreshToken) {
      throw new GHLError(
        "No refresh token available — user must re-authorize",
        "auth",
        401,
        false
      );
    }

    console.log(
      `[GHL] Refreshing token for location ${this.locationId}, user ${this.userId}`
    );

    const tokens = await GHLService.refreshAccessToken({
      refreshToken,
      clientId,
      clientSecret,
    });

    const newExpiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    // Persist updated tokens
    if (metadata.credentialId) {
      const vault = getCredentialVault();
      await vault.storeCredential(this.userId, {
        name: `ghl:${this.locationId}`,
        service: "gohighlevel",
        type: "oauth_token",
        data: {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
        },
        metadata: { locationId: this.locationId, scope: tokens.scope },
      });
    }

    // Always update the integrations table
    await db
      .update(integrations)
      .set({
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: newExpiresAt,
        updatedAt: new Date(),
        metadata: JSON.stringify({
          ...metadata,
          scope: tokens.scope,
          lastRefreshedAt: new Date().toISOString(),
        }),
      })
      .where(
        and(
          eq(integrations.userId, this.userId),
          eq(integrations.service, `ghl:${this.locationId}`)
        )
      );

    this.cachedToken = {
      accessToken: tokens.access_token,
      expiresAt: newExpiresAt.getTime(),
    };

    console.log(
      `[GHL] Token refreshed for location ${this.locationId}, expires ${newExpiresAt.toISOString()}`
    );

    return tokens.access_token;
  }

  // ----------------------------------------
  // HTTP client with retry
  // ----------------------------------------

  /**
   * Make an authenticated request to the GHL API with rate limiting and retry.
   */
  async request<T = unknown>(
    config: GHLRequestConfig
  ): Promise<GHLApiResponse<T>> {
    const limiter = getRateLimiter(this.locationId);
    let lastError: GHLError | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        // Acquire rate limit token
        await limiter.acquire();

        // Get fresh access token (auto-refreshes if needed)
        const accessToken = await this.getAccessToken();

        // Build URL
        const url = new URL(config.endpoint, GHL_API_BASE);
        if (config.params) {
          for (const [key, value] of Object.entries(config.params)) {
            url.searchParams.set(key, value);
          }
        }

        // Make request
        const fetchOptions: RequestInit = {
          method: config.method,
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/json",
            Version: "2021-07-28",
            ...(config.data ? { "Content-Type": "application/json" } : {}),
          },
        };

        if (config.data && config.method !== "GET") {
          fetchOptions.body = JSON.stringify(config.data);
        }

        const response = await fetch(url.toString(), fetchOptions);

        // Parse rate limit headers
        const rateLimit = {
          remaining: response.headers.get("x-ratelimit-remaining")
            ? parseInt(response.headers.get("x-ratelimit-remaining")!, 10)
            : null,
          reset: response.headers.get("x-ratelimit-reset")
            ? parseInt(response.headers.get("x-ratelimit-reset")!, 10)
            : null,
          limit: response.headers.get("x-ratelimit-limit")
            ? parseInt(response.headers.get("x-ratelimit-limit")!, 10)
            : null,
        };

        // Handle errors
        if (!response.ok) {
          const errorText = await response.text().catch(() => "");
          const error = categorizeError(response.status, errorText);

          if (error.retryable && attempt < MAX_RETRIES) {
            lastError = error;
            const backoff = Math.min(
              INITIAL_BACKOFF_MS * Math.pow(2, attempt),
              MAX_BACKOFF_MS
            );
            const jitter = Math.random() * backoff * 0.1;
            console.log(
              `[GHL] Request failed (${error.status}), retrying in ${backoff}ms (attempt ${attempt + 1}/${MAX_RETRIES})`
            );
            await new Promise((resolve) =>
              setTimeout(resolve, backoff + jitter)
            );
            continue;
          }

          throw error;
        }

        // Parse response
        const data = (await response.json().catch(() => ({}))) as T;

        return { data, status: response.status, rateLimit };
      } catch (error) {
        if (error instanceof GHLError) {
          if (!error.retryable || attempt >= MAX_RETRIES) {
            throw error;
          }
          lastError = error;
        } else {
          // Network error — retryable
          const networkError = new GHLError(
            `Network error: ${error instanceof Error ? error.message : "Unknown"}`,
            "network",
            0,
            true
          );
          if (attempt >= MAX_RETRIES) {
            throw networkError;
          }
          lastError = networkError;
        }

        const backoff = Math.min(
          INITIAL_BACKOFF_MS * Math.pow(2, attempt),
          MAX_BACKOFF_MS
        );
        await new Promise((resolve) => setTimeout(resolve, backoff));
      }
    }

    throw lastError || new GHLError("Max retries exceeded", "server", 500, false);
  }

  // ----------------------------------------
  // Connection status
  // ----------------------------------------

  /**
   * Check GHL connection health for this location.
   */
  async getConnectionStatus(): Promise<GHLConnectionStatus> {
    const db = await getDb();
    if (!db) {
      return {
        connected: false,
        locationId: this.locationId,
        companyId: null,
        tokenExpiresAt: null,
        lastRefreshedAt: null,
        scopes: [],
      };
    }

    const [integration] = await db
      .select()
      .from(integrations)
      .where(
        and(
          eq(integrations.userId, this.userId),
          eq(integrations.service, `ghl:${this.locationId}`),
          eq(integrations.isActive, "true")
        )
      )
      .limit(1);

    if (!integration) {
      return {
        connected: false,
        locationId: this.locationId,
        companyId: null,
        tokenExpiresAt: null,
        lastRefreshedAt: null,
        scopes: [],
      };
    }

    const metadata = integration.metadata
      ? JSON.parse(integration.metadata)
      : {};

    return {
      connected: true,
      locationId: this.locationId,
      companyId: metadata.companyId || null,
      tokenExpiresAt: integration.expiresAt
        ? new Date(integration.expiresAt).getTime()
        : null,
      lastRefreshedAt: metadata.lastRefreshedAt
        ? new Date(metadata.lastRefreshedAt).getTime()
        : null,
      scopes: metadata.scope ? metadata.scope.split(" ") : [],
    };
  }

  /**
   * Revoke tokens and mark integration as inactive.
   */
  async disconnect(): Promise<void> {
    const db = await getDb();
    if (!db) throw new GHLError("Database not available", "server", 500, false);

    await db
      .update(integrations)
      .set({
        isActive: "false",
        accessToken: null,
        refreshToken: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(integrations.userId, this.userId),
          eq(integrations.service, `ghl:${this.locationId}`)
        )
      );

    // Clear cached token
    this.cachedToken = null;

    // Remove rate limiter
    rateLimiters.delete(this.locationId);

    console.log(
      `[GHL] Disconnected location ${this.locationId} for user ${this.userId}`
    );
  }

  // ----------------------------------------
  // Contact / Lead Management
  // ----------------------------------------

  /**
   * Search contacts with optional filters.
   */
  async searchContacts(params: {
    query?: string;
    limit?: number;
    offset?: number;
    filters?: Record<string, string>;
  }): Promise<GHLApiResponse<{ contacts: GHLContact[]; total: number }>> {
    const searchParams: Record<string, string> = {
      locationId: this.locationId,
      ...(params.query ? { query: params.query } : {}),
      ...(params.limit ? { limit: String(params.limit) } : {}),
      ...(params.offset ? { startAfter: String(params.offset) } : {}),
      ...(params.filters || {}),
    };

    return this.request({
      method: "GET",
      endpoint: "/contacts/",
      params: searchParams,
    });
  }

  /**
   * Get a single contact by ID.
   */
  async getContact(contactId: string): Promise<GHLApiResponse<{ contact: GHLContact }>> {
    return this.request({
      method: "GET",
      endpoint: `/contacts/${contactId}`,
    });
  }

  /**
   * Create a new contact in GHL.
   */
  async createContact(data: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    tags?: string[];
    customFields?: Array<{ id: string; value: string }>;
    source?: string;
  }): Promise<GHLApiResponse<{ contact: GHLContact }>> {
    return this.request({
      method: "POST",
      endpoint: "/contacts/",
      data: {
        ...data,
        locationId: this.locationId,
      },
    });
  }

  /**
   * Update an existing contact.
   */
  async updateContact(
    contactId: string,
    data: {
      firstName?: string;
      lastName?: string;
      email?: string;
      phone?: string;
      tags?: string[];
      customFields?: Array<{ id: string; value: string }>;
    }
  ): Promise<GHLApiResponse<{ contact: GHLContact }>> {
    return this.request({
      method: "PUT",
      endpoint: `/contacts/${contactId}`,
      data,
    });
  }

  /**
   * Add tags to a contact (used for lead routing).
   */
  async addContactTags(
    contactId: string,
    tags: string[]
  ): Promise<GHLApiResponse<{ tags: string[] }>> {
    return this.request({
      method: "POST",
      endpoint: `/contacts/${contactId}/tags`,
      data: { tags },
    });
  }

  /**
   * Remove tags from a contact.
   */
  async removeContactTags(
    contactId: string,
    tags: string[]
  ): Promise<GHLApiResponse<unknown>> {
    return this.request({
      method: "DELETE",
      endpoint: `/contacts/${contactId}/tags`,
      data: { tags },
    });
  }

  // ----------------------------------------
  // Pipeline / Opportunity Management
  // ----------------------------------------

  /**
   * List all pipelines for this location.
   */
  async listPipelines(): Promise<GHLApiResponse<{ pipelines: GHLPipeline[] }>> {
    return this.request({
      method: "GET",
      endpoint: "/opportunities/pipelines",
      params: { locationId: this.locationId },
    });
  }

  /**
   * Search opportunities (deals) with filters.
   */
  async searchOpportunities(params: {
    pipelineId?: string;
    stageId?: string;
    status?: "open" | "won" | "lost" | "abandoned" | "all";
    query?: string;
    limit?: number;
    offset?: number;
  }): Promise<GHLApiResponse<{ opportunities: GHLOpportunity[]; meta: { total: number } }>> {
    const searchParams: Record<string, string> = {
      location_id: this.locationId,
      ...(params.pipelineId ? { pipeline_id: params.pipelineId } : {}),
      ...(params.stageId ? { stage_id: params.stageId } : {}),
      ...(params.status && params.status !== "all" ? { status: params.status } : {}),
      ...(params.query ? { q: params.query } : {}),
      ...(params.limit ? { limit: String(params.limit) } : {}),
      ...(params.offset ? { startAfter: String(params.offset) } : {}),
    };

    return this.request({
      method: "GET",
      endpoint: "/opportunities/search",
      params: searchParams,
    });
  }

  /**
   * Create a new opportunity (deal/showing request).
   */
  async createOpportunity(data: {
    pipelineId: string;
    stageId: string;
    contactId: string;
    name: string;
    monetaryValue?: number;
    status?: "open" | "won" | "lost" | "abandoned";
    customFields?: Array<{ id: string; value: string }>;
  }): Promise<GHLApiResponse<{ opportunity: GHLOpportunity }>> {
    return this.request({
      method: "POST",
      endpoint: "/opportunities/",
      data: {
        ...data,
        locationId: this.locationId,
      },
    });
  }

  /**
   * Update an opportunity (move stage, change status, etc.).
   */
  async updateOpportunity(
    opportunityId: string,
    data: {
      stageId?: string;
      status?: "open" | "won" | "lost" | "abandoned";
      monetaryValue?: number;
      name?: string;
      customFields?: Array<{ id: string; value: string }>;
    }
  ): Promise<GHLApiResponse<{ opportunity: GHLOpportunity }>> {
    return this.request({
      method: "PUT",
      endpoint: `/opportunities/${opportunityId}`,
      data,
    });
  }

  // ----------------------------------------
  // Campaign / Drip Management
  // ----------------------------------------

  /**
   * List all campaigns for this location.
   */
  async listCampaigns(): Promise<GHLApiResponse<{ campaigns: GHLCampaign[] }>> {
    return this.request({
      method: "GET",
      endpoint: "/campaigns/",
      params: { locationId: this.locationId },
    });
  }

  /**
   * Add a contact to a campaign (drip sequence).
   */
  async addContactToCampaign(
    campaignId: string,
    contactId: string
  ): Promise<GHLApiResponse<unknown>> {
    return this.request({
      method: "POST",
      endpoint: `/campaigns/${campaignId}/contacts/${contactId}`,
    });
  }

  /**
   * Remove a contact from a campaign.
   */
  async removeContactFromCampaign(
    campaignId: string,
    contactId: string
  ): Promise<GHLApiResponse<unknown>> {
    return this.request({
      method: "DELETE",
      endpoint: `/campaigns/${campaignId}/contacts/${contactId}`,
    });
  }

  // ----------------------------------------
  // Workflow Triggers
  // ----------------------------------------

  /**
   * List available workflows for this location.
   */
  async listWorkflows(): Promise<GHLApiResponse<{ workflows: GHLWorkflow[] }>> {
    return this.request({
      method: "GET",
      endpoint: "/workflows/",
      params: { locationId: this.locationId },
    });
  }

  // ----------------------------------------
  // Static helpers for listing locations
  // ----------------------------------------

  /**
   * List all connected GHL locations for a user.
   */
  static async listLocations(
    userId: number
  ): Promise<
    Array<{
      locationId: string;
      companyId: string | null;
      name: string | null;
      connected: boolean;
      expiresAt: Date | null;
      scopes: string[];
    }>
  > {
    const db = await getDb();
    if (!db) return [];

    const results = await db
      .select()
      .from(integrations)
      .where(
        and(eq(integrations.userId, userId), eq(integrations.isActive, "true"))
      );

    return results
      .filter((r) => r.service.startsWith("ghl:"))
      .map((r) => {
        const metadata = r.metadata ? JSON.parse(r.metadata) : {};
        return {
          locationId: r.service.replace("ghl:", ""),
          companyId: metadata.companyId || null,
          name: metadata.name || null,
          connected: true,
          expiresAt: r.expiresAt,
          scopes: metadata.scope ? metadata.scope.split(" ") : [],
        };
      });
  }
}

// ========================================
// ERROR CATEGORIZATION
// ========================================

function categorizeError(status: number, body: string): GHLError {
  if (status === 401 || status === 403) {
    return new GHLError(
      `GHL auth error (${status}): ${body}`,
      "auth",
      status,
      status === 401
    );
  }

  if (status === 429) {
    let retryAfter = 60;
    try {
      const parsed = JSON.parse(body);
      if (parsed.retryAfter) retryAfter = parsed.retryAfter;
    } catch {
      // ignore
    }
    return new GHLError(
      `GHL rate limit hit: ${body}`,
      "rate_limit",
      429,
      true,
      retryAfter
    );
  }

  if (status >= 500) {
    return new GHLError(
      `GHL server error (${status}): ${body}`,
      "server",
      status,
      true
    );
  }

  return new GHLError(
    `GHL client error (${status}): ${body}`,
    "client",
    status,
    false
  );
}

// ========================================
// FACTORY
// ========================================

/**
 * Create a GHL service instance for a given location and user.
 */
export function createGHLService(
  locationId: string,
  userId: number
): GHLService {
  return new GHLService(locationId, userId);
}
