/**
 * GHL OAuth Express Routes
 *
 * Handles the OAuth callback flow that GHL redirects to.
 * These are Express routes (not tRPC) because they handle browser redirects.
 *
 * Routes:
 * - GET  /api/ghl/oauth/callback — handle OAuth callback from GHL
 * - POST /api/ghl/oauth/revoke   — revoke GHL access (API call)
 */

import { Router, type Request, type Response } from "express";
import { getGHLService } from "../services/ghl.service";

export const ghlOAuthRouter = Router();

/**
 * GET /api/ghl/oauth/callback
 * GHL redirects here after user authorizes the app.
 * Exchanges the authorization code for tokens and redirects to settings.
 */
ghlOAuthRouter.get("/callback", async (req: Request, res: Response) => {
  const code = typeof req.query.code === "string" ? req.query.code : undefined;
  const state = typeof req.query.state === "string" ? req.query.state : undefined;
  const error = typeof req.query.error === "string" ? req.query.error : undefined;

  // Handle OAuth errors from GHL
  if (error) {
    console.error(`[GHL OAuth] Authorization denied: ${error}`);
    res.redirect(`/settings?ghl_error=${encodeURIComponent(error)}`);
    return;
  }

  if (!code || !state) {
    res.status(400).json({ error: "Missing code or state parameter" });
    return;
  }

  try {
    const ghl = getGHLService();
    const { userId, tokens } = await ghl.handleCallback(code, state);

    console.log(`[GHL OAuth] Successfully connected for user ${userId}`);

    // Redirect back to settings with success indicator
    res.redirect("/settings?ghl_connected=true");
  } catch (err) {
    console.error("[GHL OAuth] Callback failed:", err);
    const message = err instanceof Error ? err.message : "OAuth callback failed";
    res.redirect(`/settings?ghl_error=${encodeURIComponent(message)}`);
  }
});

/**
 * POST /api/ghl/oauth/revoke
 * Revoke GHL access for the authenticated user.
 * (This is also available via tRPC at ghl.disconnect, but provided here for REST compatibility)
 */
ghlOAuthRouter.post("/revoke", async (req: Request, res: Response) => {
  // Note: In a production setup, you'd extract userId from the session/cookie.
  // For now, accept it from the request body or rely on tRPC route.
  const userId = req.body?.userId;

  if (!userId) {
    res.status(400).json({ error: "userId is required" });
    return;
  }

  try {
    const ghl = getGHLService();
    await ghl.revokeAccess(parseInt(userId, 10));

    res.json({ success: true, message: "GHL access revoked" });
  } catch (err) {
    console.error("[GHL OAuth] Revoke failed:", err);
    res.status(500).json({
      error: "Failed to revoke GHL access",
      message: err instanceof Error ? err.message : "Unknown error",
    });
  }
});
