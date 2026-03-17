/**
 * GHL OAuth 2.0 Express Routes
 *
 * Plain Express routes (not tRPC) because OAuth redirects require
 * standard HTTP redirects that don't fit tRPC's RPC model.
 *
 * Routes:
 *   GET  /api/ghl/oauth/authorize  — redirect to GHL OAuth consent
 *   GET  /api/ghl/oauth/callback   — handle callback, exchange code for tokens, store
 *   POST /api/ghl/oauth/revoke     — revoke tokens for a location
 *
 * Linear: AI-2877
 */

import express, { Request, Response } from "express";
import { oauthStateService } from "../../services/oauthState.service";
import { GHLService, type GHLScope } from "../../services/ghl.service";
import { getDb } from "../../db";
import { integrations } from "../../../drizzle/schema";
import { ghlLocations, ghlActiveLocation } from "../../../drizzle/schema-ghl-locations";
import { eq, and } from "drizzle-orm";

const router = express.Router();

// ========================================
// CONFIG
// ========================================

const BASE_URL = process.env.APP_URL || "http://localhost:3000";

function getGHLConfig() {
  return {
    clientId: process.env.GHL_CLIENT_ID || "",
    clientSecret: process.env.GHL_CLIENT_SECRET || "",
    redirectUri:
      process.env.GHL_REDIRECT_URI || `${BASE_URL}/api/ghl/oauth/callback`,
  };
}

/** Default scopes for GHL OAuth — matches PRD requirements */
const DEFAULT_SCOPES: GHLScope[] = [
  "contacts.readonly",
  "contacts.write",
  "opportunities.readonly",
  "opportunities.write",
  "campaigns.readonly",
  "campaigns.write",
  "workflows.readonly",
  "locations.readonly",
  "calendars.readonly",
  "conversations.readonly",
  "users.readonly",
];

// ========================================
// GET /api/ghl/oauth/authorize
// ========================================

router.get("/authorize", (req: Request, res: Response) => {
  const config = getGHLConfig();

  if (!config.clientId) {
    console.error("[GHL OAuth] GHL_CLIENT_ID is not configured");
    res.status(500).json({ error: "GHL OAuth not configured" });
    return;
  }

  // The userId comes from the session (same as tRPC context)
  const userId = (req as any).user?.id;
  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  // Generate CSRF state
  const state = oauthStateService.generateState();
  const codeVerifier = oauthStateService.generateCodeVerifier();

  oauthStateService.set(state, {
    userId: String(userId),
    provider: "gohighlevel",
    codeVerifier,
  });

  // Build authorization URL
  const authUrl = GHLService.buildAuthorizationUrl({
    clientId: config.clientId,
    redirectUri: config.redirectUri,
    scopes: DEFAULT_SCOPES,
    state,
  });

  console.log(`[GHL OAuth] Initiating OAuth for user ${userId}`, {
    state: state.substring(0, 8) + "...",
    redirectUri: config.redirectUri,
  });

  res.redirect(authUrl);
});

// ========================================
// GET /api/ghl/oauth/callback
// ========================================

router.get("/callback", async (req: Request, res: Response) => {
  const { code, state, error, error_description } = req.query;

  console.log("[GHL OAuth] Callback received", {
    hasCode: !!code,
    hasState: !!state,
    hasError: !!error,
  });

  // Handle OAuth errors from GHL
  if (error) {
    console.error("[GHL OAuth] Authorization error:", {
      error,
      description: error_description,
    });
    const msg = error_description || error;
    res.redirect(
      `/settings?tab=oauth&ghl=error&message=${encodeURIComponent(String(msg))}`
    );
    return;
  }

  if (!code || typeof code !== "string") {
    res.redirect(
      "/settings?tab=oauth&ghl=error&message=Missing+authorization+code"
    );
    return;
  }

  if (!state || typeof state !== "string") {
    res.redirect(
      "/settings?tab=oauth&ghl=error&message=Missing+state+parameter"
    );
    return;
  }

  try {
    // Validate state (CSRF protection)
    const stateData = oauthStateService.consume(state);
    if (!stateData || stateData.provider !== "gohighlevel") {
      console.error("[GHL OAuth] Invalid or expired state");
      res.redirect(
        "/settings?tab=oauth&ghl=error&message=Invalid+or+expired+state"
      );
      return;
    }

    const userId = parseInt(stateData.userId, 10);
    const config = getGHLConfig();

    // Exchange code for tokens
    console.log("[GHL OAuth] Exchanging code for tokens...");
    const tokens = await GHLService.exchangeCodeForTokens({
      code,
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      redirectUri: config.redirectUri,
    });

    console.log("[GHL OAuth] Tokens received", {
      hasAccessToken: !!tokens.access_token,
      hasRefreshToken: !!tokens.refresh_token,
      expiresIn: tokens.expires_in,
      locationId: tokens.locationId,
      companyId: tokens.companyId,
      scope: tokens.scope,
    });

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
    const serviceName = `ghl:${tokens.locationId}`;

    // Store in integrations table
    const db = await getDb();
    if (!db) {
      res.redirect(
        "/settings?tab=oauth&ghl=error&message=Database+not+available"
      );
      return;
    }

    // Check if this location already has an integration
    const [existing] = await db
      .select()
      .from(integrations)
      .where(
        and(
          eq(integrations.userId, userId),
          eq(integrations.service, serviceName)
        )
      )
      .limit(1);

    const metadata = JSON.stringify({
      companyId: tokens.companyId,
      ghlUserId: tokens.userId,
      scope: tokens.scope,
      tokenType: tokens.token_type,
      connectedAt: new Date().toISOString(),
      lastRefreshedAt: new Date().toISOString(),
    });

    if (existing) {
      await db
        .update(integrations)
        .set({
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          expiresAt,
          isActive: "true",
          metadata,
          updatedAt: new Date(),
        })
        .where(eq(integrations.id, existing.id));

      console.log(
        `[GHL OAuth] Updated existing integration for location ${tokens.locationId}`
      );
    } else {
      await db.insert(integrations).values({
        userId,
        service: serviceName,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt,
        isActive: "true",
        metadata,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      console.log(
        `[GHL OAuth] Created new integration for location ${tokens.locationId}`
      );
    }

    // Auto-create/update ghl_locations entry
    const [existingLocation] = await db
      .select()
      .from(ghlLocations)
      .where(
        and(
          eq(ghlLocations.userId, userId),
          eq(ghlLocations.locationId, tokens.locationId)
        )
      )
      .limit(1);

    if (existingLocation) {
      await db
        .update(ghlLocations)
        .set({
          companyId: tokens.companyId,
          isActive: true,
          updatedAt: new Date(),
        })
        .where(eq(ghlLocations.id, existingLocation.id));
    } else {
      await db.insert(ghlLocations).values({
        userId,
        locationId: tokens.locationId,
        companyId: tokens.companyId,
        name: `Location ${tokens.locationId.substring(0, 8)}`,
        isActive: true,
        config: {
          automationsEnabled: true,
          contactSyncEnabled: true,
          pipelineSyncEnabled: true,
          calendarSyncEnabled: false,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    // Auto-set as active location if it's the first one
    const [existingActive] = await db
      .select()
      .from(ghlActiveLocation)
      .where(eq(ghlActiveLocation.userId, userId))
      .limit(1);

    if (!existingActive) {
      await db.insert(ghlActiveLocation).values({
        userId,
        locationId: tokens.locationId,
        selectedAt: new Date(),
      });
    }

    res.redirect(
      `/settings?tab=oauth&ghl=success&locationId=${encodeURIComponent(tokens.locationId)}`
    );
  } catch (err) {
    console.error("[GHL OAuth] Callback error:", err);
    const message =
      err instanceof Error ? err.message : "Internal server error";
    res.redirect(
      `/settings?tab=oauth&ghl=error&message=${encodeURIComponent(message)}`
    );
  }
});

// ========================================
// POST /api/ghl/oauth/revoke
// ========================================

router.post("/revoke", async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const { locationId } = req.body || {};
  if (!locationId || typeof locationId !== "string") {
    res.status(400).json({ error: "locationId is required" });
    return;
  }

  try {
    const service = new GHLService(locationId, userId);
    await service.disconnect();

    console.log(
      `[GHL OAuth] Revoked tokens for location ${locationId}, user ${userId}`
    );

    res.json({ success: true, message: "GHL connection revoked" });
  } catch (err) {
    console.error("[GHL OAuth] Revoke error:", err);
    res.status(500).json({
      error: "Failed to revoke",
      message: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

// ========================================
// HEALTH CHECK
// ========================================

router.get("/health", (_req: Request, res: Response) => {
  const config = getGHLConfig();
  res.json({
    status: "ok",
    service: "ghl-oauth",
    configured: !!config.clientId && !!config.clientSecret,
    timestamp: new Date().toISOString(),
  });
});

export default router;
