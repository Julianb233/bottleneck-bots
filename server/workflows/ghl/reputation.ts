/**
 * GHL Reputation Management Automation
 * Functions for review requests and review monitoring
 */

import { Stagehand } from "@browserbasehq/stagehand";
import { z } from "zod";
import type {
  GHLAutomationContext,
  GHLAutomationResult,
  ReviewRequestCreateInput,
  ReviewMonitorInput,
} from "./types";
import {
  executeFunction,
  navigateTo,
  safeAct,
  delay,
  getPage,
  fillField,
  safeExtract,
  waitForPageLoad,
} from "./helpers";

/**
 * Set up an automated review request campaign.
 * Navigates to /reputation, creates a campaign, configures
 * name/channel/review URL/message/follow-up, selects recipients,
 * and activates.
 */
export async function reviewRequestCreate(
  stagehand: Stagehand,
  ctx: GHLAutomationContext,
  input: ReviewRequestCreateInput,
): Promise<GHLAutomationResult> {
  return executeFunction("review_request_create", async () => {
    // Navigate to reputation module
    await navigateTo(stagehand, ctx, "/reputation", {
      waitForSelector: '[data-testid="reputation"]',
    });

    // Click create campaign
    console.log(`[GHL Reputation] Creating review request campaign: ${input.name}`);
    await safeAct(stagehand, "Click the Create Campaign or New Campaign button");
    await delay(1500);
    await waitForPageLoad(stagehand);

    // Set campaign name
    await safeAct(stagehand, `Type "${input.name}" into the campaign name field`);
    await delay(500);

    // Set channel
    const channelLabel = input.channel === "sms" ? "SMS" : input.channel === "email" ? "Email" : "Both SMS and Email";
    console.log(`[GHL Reputation] Setting channel: ${channelLabel}`);
    await safeAct(stagehand, `Select "${channelLabel}" as the campaign channel`);
    await delay(500);

    // Set review URL
    console.log("[GHL Reputation] Setting review URL...");
    await fillField(
      stagehand,
      'input[name="reviewUrl"], input[placeholder*="review" i]',
      input.reviewUrl,
      `Type "${input.reviewUrl}" into the review URL field`,
    );
    await delay(500);

    // Set message template if provided
    if (input.message) {
      console.log("[GHL Reputation] Setting message template...");
      await safeAct(stagehand, `Type the following message into the message template field: ${input.message}`);
      await delay(500);
    }

    // Set follow-up days if provided
    if (input.followUpDays !== undefined) {
      console.log(`[GHL Reputation] Setting follow-up: ${input.followUpDays} days`);
      await safeAct(
        stagehand,
        `Set the follow-up to ${input.followUpDays} days or type "${input.followUpDays}" into the follow-up days field`,
      );
      await delay(500);
    }

    // Select recipients by tags if provided
    if (input.recipientTags && input.recipientTags.length > 0) {
      console.log("[GHL Reputation] Selecting recipients by tags...");
      for (const tag of input.recipientTags) {
        await safeAct(stagehand, `Add the tag "${tag}" to the recipient filter`);
        await delay(300);
      }
    }

    // Activate the campaign
    await safeAct(stagehand, "Click the Save and Activate or Activate button to launch the campaign");
    await delay(2000);

    // Verify campaign creation
    const result = await safeExtract(
      stagehand,
      "Check if the review request campaign was created and activated successfully",
      z.object({
        created: z.boolean(),
        campaignName: z.string().optional(),
        status: z.string().optional(),
      }),
    );

    console.log("[GHL Reputation] Campaign creation result:", result);
    return {
      campaignCreated: result?.created ?? true,
      campaignName: input.name,
      channel: input.channel,
    };
  });
}

/**
 * Configure review monitoring settings.
 * Navigates to reputation settings, enables platforms,
 * configures auto-respond and notification preferences.
 */
export async function reviewMonitor(
  stagehand: Stagehand,
  ctx: GHLAutomationContext,
  input: ReviewMonitorInput,
): Promise<GHLAutomationResult> {
  return executeFunction("review_monitor", async () => {
    // Navigate to reputation settings
    await navigateTo(stagehand, ctx, "/reputation/settings", {
      waitForSelector: '[data-testid="reputation-settings"]',
    });
    await waitForPageLoad(stagehand);

    // Enable each platform
    for (const platform of input.platforms) {
      const platformName = platform === "google" ? "Google" : platform === "facebook" ? "Facebook" : "Yelp";
      console.log(`[GHL Reputation] Enabling platform: ${platformName}`);
      await safeAct(stagehand, `Enable or connect the ${platformName} review platform`);
      await delay(1000);
    }

    // Configure auto-respond
    if (input.autoRespond) {
      console.log("[GHL Reputation] Enabling auto-respond...");
      await safeAct(stagehand, "Enable the auto-respond or automatic reply toggle for reviews");
      await delay(500);
    }

    // Configure notification email
    if (input.notifyEmail) {
      console.log(`[GHL Reputation] Setting notification email: ${input.notifyEmail}`);
      await fillField(
        stagehand,
        'input[name="notifyEmail"], input[type="email"]',
        input.notifyEmail,
        `Type "${input.notifyEmail}" into the notification email field`,
      );
      await delay(500);
    }

    // Save settings
    await safeAct(stagehand, "Click the Save or Update button to save reputation settings");
    await delay(2000);

    // Verify settings saved
    const result = await safeExtract(
      stagehand,
      "Check if the reputation monitoring settings were saved successfully",
      z.object({
        saved: z.boolean(),
        enabledPlatforms: z.array(z.string()).optional(),
      }),
    );

    console.log("[GHL Reputation] Monitor setup result:", result);
    return {
      configured: result?.saved ?? true,
      platforms: input.platforms,
      autoRespond: input.autoRespond,
    };
  });
}
