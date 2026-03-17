/**
 * GoHighLevel Service
 *
 * OAuth 2.0 token management, auto-refresh, rate limiting, and typed API client wrapper.
 * Uses credentialVault.service.ts for encrypted token storage and oauthState.service.ts for PKCE.
 */

import { ENV } from "../_core/env";
import { getCredentialVault } from "./credentialVault.service";
import { oauthStateService } from "./oauthState.service";
import { getDb } from "../db";
import { eq, and } from "drizzle-orm";
import {
  ghlConnections,
  ghlSyncLog,
  type InsertGhlConnection,
  type InsertGhlSyncLog,
} from "../../drizzle/schema-ghl";

// ========================================
// TYPES
// ========================================

export interface GHLTokenData {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Unix timestamp in ms
  tokenType: string;
  scope: string;
  locationId: string;
  companyId?: string;
  userType?: string;
}

export interface GHLApiResponse<T> {
  data: T;
  statusCode: number;
  rateLimitRemaining?: number;
  rateLimitReset?: number;
}

export interface GHLRequestConfig {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  endpoint: string;
  locationId: string;
  userId: number;
  data?: unknown;
  params?: Record<string, string>;
}

interface RateLimitBucket {
  tokens: number;
  lastRefill: number;
}

interface CircuitBreakerState {
  failures: number;
  state: "closed" | "open" | "half-open";
  lastFailure: number;
  nextRetry: number;
}

// ========================================
// GHL SERVICE
// ========================================

export class GHLService {
  private rateLimitBuckets: Map<string, RateLimitBucket> = new Map();
  private circuitBreakers: Map<string, CircuitBreakerState> = new Map();
  private requestQueues: Map<string, Array<() => void>> = new Map();

  // Rate limit: 100 requests per minute per location
  private readonly MAX_TOKENS = 100;
  private readonly REFILL_INTERVAL_MS = 60_000; // 1 minute

  // Circuit breaker settings
  private readonly CB_FAILURE_THRESHOLD = 5;
  private readonly CB_RESET_TIMEOUT_MS = 30_000; // 30 seconds

  // Retry settings
  private readonly MAX_RETRIES = 3;
  private readonly BASE_RETRY_DELAY_MS = 1_000;

  // ========================================
  // OAUTH MANAGER
  // ========================================

  /**
   * Generate authorization URL with PKCE for GHL OAuth
   */
  async initiateAuthorization(
    userId: number,
    scopes: string[] = [
      "contacts.readonly",
      "contacts.write",
      "locations.readonly",
      "opportunities.readonly",
      "opportunities.write",
      "campaigns.readonly",
      "workflows.readonly",
    ]
  ): Promise<{ authorizationUrl: string }> {
    if (!ENV.ghlClientId) {
      throw new Error("GHL_CLIENT_ID is not configured");
    }
    if (!ENV.ghlRedirectUri) {
      throw new Error("GHL_REDIRECT_URI is not configured");
    }

    // Generate PKCE parameters
    const state = oauthStateService.generateState();
    const codeVerifier = oauthStateService.generateCodeVerifier();
    const codeChallenge = oauthStateService.generateCodeChallenge(codeVerifier);

    // Store state for callback verification
    oauthStateService.set(state, {
      userId: String(userId),
      provider: "ghl",
      codeVerifier,
    });

    // Build authorization URL
    const params = new URLSearchParams({
      response_type: "code",
      client_id: ENV.ghlClientId,
      redirect_uri: ENV.ghlRedirectUri,
      scope: scopes.join(" "),
      state,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
    });

    const authorizationUrl = `https://marketplace.gohighlevel.com/oauth/chooselocation?${params.toString()}`;

    console.log(
      `[GHL] Authorization initiated for user ${userId} with scopes: ${scopes.join(", ")}`
    );

    return { authorizationUrl };
  }

  /**
   * Handle OAuth callback - exchange code for tokens
   */
  async handleCallback(
    code: string,
    state: string
  ): Promise<{
    success: boolean;
    locationId?: string;
    locationName?: string;
    error?: string;
  }> {
    // Verify and consume state
    const stateData = oauthStateService.consume(state);
    if (!stateData) {
      return {
        success: false,
        error: "Invalid or expired OAuth state. Please try connecting again.",
      };
    }

    if (stateData.provider !== "ghl") {
      return { success: false, error: "Invalid OAuth provider" };
    }

    const userId = parseInt(stateData.userId, 10);

    try {
      // Exchange code for tokens
      const tokenResponse = await fetch(
        `${ENV.ghlApiBaseUrl}/oauth/token`,
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            grant_type: "authorization_code",
            client_id: ENV.ghlClientId,
            client_secret: ENV.ghlClientSecret,
            code,
            redirect_uri: ENV.ghlRedirectUri,
            code_verifier: stateData.codeVerifier,
          }).toString(),
        }
      );

      if (!tokenResponse.ok) {
        const errorBody = await tokenResponse.text();
        console.error("[GHL] Token exchange failed:", errorBody);
        return {
          success: false,
          error: `Token exchange failed: ${tokenResponse.status}`,
        };
      }

      const tokenData = await tokenResponse.json();

      const tokens: GHLTokenData = {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresAt: Date.now() + tokenData.expires_in * 1000,
        tokenType: tokenData.token_type || "Bearer",
        scope: tokenData.scope || "",
        locationId: tokenData.locationId || "",
        companyId: tokenData.companyId || "",
        userType: tokenData.userType || "",
      };

      if (!tokens.locationId) {
        return { success: false, error: "No locationId returned from GHL" };
      }

      // Store tokens in credential vault
      const vault = getCredentialVault();
      const credentialId = await vault.storeCredential(userId, {
        name: `GHL - ${tokens.locationId}`,
        service: "ghl",
        type: "oauth_token",
        data: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
        },
        metadata: {
          expiresAt: tokens.expiresAt,
          locationId: tokens.locationId,
          companyId: tokens.companyId,
          scope: tokens.scope,
          userType: tokens.userType,
        },
      });

      // Store connection record
      const db = await getDb();
      if (db) {
        // Check for existing connection to this location
        const existing = await db
          .select()
          .from(ghlConnections)
          .where(
            and(
              eq(ghlConnections.userId, userId),
              eq(ghlConnections.locationId, tokens.locationId)
            )
          )
          .limit(1);

        if (existing.length > 0) {
          // Update existing connection
          await db
            .update(ghlConnections)
            .set({
              status: "connected",
              credentialId,
              companyId: tokens.companyId || null,
              scopes: tokens.scope,
              connectedAt: new Date(),
              lastError: null,
              updatedAt: new Date(),
            })
            .where(eq(ghlConnections.id, existing[0].id));
        } else {
          // Create new connection
          await db.insert(ghlConnections).values({
            userId,
            locationId: tokens.locationId,
            companyId: tokens.companyId || null,
            locationName: null, // Will be fetched via API later
            status: "connected",
            scopes: tokens.scope,
            credentialId,
            connectedAt: new Date(),
          } as InsertGhlConnection);
        }
      }

      console.log(
        `[GHL] Successfully connected location ${tokens.locationId} for user ${userId}`
      );

      return {
        success: true,
        locationId: tokens.locationId,
      };
    } catch (error) {
      console.error("[GHL] OAuth callback error:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error during OAuth",
      };
    }
  }

  /**
   * Revoke access and disconnect a GHL location
   */
  async revokeAccess(userId: number, locationId: string): Promise<void> {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Find the connection
    const [connection] = await db
      .select()
      .from(ghlConnections)
      .where(
        and(
          eq(ghlConnections.userId, userId),
          eq(ghlConnections.locationId, locationId)
        )
      )
      .limit(1);

    if (!connection) {
      throw new Error("GHL connection not found");
    }

    // Delete credential from vault if exists
    if (connection.credentialId) {
      try {
        const vault = getCredentialVault();
        await vault.deleteCredential(userId, connection.credentialId);
      } catch (error) {
        console.warn("[GHL] Failed to delete credential from vault:", error);
      }
    }

    // Update connection status
    await db
      .update(ghlConnections)
      .set({
        status: "disconnected",
        updatedAt: new Date(),
      })
      .where(eq(ghlConnections.id, connection.id));

    console.log(
      `[GHL] Revoked access for location ${locationId}, user ${userId}`
    );
  }

  // ========================================
  // TOKEN MANAGER
  // ========================================

  /**
   * Get a valid access token, auto-refreshing if needed
   */
  async getAccessToken(
    userId: number,
    locationId: string
  ): Promise<string> {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Find the connection
    const [connection] = await db
      .select()
      .from(ghlConnections)
      .where(
        and(
          eq(ghlConnections.userId, userId),
          eq(ghlConnections.locationId, locationId),
        )
      )
      .limit(1);

    if (!connection || !connection.credentialId) {
      throw new Error(`No GHL connection found for location ${locationId}`);
    }

    if (connection.status === "disconnected") {
      throw new Error(`GHL connection for location ${locationId} is disconnected`);
    }

    // Retrieve tokens from vault
    const vault = getCredentialVault();
    const credential = await vault.retrieveCredential(
      userId,
      connection.credentialId
    );

    const metadata = credential.metadata as Record<string, unknown> | undefined;
    const expiresAt = (metadata?.expiresAt as number) || 0;

    // Auto-refresh if within 5 minutes of expiry
    const REFRESH_BUFFER_MS = 5 * 60 * 1000;
    if (Date.now() >= expiresAt - REFRESH_BUFFER_MS) {
      console.log(
        `[GHL] Token expiring soon for location ${locationId}, refreshing...`
      );
      return this.refreshToken(userId, locationId);
    }

    return credential.data.accessToken || "";
  }

  /**
   * Refresh the access token using the refresh token
   */
  async refreshToken(
    userId: number,
    locationId: string
  ): Promise<string> {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const [connection] = await db
      .select()
      .from(ghlConnections)
      .where(
        and(
          eq(ghlConnections.userId, userId),
          eq(ghlConnections.locationId, locationId),
        )
      )
      .limit(1);

    if (!connection || !connection.credentialId) {
      throw new Error(`No GHL connection found for location ${locationId}`);
    }

    const vault = getCredentialVault();
    const credential = await vault.retrieveCredential(
      userId,
      connection.credentialId
    );

    try {
      const response = await fetch(
        `${ENV.ghlApiBaseUrl}/oauth/token`,
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            grant_type: "refresh_token",
            client_id: ENV.ghlClientId,
            client_secret: ENV.ghlClientSecret,
            refresh_token: credential.data.refreshToken || "",
          }).toString(),
        }
      );

      if (!response.ok) {
        const errorBody = await response.text();
        console.error("[GHL] Token refresh failed:", errorBody);

        // Mark connection as needing re-auth
        await db
          .update(ghlConnections)
          .set({
            status: "needs_reauth",
            lastError: `Token refresh failed: ${response.status}`,
            updatedAt: new Date(),
          })
          .where(eq(ghlConnections.id, connection.id));

        throw new Error(`Token refresh failed: ${response.status}`);
      }

      const tokenData = await response.json();

      const newExpiresAt = Date.now() + tokenData.expires_in * 1000;

      // Delete old credential and store new one
      await vault.deleteCredential(userId, connection.credentialId);
      const newCredentialId = await vault.storeCredential(userId, {
        name: `GHL - ${locationId}`,
        service: "ghl",
        type: "oauth_token",
        data: {
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token,
        },
        metadata: {
          expiresAt: newExpiresAt,
          locationId,
          companyId: connection.companyId,
          scope: connection.scopes,
        },
      });

      // Update connection with new credential ID
      await db
        .update(ghlConnections)
        .set({
          credentialId: newCredentialId,
          status: "connected",
          lastError: null,
          updatedAt: new Date(),
        })
        .where(eq(ghlConnections.id, connection.id));

      console.log(
        `[GHL] Token refreshed for location ${locationId}, user ${userId}`
      );

      return tokenData.access_token;
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.startsWith("Token refresh failed")
      ) {
        throw error;
      }

      console.error("[GHL] Token refresh error:", error);
      throw new Error(
        `Failed to refresh GHL token: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  // ========================================
  // RATE LIMITER
  // ========================================

  /**
   * Acquire a rate limit token for a location.
   * Returns immediately if tokens available, otherwise waits.
   */
  private async acquireRateToken(locationId: string): Promise<void> {
    const now = Date.now();
    let bucket = this.rateLimitBuckets.get(locationId);

    if (!bucket) {
      bucket = { tokens: this.MAX_TOKENS, lastRefill: now };
      this.rateLimitBuckets.set(locationId, bucket);
    }

    // Refill tokens based on elapsed time
    const elapsed = now - bucket.lastRefill;
    if (elapsed >= this.REFILL_INTERVAL_MS) {
      bucket.tokens = this.MAX_TOKENS;
      bucket.lastRefill = now;
    } else {
      // Proportional refill
      const refillAmount = Math.floor(
        (elapsed / this.REFILL_INTERVAL_MS) * this.MAX_TOKENS
      );
      bucket.tokens = Math.min(this.MAX_TOKENS, bucket.tokens + refillAmount);
      if (refillAmount > 0) {
        bucket.lastRefill = now;
      }
    }

    if (bucket.tokens > 0) {
      bucket.tokens--;
      return;
    }

    // Wait for next refill
    const waitTime = this.REFILL_INTERVAL_MS - (now - bucket.lastRefill);
    console.log(
      `[GHL] Rate limit reached for location ${locationId}, waiting ${waitTime}ms`
    );

    return new Promise((resolve) => {
      setTimeout(() => {
        const b = this.rateLimitBuckets.get(locationId);
        if (b) {
          b.tokens = this.MAX_TOKENS - 1;
          b.lastRefill = Date.now();
        }
        resolve();
      }, waitTime);
    });
  }

  // ========================================
  // CIRCUIT BREAKER
  // ========================================

  private getCircuitBreaker(locationId: string): CircuitBreakerState {
    let cb = this.circuitBreakers.get(locationId);
    if (!cb) {
      cb = { failures: 0, state: "closed", lastFailure: 0, nextRetry: 0 };
      this.circuitBreakers.set(locationId, cb);
    }
    return cb;
  }

  private checkCircuitBreaker(locationId: string): void {
    const cb = this.getCircuitBreaker(locationId);

    if (cb.state === "open") {
      if (Date.now() >= cb.nextRetry) {
        cb.state = "half-open";
        console.log(
          `[GHL] Circuit breaker half-open for location ${locationId}`
        );
      } else {
        throw new Error(
          `Circuit breaker OPEN for GHL location ${locationId}. Retry after ${new Date(cb.nextRetry).toISOString()}`
        );
      }
    }
  }

  private recordSuccess(locationId: string): void {
    const cb = this.getCircuitBreaker(locationId);
    cb.failures = 0;
    cb.state = "closed";
  }

  private recordFailure(locationId: string): void {
    const cb = this.getCircuitBreaker(locationId);
    cb.failures++;
    cb.lastFailure = Date.now();

    if (cb.failures >= this.CB_FAILURE_THRESHOLD) {
      cb.state = "open";
      cb.nextRetry = Date.now() + this.CB_RESET_TIMEOUT_MS;
      console.error(
        `[GHL] Circuit breaker OPEN for location ${locationId} after ${cb.failures} failures`
      );
    }
  }

  // ========================================
  // API CLIENT
  // ========================================

  /**
   * Make an authenticated API request to GHL
   */
  async request<T>(config: GHLRequestConfig): Promise<GHLApiResponse<T>> {
    const { method, endpoint, locationId, userId, data, params } = config;

    // Check circuit breaker
    this.checkCircuitBreaker(locationId);

    // Acquire rate limit token
    await this.acquireRateToken(locationId);

    // Get access token (auto-refreshes if needed)
    const accessToken = await this.getAccessToken(userId, locationId);

    // Build URL
    const url = new URL(`${ENV.ghlApiBaseUrl}${endpoint}`);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, value);
      }
    }

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        const headers: Record<string, string> = {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          Version: "2021-07-28", // GHL API version
        };

        const fetchConfig: RequestInit = {
          method,
          headers,
        };

        if (data && method !== "GET") {
          fetchConfig.body = JSON.stringify(data);
        }

        const response = await fetch(url.toString(), fetchConfig);

        // Parse rate limit headers
        const rateLimitRemaining = parseInt(
          response.headers.get("x-ratelimit-remaining") || "100",
          10
        );
        const rateLimitReset = parseInt(
          response.headers.get("x-ratelimit-reset") || "0",
          10
        );

        // Update our rate limiter with server feedback
        if (rateLimitRemaining !== undefined) {
          const bucket = this.rateLimitBuckets.get(locationId);
          if (bucket) {
            bucket.tokens = Math.min(bucket.tokens, rateLimitRemaining);
          }
        }

        // Handle 429 (rate limited)
        if (response.status === 429) {
          const retryAfter = parseInt(
            response.headers.get("retry-after") || "60",
            10
          );
          console.warn(
            `[GHL] Rate limited for location ${locationId}, retrying after ${retryAfter}s`
          );

          if (attempt < this.MAX_RETRIES) {
            await this.sleep(retryAfter * 1000);
            continue;
          }
        }

        // Handle 5xx (server error)
        if (response.status >= 500 && attempt < this.MAX_RETRIES) {
          const delay =
            this.BASE_RETRY_DELAY_MS * Math.pow(2, attempt);
          console.warn(
            `[GHL] Server error ${response.status} for location ${locationId}, retrying in ${delay}ms`
          );
          this.recordFailure(locationId);
          await this.sleep(delay);
          continue;
        }

        if (!response.ok) {
          const errorBody = await response.text();
          this.recordFailure(locationId);
          throw new Error(
            `GHL API error ${response.status}: ${errorBody}`
          );
        }

        // Success
        this.recordSuccess(locationId);

        const responseData = (await response.json()) as T;

        return {
          data: responseData,
          statusCode: response.status,
          rateLimitRemaining,
          rateLimitReset,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < this.MAX_RETRIES) {
          const delay =
            this.BASE_RETRY_DELAY_MS * Math.pow(2, attempt);
          await this.sleep(delay);
        }
      }
    }

    this.recordFailure(config.locationId);
    throw lastError || new Error("GHL API request failed after max retries");
  }

  /**
   * Execute multiple requests serially with rate limit awareness
   */
  async batchRequest<T>(
    requests: GHLRequestConfig[]
  ): Promise<GHLApiResponse<T>[]> {
    const results: GHLApiResponse<T>[] = [];

    for (const req of requests) {
      const result = await this.request<T>(req);
      results.push(result);
    }

    return results;
  }

  // ========================================
  // CONNECTION MANAGEMENT
  // ========================================

  /**
   * Get all connections for a user
   */
  async getConnections(
    userId: number
  ): Promise<Array<typeof ghlConnections.$inferSelect>> {
    const db = await getDb();
    if (!db) return [];

    return db
      .select()
      .from(ghlConnections)
      .where(eq(ghlConnections.userId, userId));
  }

  /**
   * Get connection status summary
   */
  async getConnectionStatus(userId: number): Promise<
    Array<{
      locationId: string;
      locationName: string | null;
      status: string;
      connectedAt: Date;
      lastSyncAt: Date | null;
      lastError: string | null;
    }>
  > {
    const connections = await this.getConnections(userId);

    return connections.map((c) => ({
      locationId: c.locationId,
      locationName: c.locationName,
      status: c.status,
      connectedAt: c.connectedAt,
      lastSyncAt: c.lastSyncAt,
      lastError: c.lastError,
    }));
  }

  /**
   * Test a connection by making a simple API call
   */
  async testConnection(
    userId: number,
    locationId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await this.request({
        method: "GET",
        endpoint: "/contacts/v1/",
        locationId,
        userId,
        params: { limit: "1" },
      });

      // Update last sync time
      const db = await getDb();
      if (db) {
        await db
          .update(ghlConnections)
          .set({ lastSyncAt: new Date(), updatedAt: new Date() })
          .where(
            and(
              eq(ghlConnections.userId, userId),
              eq(ghlConnections.locationId, locationId)
            )
          );
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Connection test failed",
      };
    }
  }

  // ========================================
  // SYNC LOGGING
  // ========================================

  /**
   * Log a sync operation
   */
  async logSync(params: Omit<InsertGhlSyncLog, "id" | "createdAt">): Promise<void> {
    const db = await getDb();
    if (!db) return;

    try {
      await db.insert(ghlSyncLog).values(params);
    } catch (error) {
      console.error("[GHL] Failed to log sync:", error);
    }
  }

  // ========================================
  // UTILITIES
  // ========================================

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ========================================
// SINGLETON
// ========================================

let ghlServiceInstance: GHLService | null = null;

export function getGHLService(): GHLService {
  if (!ghlServiceInstance) {
    ghlServiceInstance = new GHLService();
  }
  return ghlServiceInstance;
}
