/**
 * GHL OAuth Express Routes
 * Handles OAuth callback and token exchange for GoHighLevel integration
 */

import type { Express, Request, Response } from "express";
import { getGhlService } from "../services/ghl.service";
import { sdk } from "./sdk";

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

export function registerGhlOAuthRoutes(app: Express) {
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
      // Authenticate the user from session
      const user = await sdk.authenticateRequest(req);
      if (!user) {
        // Redirect to login with return URL
        res.redirect(302, "/login?returnTo=/settings");
        return;
      }

      const ghl = getGhlService();

      // Build the redirect URI (must match what was sent in authorization request)
      const protocol = req.headers["x-forwarded-proto"] || req.protocol || "http";
      const host = req.headers["x-forwarded-host"] || req.headers.host || "localhost:3000";
      const redirectUri = `${protocol}://${host}/api/ghl/oauth/callback`;

      // Exchange code for tokens
      const tokenData = await ghl.exchangeCodeForTokens(code, state, redirectUri);

      // Store connection
      await ghl.storeConnection(user.id, tokenData);

      console.log(`[GHL OAuth] Successfully connected for user ${user.id}, location ${tokenData.locationId}`);

      // Redirect to settings page with success
      res.redirect(302, "/settings?tab=integrations&ghl=connected");
    } catch (error) {
      console.error("[GHL OAuth] Callback error:", error);
      const message = error instanceof Error ? error.message : "OAuth callback failed";
      res.redirect(302, `/settings?tab=integrations&ghl=error&message=${encodeURIComponent(message)}`);
    }
  });

  /**
   * POST /api/ghl/oauth/revoke
   * Revoke GHL access for a connection
   */
  app.post("/api/ghl/oauth/revoke", async (req: Request, res: Response) => {
    try {
      const user = await sdk.authenticateRequest(req);
      if (!user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const connectionId = req.body?.connectionId;
      if (!connectionId || typeof connectionId !== "number") {
        res.status(400).json({ error: "connectionId is required" });
        return;
      }

      const ghl = getGhlService();
      await ghl.disconnect(user.id, connectionId);

      res.json({ success: true });
    } catch (error) {
      console.error("[GHL OAuth] Revoke error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to revoke access",
      });
    }
  });
}
