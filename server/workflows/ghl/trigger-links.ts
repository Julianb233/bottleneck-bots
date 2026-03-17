/**
 * GHL Trigger Links Automation
 * Functions for creating trigger links with automated actions
 */

import { Stagehand } from "@browserbasehq/stagehand";
import { z } from "zod";
import type {
  GHLAutomationContext,
  GHLAutomationResult,
  TriggerLinkCreateInput,
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
 * Create a trigger link.
 * Navigates to /trigger-links, creates a new trigger link,
 * sets name/redirect URL, adds actions (add tag, remove tag,
 * start workflow, etc.), and saves.
 */
export async function triggerLinkCreate(
  stagehand: Stagehand,
  ctx: GHLAutomationContext,
  input: TriggerLinkCreateInput,
): Promise<GHLAutomationResult> {
  return executeFunction("trigger_link_create", async () => {
    // Navigate to trigger links
    await navigateTo(stagehand, ctx, "/trigger-links", {
      waitForSelector: '[data-testid="trigger-links"]',
    });
    await waitForPageLoad(stagehand);

    // Create new trigger link
    console.log(`[GHL Trigger Links] Creating trigger link: ${input.name}`);
    await safeAct(stagehand, "Click the Create Trigger Link or New Trigger Link button");
    await delay(1500);
    await waitForPageLoad(stagehand);

    // Set name
    await safeAct(stagehand, `Type "${input.name}" into the trigger link name field`);
    await delay(500);

    // Set redirect URL
    console.log(`[GHL Trigger Links] Setting redirect URL: ${input.redirectUrl}`);
    await fillField(
      stagehand,
      'input[name="redirectUrl"], input[placeholder*="redirect" i], input[placeholder*="URL" i]',
      input.redirectUrl,
      `Type "${input.redirectUrl}" into the redirect URL field`,
    );
    await delay(500);

    // Add actions
    console.log(`[GHL Trigger Links] Adding ${input.actions.length} actions...`);
    for (const action of input.actions) {
      const actionLabel =
        action.type === "add_tag" ? "Add Tag" :
        action.type === "remove_tag" ? "Remove Tag" :
        action.type === "start_workflow" ? "Start Workflow" :
        action.type === "update_field" ? "Update Field" :
        action.type === "add_campaign" ? "Add to Campaign" :
        action.type === "remove_campaign" ? "Remove from Campaign" :
        "Update Opportunity";

      await safeAct(stagehand, "Click the Add Action button");
      await delay(500);
      await safeAct(stagehand, `Select "${actionLabel}" as the action type`);
      await delay(500);
      await safeAct(
        stagehand,
        `Set the action value to "${action.value}" or select "${action.value}" from the options`,
      );
      await delay(500);
    }

    // Save the trigger link
    await safeAct(stagehand, "Click the Save or Create button to save the trigger link");
    await delay(2000);

    // Verify creation and get the link URL
    const result = await safeExtract(
      stagehand,
      "Check if the trigger link was created successfully and extract the generated link URL",
      z.object({
        created: z.boolean(),
        linkName: z.string().optional(),
        linkUrl: z.string().optional(),
      }),
    );

    console.log("[GHL Trigger Links] Creation result:", result);
    return {
      triggerLinkCreated: result?.created ?? true,
      name: input.name,
      redirectUrl: input.redirectUrl,
      actionsCount: input.actions.length,
      generatedUrl: result?.linkUrl,
    };
  });
}
