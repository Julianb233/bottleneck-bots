/**
 * GHL Email Marketing Automation Functions
 * Module 4: Email campaign creation, template management, and A/B testing
 */

import { Stagehand } from "@browserbasehq/stagehand";
import { z } from "zod";
import type {
  GHLAutomationContext,
  GHLAutomationResult,
  EmailCampaignCreateInput,
  EmailTemplateCreateInput,
  EmailAbTestInput,
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
 * Create and configure an email campaign in GoHighLevel.
 *
 * Steps:
 * 1. Navigate to /marketing/emails
 * 2. Click Create Campaign
 * 3. Select template or build from scratch
 * 4. Set subject, from name, reply-to
 * 5. Customize content in email editor (iframe)
 * 6. Select recipients by tags or smart list
 * 7. Schedule or send immediately
 */
export async function emailCampaignCreate(
  stagehand: Stagehand,
  ctx: GHLAutomationContext,
  input: EmailCampaignCreateInput
): Promise<GHLAutomationResult> {
  return executeFunction("email_campaign_create", async () => {
    const page = getPage(stagehand);

    // Step 1: Navigate to email marketing
    console.log("[GHL Email] Navigating to email marketing...");
    await navigateTo(stagehand, ctx, "/marketing/emails", {
      waitForSelector: '[data-testid="create-campaign"], button',
    });

    // Step 2: Click Create Campaign
    console.log("[GHL Email] Creating new campaign...");
    const created = await safeAct(
      stagehand,
      'Click the "Create Campaign" or "New Campaign" button'
    );
    if (!created) {
      throw new Error("Could not find Create Campaign button");
    }
    await delay(2000);

    // Step 3: Set campaign name
    console.log(`[GHL Email] Setting campaign name: ${input.name}`);
    await safeAct(
      stagehand,
      `Type "${input.name}" into the campaign name field`
    );
    await delay(500);

    // Step 4: Select template or build from scratch
    if (input.templateId) {
      console.log(`[GHL Email] Selecting template: ${input.templateId}`);
      await safeAct(
        stagehand,
        `Select the email template with ID or name "${input.templateId}"`
      );
    } else {
      console.log("[GHL Email] Building from scratch...");
      await safeAct(
        stagehand,
        'Click "Build from Scratch" or "Blank Template" or "Start from Scratch"'
      );
    }
    await delay(2000);

    // Step 5: Set subject line
    console.log(`[GHL Email] Setting subject: ${input.subject}`);
    await fillField(
      stagehand,
      'input[name="subject"], input[placeholder*="subject" i]',
      input.subject,
      `Type "${input.subject}" into the subject line field`
    );
    await delay(500);

    // Set preview text if provided
    if (input.previewText) {
      console.log(`[GHL Email] Setting preview text: ${input.previewText}`);
      await fillField(
        stagehand,
        'input[name="previewText"], input[placeholder*="preview" i]',
        input.previewText,
        `Type "${input.previewText}" into the preview text field`
      );
      await delay(500);
    }

    // Step 6: Set from name
    console.log(`[GHL Email] Setting from name: ${input.fromName}`);
    await fillField(
      stagehand,
      'input[name="fromName"], input[placeholder*="from" i]',
      input.fromName,
      `Type "${input.fromName}" into the "From Name" field`
    );
    await delay(500);

    // Set from email if provided
    if (input.fromEmail) {
      console.log(`[GHL Email] Setting from email: ${input.fromEmail}`);
      await fillField(
        stagehand,
        'input[name="fromEmail"]',
        input.fromEmail,
        `Type "${input.fromEmail}" into the "From Email" field`
      );
      await delay(500);
    }

    // Set reply-to if provided
    if (input.replyTo) {
      console.log(`[GHL Email] Setting reply-to: ${input.replyTo}`);
      await fillField(
        stagehand,
        'input[name="replyTo"], input[placeholder*="reply" i]',
        input.replyTo,
        `Type "${input.replyTo}" into the "Reply To" field`
      );
      await delay(500);
    }

    // Step 7: Customize content in email editor if HTML provided
    if (input.htmlContent) {
      console.log("[GHL Email] Customizing email content...");
      // GHL email editor often uses an iframe; try to interact with it
      try {
        const editorFrame = page.frameLocator("iframe").first();
        await editorFrame
          .locator("body, .editable, [contenteditable]")
          .first()
          .fill(input.htmlContent);
      } catch {
        // Fallback to Stagehand action if iframe approach fails
        await safeAct(
          stagehand,
          "Click on the email body content area to start editing"
        );
        await delay(500);
        await safeAct(
          stagehand,
          `Replace the email body content with: ${input.htmlContent.substring(0, 200)}`
        );
      }
      await delay(1000);
    }

    // Step 8: Select recipients
    console.log("[GHL Email] Configuring recipients...");
    await safeAct(stagehand, 'Click on the "Recipients" or "Send To" section');
    await delay(1500);

    if (input.recipientSmartList) {
      console.log(`[GHL Email] Selecting smart list: ${input.recipientSmartList}`);
      await safeAct(
        stagehand,
        `Select the smart list named "${input.recipientSmartList}" from the recipient options`
      );
      await delay(1000);
    }

    if (input.recipientTags && input.recipientTags.length > 0) {
      console.log(`[GHL Email] Adding recipient tags: ${input.recipientTags.join(", ")}`);
      for (const tag of input.recipientTags) {
        await safeAct(
          stagehand,
          `Add the tag "${tag}" to the recipient filter or selection`
        );
        await delay(500);
      }
    }

    // Step 9: Schedule or send
    if (input.scheduleAt) {
      console.log(`[GHL Email] Scheduling campaign for: ${input.scheduleAt}`);
      await safeAct(stagehand, 'Click on "Schedule" or "Schedule Send"');
      await delay(1000);
      await safeAct(
        stagehand,
        `Set the scheduled date and time to ${input.scheduleAt}`
      );
      await delay(500);
      await safeAct(stagehand, 'Click "Confirm Schedule" or "Schedule Campaign"');
    } else {
      console.log("[GHL Email] Sending campaign immediately...");
      await safeAct(
        stagehand,
        'Click "Send Now" or "Send Campaign" or "Launch"'
      );
    }
    await delay(2000);

    // Confirm any confirmation dialog
    await safeAct(stagehand, 'Click "Confirm" or "Yes" if a confirmation dialog appears', 0);
    await delay(1000);

    console.log(`[GHL Email] Campaign "${input.name}" created successfully`);
    return {
      campaignName: input.name,
      subject: input.subject,
      scheduled: !!input.scheduleAt,
      scheduleAt: input.scheduleAt || null,
    };
  });
}

/**
 * Create a reusable email template in GoHighLevel.
 *
 * Steps:
 * 1. Navigate to email templates
 * 2. Create a new template
 * 3. Set name and subject
 * 4. Customize content
 * 5. Save the template
 */
export async function emailTemplateCreate(
  stagehand: Stagehand,
  ctx: GHLAutomationContext,
  input: EmailTemplateCreateInput
): Promise<GHLAutomationResult> {
  return executeFunction("email_template_create", async () => {
    const page = getPage(stagehand);

    // Step 1: Navigate to email templates
    console.log("[GHL Email] Navigating to email templates...");
    await navigateTo(stagehand, ctx, "/marketing/emails", {
      waitForSelector: "button",
    });
    await delay(1000);

    // Click on Templates tab or section
    await safeAct(
      stagehand,
      'Click on the "Templates" tab or link in the email marketing section'
    );
    await delay(2000);

    // Step 2: Create new template
    console.log("[GHL Email] Creating new template...");
    const created = await safeAct(
      stagehand,
      'Click "Create Template" or "New Template" or the "+" button for templates'
    );
    if (!created) {
      throw new Error("Could not find Create Template button");
    }
    await delay(2000);

    // Step 3: Set template name
    console.log(`[GHL Email] Setting template name: ${input.name}`);
    await fillField(
      stagehand,
      'input[name="name"], input[placeholder*="name" i], input[placeholder*="template" i]',
      input.name,
      `Type "${input.name}" into the template name field`
    );
    await delay(500);

    // Set subject if provided
    if (input.subject) {
      console.log(`[GHL Email] Setting template subject: ${input.subject}`);
      await fillField(
        stagehand,
        'input[name="subject"], input[placeholder*="subject" i]',
        input.subject,
        `Type "${input.subject}" into the subject line field`
      );
      await delay(500);
    }

    // Set category if provided
    if (input.category) {
      console.log(`[GHL Email] Setting template category: ${input.category}`);
      await safeAct(
        stagehand,
        `Select or type "${input.category}" in the category or folder field`
      );
      await delay(500);
    }

    // Step 4: Customize content if HTML provided
    if (input.htmlContent) {
      console.log("[GHL Email] Customizing template content...");
      try {
        const editorFrame = page.frameLocator("iframe").first();
        await editorFrame
          .locator("body, .editable, [contenteditable]")
          .first()
          .fill(input.htmlContent);
      } catch {
        await safeAct(
          stagehand,
          "Click on the email body content area to start editing"
        );
        await delay(500);
        await safeAct(
          stagehand,
          `Replace the template body content with: ${input.htmlContent.substring(0, 200)}`
        );
      }
      await delay(1000);
    }

    // Step 5: Save the template
    console.log("[GHL Email] Saving template...");
    const saved = await safeAct(
      stagehand,
      'Click the "Save" or "Save Template" button'
    );
    if (!saved) {
      throw new Error("Could not save the email template");
    }
    await delay(2000);

    console.log(`[GHL Email] Template "${input.name}" created successfully`);
    return {
      templateName: input.name,
      subject: input.subject || null,
      category: input.category || null,
    };
  });
}

/**
 * Set up an A/B test for an existing email campaign.
 *
 * Steps:
 * 1. Find the campaign by name
 * 2. Enable A/B testing
 * 3. Set variant B subject and content
 * 4. Configure split percentage
 * 5. Set winner criteria (open rate or click rate)
 */
export async function emailAbTest(
  stagehand: Stagehand,
  ctx: GHLAutomationContext,
  input: EmailAbTestInput
): Promise<GHLAutomationResult> {
  return executeFunction("email_ab_test", async () => {
    const page = getPage(stagehand);

    // Step 1: Navigate to email campaigns and find the target campaign
    console.log(`[GHL Email] Looking for campaign: ${input.campaignName}`);
    await navigateTo(stagehand, ctx, "/marketing/emails", {
      waitForSelector: "table, .campaign-list, [data-testid]",
    });

    // Search or locate the campaign
    await safeAct(
      stagehand,
      `Find and click on the email campaign named "${input.campaignName}"`
    );
    await delay(2000);

    // Step 2: Enable A/B testing
    console.log("[GHL Email] Enabling A/B testing...");
    const abEnabled = await safeAct(
      stagehand,
      'Enable A/B testing by clicking the "A/B Test" toggle, button, or option'
    );
    if (!abEnabled) {
      // Try alternate approach - look for settings/options menu
      await safeAct(
        stagehand,
        'Click on campaign settings, options menu, or three-dot menu'
      );
      await delay(1000);
      await safeAct(
        stagehand,
        'Click on "A/B Test" or "Split Test" option'
      );
    }
    await delay(2000);

    // Step 3: Set variant B subject line
    console.log(`[GHL Email] Setting variant B subject: ${input.variantBSubject}`);
    await fillField(
      stagehand,
      'input[name="variantBSubject"], input[placeholder*="variant" i], input[placeholder*="subject b" i]',
      input.variantBSubject,
      `Type "${input.variantBSubject}" into the Variant B subject line field`
    );
    await delay(500);

    // Set variant B content if provided
    if (input.variantBContent) {
      console.log("[GHL Email] Setting variant B content...");
      await safeAct(
        stagehand,
        'Click on the Variant B content area or "Edit Variant B" button'
      );
      await delay(1500);

      try {
        const editorFrame = page.frameLocator("iframe").first();
        await editorFrame
          .locator("body, .editable, [contenteditable]")
          .first()
          .fill(input.variantBContent);
      } catch {
        await safeAct(
          stagehand,
          `Replace the Variant B body content with: ${input.variantBContent.substring(0, 200)}`
        );
      }
      await delay(1000);
    }

    // Step 4: Configure split percentage
    console.log(`[GHL Email] Setting split percentage: ${input.splitPercentage}%`);
    await fillField(
      stagehand,
      'input[name="splitPercentage"], input[type="number"][placeholder*="split" i], input[type="range"]',
      String(input.splitPercentage),
      `Set the A/B split percentage to ${input.splitPercentage}%`
    );
    await delay(500);

    // Step 5: Set winner criteria
    const criteriaLabel = input.winnerCriteria === "open_rate" ? "Open Rate" : "Click Rate";
    console.log(`[GHL Email] Setting winner criteria: ${criteriaLabel}`);
    await safeAct(
      stagehand,
      `Select "${criteriaLabel}" as the winner criteria for the A/B test`
    );
    await delay(500);

    // Save the A/B test configuration
    console.log("[GHL Email] Saving A/B test configuration...");
    await safeAct(
      stagehand,
      'Click "Save" or "Apply" or "Confirm" to save the A/B test settings'
    );
    await delay(2000);

    console.log(`[GHL Email] A/B test configured for campaign "${input.campaignName}"`);
    return {
      campaignName: input.campaignName,
      variantBSubject: input.variantBSubject,
      splitPercentage: input.splitPercentage,
      winnerCriteria: input.winnerCriteria,
    };
  });
}
