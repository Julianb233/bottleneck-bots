/**
 * GHL OAuth Express Routes
 * Handles OAuth callback and token exchange for GoHighLevel integration
 */

import type { Express, Request, Response } from "express";
import { getGHLService } from "../services/ghl.service";
import { sdk } from "./sdk";

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

export function registerGhlOAuthRoutes(app: Express) {
  /**
   * GET /api/ghl/oauth/authorize
   * Initiate GHL OAuth flow — redirects user to GHL authorization page
   */
  app.get("/api/ghl/oauth/authorize", async (req: Request, res: Response) => {
    try {
      const user = await sdk.authenticateRequest(req);
      if (!user) {
        res.redirect(302, "/login?returnTo=/settings");
        return;
      }

      const ghl = getGHLService();
      const { authorizationUrl } = await ghl.initiateAuthorization(user.id);
      res.redirect(302, authorizationUrl);
    } catch (error) {
      console.error("[GHL OAuth] Authorize error:", error);
      const message = error instanceof Error ? error.message : "Failed to start OAuth flow";
      res.redirect(302, `/settings?tab=integrations&ghl=error&message=${encodeURIComponent(message)}`);
    }
  });

  /**
   * GET /api/ghl/oauth/callback
   * Handle GHL OAuth callback — exchange code for tokens and store connection
   */
  app.get("/api/ghl/oauth/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");

    if (!code || !state) {
      res.status(400).json({ error: "code and state parameters are required" });
      return;
    }

    try {
      const ghl = getGHLService();
      const result = await ghl.handleCallback(code, state);

      if (!result.success) {
        console.error("[GHL OAuth] Callback failed:", result.error);
        res.redirect(
          302,
          `/settings?tab=integrations&ghl=error&message=${encodeURIComponent(result.error || "OAuth failed")}`
        );
        return;
      }

      console.log(`[GHL OAuth] Connected location ${result.locationId}`);
      res.redirect(302, "/settings?tab=integrations&ghl=connected");
    } catch (error) {
      console.error("[GHL OAuth] Callback error:", error);
      const message = error instanceof Error ? error.message : "OAuth callback failed";
      res.redirect(302, `/settings?tab=integrations&ghl=error&message=${encodeURIComponent(message)}`);
    }
  });

  /**
   * POST /api/ghl/oauth/revoke
   * Revoke GHL access for a location
   */
  app.post("/api/ghl/oauth/revoke", async (req: Request, res: Response) => {
    try {
      const user = await sdk.authenticateRequest(req);
      if (!user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const locationId = req.body?.locationId;
      if (!locationId || typeof locationId !== "string") {
        res.status(400).json({ error: "locationId is required" });
        return;
      }

      const ghl = getGHLService();
      await ghl.revokeAccess(user.id, locationId);
      res.json({ success: true });
    } catch (error) {
      console.error("[GHL OAuth] Revoke error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to revoke access",
      });
    }
  });
}
