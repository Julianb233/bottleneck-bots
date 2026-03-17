/**
 * GHL Social Planner Automation
 * Functions for creating and scheduling social media posts
 */

import { Stagehand } from "@browserbasehq/stagehand";
import { z } from "zod";
import type {
  GHLAutomationContext,
  GHLAutomationResult,
  SocialPostCreateInput,
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
 * Create and schedule a social media post.
 * Navigates to /social-planner, creates a new post, selects
 * platforms, writes content, adds media/hashtags, and either
 * schedules or posts immediately.
 */
export async function socialPostCreate(
  stagehand: Stagehand,
  ctx: GHLAutomationContext,
  input: SocialPostCreateInput,
): Promise<GHLAutomationResult> {
  return executeFunction("social_post_create", async () => {
    // Navigate to social planner
    await navigateTo(stagehand, ctx, "/social-planner", {
      waitForSelector: '[data-testid="social-planner"]',
    });

    // Create a new post
    console.log("[GHL Social] Creating new post...");
    await safeAct(stagehand, "Click the Create Post or New Post button");
    await delay(1500);
    await waitForPageLoad(stagehand);

    // Select platforms
    for (const platform of input.platforms) {
      const platformName =
        platform === "facebook" ? "Facebook" :
        platform === "instagram" ? "Instagram" :
        platform === "twitter" ? "Twitter" :
        platform === "linkedin" ? "LinkedIn" :
        "Google Business";
      console.log(`[GHL Social] Selecting platform: ${platformName}`);
      await safeAct(stagehand, `Select or check the ${platformName} platform for this post`);
      await delay(500);
    }

    // Write the post content
    console.log("[GHL Social] Writing post content...");
    await safeAct(
      stagehand,
      `Type the following content into the post content area: ${input.content}`,
    );
    await delay(500);

    // Add media URLs if provided
    if (input.mediaUrls && input.mediaUrls.length > 0) {
      console.log("[GHL Social] Adding media...");
      for (const mediaUrl of input.mediaUrls) {
        await safeAct(
          stagehand,
          `Click the Add Media or Upload button and add the media URL: ${mediaUrl}`,
        );
        await delay(1000);
      }
    }

    // Add hashtags if provided
    if (input.hashtags && input.hashtags.length > 0) {
      const hashtagText = input.hashtags.map(h => (h.startsWith("#") ? h : `#${h}`)).join(" ");
      console.log(`[GHL Social] Adding hashtags: ${hashtagText}`);
      await safeAct(
        stagehand,
        `Add the following hashtags to the post content: ${hashtagText}`,
      );
      await delay(500);
    }

    // Schedule or post immediately
    if (input.scheduleAt) {
      console.log(`[GHL Social] Scheduling post for: ${input.scheduleAt}`);
      await safeAct(stagehand, "Click the Schedule button or option instead of Post Now");
      await delay(1000);
      await safeAct(
        stagehand,
        `Set the schedule date and time to ${input.scheduleAt}`,
      );
      await delay(500);
      await safeAct(stagehand, "Click the Confirm Schedule or Schedule Post button");
      await delay(2000);
    } else {
      console.log("[GHL Social] Posting immediately...");
      await safeAct(stagehand, "Click the Post Now or Publish button");
      await delay(2000);
    }

    // Verify the post was created
    const result = await safeExtract(
      stagehand,
      "Check if the social media post was created or scheduled successfully",
      z.object({
        created: z.boolean(),
        status: z.string().optional(),
        scheduledTime: z.string().optional(),
      }),
    );

    console.log("[GHL Social] Post creation result:", result);
    return {
      postCreated: result?.created ?? true,
      platforms: input.platforms,
      scheduled: !!input.scheduleAt,
      scheduleAt: input.scheduleAt,
    };
  });
}
