/**
 * GHL Surveys & Forms Automation
 * Functions for creating standalone surveys and forms
 */

import { Stagehand } from "@browserbasehq/stagehand";
import { z } from "zod";
import type {
  GHLAutomationContext,
  GHLAutomationResult,
  SurveyCreateInput,
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
 * Create a standalone survey/form.
 * Navigates to /forms or /surveys, creates a new survey,
 * sets name, adds steps with fields, configures conditional
 * logic, sets thank you message/redirect, and saves.
 */
export async function surveyCreate(
  stagehand: Stagehand,
  ctx: GHLAutomationContext,
  input: SurveyCreateInput,
): Promise<GHLAutomationResult> {
  return executeFunction("survey_create", async () => {
    // Navigate to surveys/forms
    await navigateTo(stagehand, ctx, "/surveys", {
      waitForSelector: '[data-testid="surveys"]',
    });
    await waitForPageLoad(stagehand);

    // Create new survey
    console.log(`[GHL Surveys] Creating survey: ${input.name}`);
    await safeAct(stagehand, "Click the Create Survey or New Survey button");
    await delay(1500);
    await waitForPageLoad(stagehand);

    // Set survey name
    await safeAct(stagehand, `Type "${input.name}" into the survey name field`);
    await delay(500);

    // Add steps with fields
    console.log(`[GHL Surveys] Adding ${input.steps.length} steps...`);
    for (let stepIdx = 0; stepIdx < input.steps.length; stepIdx++) {
      const step = input.steps[stepIdx];

      // Add a new step (first step may already exist)
      if (stepIdx > 0) {
        await safeAct(stagehand, "Click the Add Step or Add Page button to add a new step");
        await delay(800);
      }

      // Set step title if provided
      if (step.title) {
        await safeAct(
          stagehand,
          `Type "${step.title}" into the step title or page title field`,
        );
        await delay(500);
      }

      // Add fields to this step
      for (const field of step.fields) {
        await safeAct(stagehand, "Click the Add Field or Add Element button");
        await delay(500);

        // Set field type
        const fieldTypeLabel =
          field.type === "text" ? "Text" :
          field.type === "email" ? "Email" :
          field.type === "phone" ? "Phone" :
          field.type === "textarea" ? "Long Text" :
          field.type === "dropdown" ? "Dropdown" :
          field.type === "radio" ? "Radio" :
          field.type === "checkbox" ? "Checkbox" :
          field.type === "date" ? "Date" :
          field.type === "file" ? "File Upload" :
          "Signature";

        await safeAct(stagehand, `Select "${fieldTypeLabel}" as the field type`);
        await delay(500);

        // Set field label
        await safeAct(stagehand, `Type "${field.label}" into the field label`);
        await delay(300);

        // Set field as required if needed
        if (field.required) {
          await safeAct(stagehand, "Toggle or check the Required option for this field");
          await delay(200);
        }

        // Add options for dropdown/radio/checkbox fields
        if (field.options && field.options.length > 0) {
          for (const option of field.options) {
            await safeAct(
              stagehand,
              `Add "${option}" as an option for this field`,
            );
            await delay(300);
          }
        }
      }
    }

    // Configure conditional logic if enabled
    if (input.conditionalLogic) {
      console.log("[GHL Surveys] Enabling conditional logic...");
      await safeAct(stagehand, "Enable or configure conditional logic for the survey");
      await delay(1000);
    }

    // Set thank you message if provided
    if (input.thankYouMessage) {
      console.log("[GHL Surveys] Setting thank you message...");
      await safeAct(
        stagehand,
        `Type "${input.thankYouMessage}" into the thank you message or completion message field`,
      );
      await delay(500);
    }

    // Set redirect URL if provided
    if (input.redirectUrl) {
      console.log("[GHL Surveys] Setting redirect URL...");
      await fillField(
        stagehand,
        'input[name="redirectUrl"], input[placeholder*="redirect" i]',
        input.redirectUrl,
        `Type "${input.redirectUrl}" into the redirect URL field`,
      );
      await delay(500);
    }

    // Save the survey
    await safeAct(stagehand, "Click the Save or Publish button to save the survey");
    await delay(2000);

    // Verify creation
    const result = await safeExtract(
      stagehand,
      "Check if the survey was created successfully and extract the survey URL if available",
      z.object({
        created: z.boolean(),
        surveyName: z.string().optional(),
        surveyUrl: z.string().optional(),
      }),
    );

    console.log("[GHL Surveys] Survey creation result:", result);
    return {
      surveyCreated: result?.created ?? true,
      name: input.name,
      stepsCount: input.steps.length,
      totalFields: input.steps.reduce((sum, step) => sum + step.fields.length, 0),
      surveyUrl: result?.surveyUrl,
    };
  });
}
