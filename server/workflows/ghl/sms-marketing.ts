/**
 * GHL SMS Marketing Automation Functions
 * Module 5: SMS campaign creation and template management
 */

import { Stagehand } from "@browserbasehq/stagehand";
import { z } from "zod";
import type {
  GHLAutomationContext,
  GHLAutomationResult,
  SmsCampaignCreateInput,
  SmsTemplateCreateInput,
} from "./types";
import {
  executeFunction,
  navigateTo,
  safeAct,
  delay,
  getPage,
  fillField,
} from "./helpers";

/**
 * Create and send an SMS campaign in GoHighLevel.
 *
 * Steps:
 * 1. Navigate to /marketing/sms
 * 2. Click Create Campaign
 * 3. Set campaign name and message (handle 160 char recommendation)
 * 4. Select sender phone number
 * 5. Select recipients by tags or smart list
 * 6. Add opt-out message if enabled
 * 7. Schedule or send immediately
 */
export async function smsCampaignCreate(
  stagehand: Stagehand,
  ctx: GHLAutomationContext,
  input: SmsCampaignCreateInput
): Promise<GHLAutomationResult> {
  return executeFunction("sms_campaign_create", async () => {
    const page = getPage(stagehand);

    // Step 1: Navigate to SMS marketing
    console.log("[GHL SMS] Navigating to SMS marketing...");
    await navigateTo(stagehand, ctx, "/marketing/sms", {
      waitForSelector: '[data-testid="create-campaign"], button',
    });

    // Step 2: Click Create Campaign
    console.log("[GHL SMS] Creating new SMS campaign...");
    const created = await safeAct(
      stagehand,
      'Click the "Create Campaign" or "New Campaign" button'
    );
    if (!created) {
      throw new Error("Could not find Create Campaign button");
    }
    await delay(2000);

    // Step 3: Set campaign name
    console.log(`[GHL SMS] Setting campaign name: ${input.name}`);
    await fillField(
      stagehand,
      'input[name="name"], input[placeholder*="campaign name" i], input[placeholder*="name" i]',
      input.name,
      `Type "${input.name}" into the campaign name field`
    );
    await delay(500);

    // Step 4: Set message content
    // Warn if message exceeds standard SMS segment length
    if (input.message.length > 160) {
      console.log(
        `[GHL SMS] Warning: Message is ${input.message.length} chars (exceeds 160 char single-segment recommendation). ` +
        `This will be sent as ${Math.ceil(input.message.length / 153)} segments.`
      );
    }
    console.log("[GHL SMS] Setting message content...");
    await fillField(
      stagehand,
      'textarea[name="message"], textarea[placeholder*="message" i], textarea[placeholder*="sms" i]',
      input.message,
      `Type the SMS message into the message body field: "${input.message.substring(0, 100)}${input.message.length > 100 ? "..." : ""}"`
    );
    await delay(500);

    // Step 5: Select sender phone number if provided
    if (input.senderPhone) {
      console.log(`[GHL SMS] Selecting sender phone: ${input.senderPhone}`);
      await safeAct(
        stagehand,
        'Click on the "From Number" or "Sender Phone" dropdown'
      );
      await delay(1000);
      await safeAct(
        stagehand,
        `Select the phone number "${input.senderPhone}" from the sender dropdown list`
      );
      await delay(500);
    }

    // Step 6: Select recipients
    console.log("[GHL SMS] Configuring recipients...");
    await safeAct(
      stagehand,
      'Click on the "Recipients" or "Send To" section'
    );
    await delay(1500);

    if (input.recipientSmartList) {
      console.log(`[GHL SMS] Selecting smart list: ${input.recipientSmartList}`);
      await safeAct(
        stagehand,
        `Select the smart list named "${input.recipientSmartList}" from the recipient options`
      );
      await delay(1000);
    }

    if (input.recipientTags && input.recipientTags.length > 0) {
      console.log(`[GHL SMS] Adding recipient tags: ${input.recipientTags.join(", ")}`);
      for (const tag of input.recipientTags) {
        await safeAct(
          stagehand,
          `Add the tag "${tag}" to the recipient filter or selection`
        );
        await delay(500);
      }
    }

    // Step 7: Add opt-out message if enabled
    if (input.includeOptOut) {
      console.log("[GHL SMS] Enabling opt-out message...");
      await safeAct(
        stagehand,
        'Enable the "Include Opt-Out" toggle or checkbox, or add "Reply STOP to unsubscribe" to the message'
      );
      await delay(500);
    }

    // Step 8: Schedule or send
    if (input.scheduleAt) {
      console.log(`[GHL SMS] Scheduling campaign for: ${input.scheduleAt}`);
      await safeAct(stagehand, 'Click on "Schedule" or "Schedule Send"');
      await delay(1000);
      await safeAct(
        stagehand,
        `Set the scheduled date and time to ${input.scheduleAt}`
      );
      await delay(500);
      await safeAct(
        stagehand,
        'Click "Confirm Schedule" or "Schedule Campaign"'
      );
    } else {
      console.log("[GHL SMS] Sending campaign immediately...");
      await safeAct(
        stagehand,
        'Click "Send Now" or "Send Campaign" or "Launch"'
      );
    }
    await delay(2000);

    // Confirm any confirmation dialog
    await safeAct(
      stagehand,
      'Click "Confirm" or "Yes" if a confirmation dialog appears',
      0
    );
    await delay(1000);

    console.log(`[GHL SMS] Campaign "${input.name}" created successfully`);
    return {
      campaignName: input.name,
      messageLength: input.message.length,
      segments: Math.ceil(input.message.length / 153),
      includeOptOut: input.includeOptOut,
      scheduled: !!input.scheduleAt,
      scheduleAt: input.scheduleAt || null,
    };
  });
}

/**
 * Create a reusable SMS template (snippet) in GoHighLevel.
 *
 * Steps:
 * 1. Navigate to templates/snippets area
 * 2. Click Create Snippet
 * 3. Set template name and message content
 * 4. Save the template
 */
export async function smsTemplateCreate(
  stagehand: Stagehand,
  ctx: GHLAutomationContext,
  input: SmsTemplateCreateInput
): Promise<GHLAutomationResult> {
  return executeFunction("sms_template_create", async () => {
    const page = getPage(stagehand);

    // Step 1: Navigate to marketing SMS area, then templates/snippets
    console.log("[GHL SMS] Navigating to SMS templates...");
    await navigateTo(stagehand, ctx, "/marketing/sms", {
      waitForSelector: "button",
    });
    await delay(1000);

    // Click on Templates or Snippets tab
    const navToTemplates = await safeAct(
      stagehand,
      'Click on the "Templates" or "Snippets" tab or link in the SMS section'
    );
    if (!navToTemplates) {
      // Alternative: try navigating to a general templates/snippets page
      console.log("[GHL SMS] Trying alternative navigation to snippets...");
      await navigateTo(stagehand, ctx, "/settings/snippets", {
        waitForSelector: "button",
      });
    }
    await delay(2000);

    // Step 2: Create new snippet/template
    console.log("[GHL SMS] Creating new SMS snippet...");
    const created = await safeAct(
      stagehand,
      'Click "Create Snippet" or "New Snippet" or "New Template" or the "+" button'
    );
    if (!created) {
      throw new Error("Could not find Create Snippet button");
    }
    await delay(2000);

    // Step 3: Set template name
    console.log(`[GHL SMS] Setting template name: ${input.name}`);
    await fillField(
      stagehand,
      'input[name="name"], input[placeholder*="name" i], input[placeholder*="snippet" i]',
      input.name,
      `Type "${input.name}" into the snippet name field`
    );
    await delay(500);

    // Step 4: Set message content
    console.log("[GHL SMS] Setting message content...");
    await fillField(
      stagehand,
      'textarea[name="message"], textarea[placeholder*="message" i], textarea[name="content"]',
      input.message,
      `Type the SMS template message into the message body field: "${input.message.substring(0, 100)}${input.message.length > 100 ? "..." : ""}"`
    );
    await delay(500);

    // Step 5: Save the template
    console.log("[GHL SMS] Saving SMS template...");
    const saved = await safeAct(
      stagehand,
      'Click the "Save" or "Save Snippet" or "Save Template" button'
    );
    if (!saved) {
      throw new Error("Could not save the SMS template");
    }
    await delay(2000);

    console.log(`[GHL SMS] Template "${input.name}" created successfully`);
    return {
      templateName: input.name,
      messageLength: input.message.length,
    };
  });
}
