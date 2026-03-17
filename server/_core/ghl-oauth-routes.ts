/**
 * GHL OAuth Callback Routes
 *
 * Handles the OAuth 2.0 callback from GoHighLevel after user authorization.
 * The flow:
 * 1. User clicks "Connect GHL" in Settings
 * 2. Frontend calls ghl.connect mutation to get authorization URL
 * 3. User is redirected to GHL to authorize
 * 4. GHL redirects back to /api/ghl/oauth/callback with code + state
 * 5. This route exchanges the code for tokens and stores them
 * 6. User is redirected back to Settings page
 */

import type { Express, Request, Response } from "express";
import { getGHLService } from "../services/ghl.service";

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

export function registerGHLOAuthRoutes(app: Express) {
  /**
   * GHL OAuth callback endpoint
   * Called by GHL after user authorizes the app
   */
  app.get("/api/ghl/oauth/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");
    const error = getQueryParam(req, "error");

    // Handle authorization denied
    if (error) {
      console.error("[GHL OAuth] Authorization denied:", error);
      res.redirect(
        `/settings?ghl_error=${encodeURIComponent(error)}`
      );
      return;
    }

    if (!code || !state) {
      res.redirect(
        `/settings?ghl_error=${encodeURIComponent("Missing authorization code or state parameter")}`
      );
      return;
    }

    try {
      const service = getGHLService();
      const result = await service.handleCallback(code, state);

      if (result.success) {
        res.redirect(
          `/settings?ghl_connected=true&ghl_location=${encodeURIComponent(result.locationId || "")}`
        );
      } else {
        res.redirect(
          `/settings?ghl_error=${encodeURIComponent(result.error || "Connection failed")}`
        );
      }
    } catch (err) {
      console.error("[GHL OAuth] Callback error:", err);
      const message = err instanceof Error ? err.message : "OAuth callback failed";
      res.redirect(
        `/settings?ghl_error=${encodeURIComponent(message)}`
      );
    }
  });
}
