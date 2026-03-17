/**
 * GHL OAuth Express Routes
 *
 * Handles the OAuth callback from GoHighLevel and token revocation.
 * These are standard Express routes (not tRPC) because GHL redirects
 * the browser directly to the callback URL.
 *
 * Routes:
 * - GET  /api/ghl/oauth/callback  — handle OAuth redirect from GHL
 * - POST /api/ghl/oauth/revoke    — revoke GHL tokens for a location
 */

import type { Express, Request, Response } from "express";
import { getGHLService } from "../services/ghl.service";

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

export function registerGHLOAuthRoutes(app: Express): void {
  /**
   * GET /api/ghl/oauth/callback
   *
   * GHL redirects here after the user authorizes.
   * Exchanges the code for tokens and stores them.
   */
  app.get("/api/ghl/oauth/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");

    if (!code || !state) {
      res.status(400).json({
        error: "Missing required parameters",
        message: "Both 'code' and 'state' query parameters are required.",
      });
      return;
    }

    try {
      const service = getGHLService();
      const result = await service.handleCallback(code, state);

      if (!result.success) {
        // Redirect to settings page with error
        const errorParam = encodeURIComponent(result.error || "Unknown error");
        res.redirect(`/settings?tab=oauth&ghl_error=${errorParam}`);
        return;
      }

      // Redirect to settings page with success
      const locationParam = encodeURIComponent(result.locationId || "");
      res.redirect(
        `/settings?tab=oauth&ghl_connected=true&ghl_location=${locationParam}`
      );
    } catch (error) {
      console.error("[GHL OAuth] Callback error:", error);
      const errorMsg = encodeURIComponent(
        error instanceof Error ? error.message : "OAuth callback failed"
      );
      res.redirect(`/settings?tab=oauth&ghl_error=${errorMsg}`);
    }
  });

  /**
   * POST /api/ghl/oauth/revoke
   *
   * Revoke GHL tokens for a specific location.
   * Requires authentication (checked via session).
   */
  app.post("/api/ghl/oauth/revoke", async (req: Request, res: Response) => {
    try {
      // Check authentication - user should be on ctx from middleware
      const user = (req as any).user;
      if (!user?.id) {
        res.status(401).json({ error: "Authentication required" });
        return;
      }

      const locationId = req.body?.locationId;
      if (!locationId) {
        res.status(400).json({ error: "locationId is required" });
        return;
      }

      const service = getGHLService();
      await service.revokeAccess(user.id, locationId);

      res.json({
        success: true,
        message: `Revoked access for location ${locationId}`,
      });
    } catch (error) {
      console.error("[GHL OAuth] Revoke error:", error);
      res.status(500).json({
        error: "Failed to revoke GHL access",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  console.log("[GHL OAuth] Routes registered: /api/ghl/oauth/callback, /api/ghl/oauth/revoke");
}
