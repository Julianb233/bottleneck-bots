/**
 * GHL OAuth Callback Route
 *
 * Handles the OAuth redirect from GoHighLevel after the user authorizes.
 * This must be an Express route (not tRPC) because GHL redirects back to a URL.
 *
 * Flow:
 * 1. User clicks "Connect GHL" in Settings -> frontend calls ghl.connect tRPC mutation
 * 2. Frontend redirects user to GHL authorization URL
 * 3. User authorizes on GHL -> GHL redirects to this callback URL
 * 4. This route exchanges the code for tokens via ghl.service.ts
 * 5. Redirects user back to Settings page with success/error
 */

import express, { Request, Response } from "express";
import { getGHLService } from "../../services/ghl.service";

const router = express.Router();

/**
 * GET /api/ghl/oauth/callback
 *
 * Handles the OAuth redirect from GoHighLevel.
 * Query params: code, state, error, error_description
 */
router.get("/callback", async (req: Request, res: Response) => {
  const { code, state, error, error_description } = req.query;

  console.log("[GHL OAuth] Callback received", {
    hasCode: !!code,
    hasState: !!state,
    hasError: !!error,
    timestamp: new Date().toISOString(),
  });

  // Handle OAuth errors from GHL
  if (error) {
    console.error("[GHL OAuth] Authorization error:", {
      error,
      description: error_description,
    });
    const errorMsg = encodeURIComponent(
      (error_description as string) || (error as string) || "Authorization failed"
    );
    res.redirect(`/settings?tab=integrations&ghl=error&message=${errorMsg}`);
    return;
  }

  // Validate required parameters
  if (!code || typeof code !== "string") {
    console.error("[GHL OAuth] Missing authorization code");
    res.redirect(
      "/settings?tab=integrations&ghl=error&message=Missing+authorization+code"
    );
    return;
  }

  if (!state || typeof state !== "string") {
    console.error("[GHL OAuth] Missing state parameter");
    res.redirect(
      "/settings?tab=integrations&ghl=error&message=Missing+state+parameter"
    );
    return;
  }

  try {
    const service = getGHLService();
    const result = await service.handleCallback(code, state);

    if (result.success) {
      console.log("[GHL OAuth] Successfully connected", {
        locationId: result.locationId,
        locationName: result.locationName,
      });
      const params = new URLSearchParams({
        tab: "integrations",
        ghl: "success",
      });
      if (result.locationId) {
        params.set("locationId", result.locationId);
      }
      res.redirect(`/settings?${params.toString()}`);
    } else {
      console.error("[GHL OAuth] Callback failed:", result.error);
      const errorMsg = encodeURIComponent(result.error || "Connection failed");
      res.redirect(
        `/settings?tab=integrations&ghl=error&message=${errorMsg}`
      );
    }
  } catch (error) {
    console.error("[GHL OAuth] Unexpected error:", error);
    res.redirect(
      "/settings?tab=integrations&ghl=error&message=Internal+server+error"
    );
  }
});

export { router as ghlOAuthRouter };
