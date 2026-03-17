/**
 * GHL Opportunities & Pipelines Automation
 * Module 7: Create pipelines, create opportunities, and update opportunity stages
 */

import { Stagehand } from "@browserbasehq/stagehand";
import { z } from "zod";
import type {
  GHLAutomationContext,
  GHLAutomationResult,
  PipelineCreateInput,
  OpportunityCreateInput,
  OpportunityUpdateStageInput,
} from "./types";
import {
  executeFunction,
  navigateTo,
  safeAct,
  delay,
  getPage,
  searchContact,
} from "./helpers";

/**
 * Create a new sales pipeline with named stages.
 *
 * Navigates to Opportunities, opens pipeline settings, creates a new pipeline,
 * names it, adds each stage in order, then saves.
 */
export async function pipelineCreate(
  stagehand: Stagehand,
  ctx: GHLAutomationContext,
  input: PipelineCreateInput
): Promise<GHLAutomationResult> {
  return executeFunction("pipeline_create", async () => {
    console.log(`[GHL pipeline_create] Creating pipeline: ${input.name}`);

    // Navigate to the Opportunities module
    await navigateTo(stagehand, ctx, "/opportunities");
    await delay(1000);

    // Open pipeline settings / create pipeline flow
    // GHL lets you manage pipelines from the pipeline dropdown or settings gear
    const clickedSettings = await safeAct(
      stagehand,
      'Click the pipeline settings gear icon, or click on the pipeline dropdown and select "Create Pipeline" or "Manage Pipelines"'
    );
    if (!clickedSettings) {
      // Fallback: try the settings route directly
      await navigateTo(stagehand, ctx, "/settings/pipelines");
      await delay(1000);
    }
    await delay(1500);

    // Click "Create Pipeline" or "Add Pipeline" button
    await safeAct(
      stagehand,
      'Click the "Create Pipeline", "Add Pipeline", or "New Pipeline" button'
    );
    await delay(1500);

    // Enter the pipeline name
    await safeAct(
      stagehand,
      `Type "${input.name}" into the pipeline name input field`
    );
    await delay(500);

    // Add stages in order
    // GHL typically starts with a default stage; we clear/rename it and add more
    for (let i = 0; i < input.stages.length; i++) {
      const stage = input.stages[i];

      if (i === 0) {
        // Rename the first default stage if one exists, otherwise just type
        const renamed = await safeAct(
          stagehand,
          `Clear the first stage name input and type "${stage.name}"`
        );
        if (!renamed) {
          // If there was no default stage, add one
          await safeAct(
            stagehand,
            'Click "Add Stage" or the "+" button to add a new stage'
          );
          await delay(500);
          await safeAct(
            stagehand,
            `Type "${stage.name}" into the new stage name input field`
          );
        }
      } else {
        // Add subsequent stages
        await safeAct(
          stagehand,
          'Click "Add Stage" or the "+" button to add a new stage'
        );
        await delay(500);
        await safeAct(
          stagehand,
          `Type "${stage.name}" into the last or newest stage name input field`
        );
      }
      await delay(500);
    }

    // Save the pipeline
    await safeAct(stagehand, 'Click the "Save" or "Create" button to save the pipeline');
    await delay(2000);

    // Verify creation by extracting confirmation
    const page = getPage(stagehand);
    const pageContent = await page.content();
    const created = pageContent.includes(input.name);

    console.log(
      `[GHL pipeline_create] Pipeline "${input.name}" ${created ? "created successfully" : "creation could not be confirmed"}`
    );

    return {
      pipelineName: input.name,
      stageCount: input.stages.length,
      stages: input.stages.map((s) => s.name),
      confirmed: created,
    };
  });
}

/**
 * Create a new sales opportunity.
 *
 * Navigates to Opportunities, clicks Add/Create, searches and selects a contact,
 * picks the pipeline and stage, sets name/value/status, assigns a user,
 * adds notes, and saves.
 */
export async function opportunityCreate(
  stagehand: Stagehand,
  ctx: GHLAutomationContext,
  input: OpportunityCreateInput
): Promise<GHLAutomationResult> {
  return executeFunction("opportunity_create", async () => {
    console.log(
      `[GHL opportunity_create] Creating opportunity for contact: ${input.contactSearchTerm}`
    );

    // Navigate to Opportunities
    await navigateTo(stagehand, ctx, "/opportunities");
    await delay(1000);

    // Click Create / Add Opportunity button
    await safeAct(
      stagehand,
      'Click the "Add Opportunity", "Create Opportunity", or "+" button to create a new opportunity'
    );
    await delay(1500);

    // Search and select the contact
    await safeAct(
      stagehand,
      `Type "${input.contactSearchTerm}" into the contact search field in the opportunity form`
    );
    await delay(1500);

    // Select the first matching contact from the dropdown
    await safeAct(
      stagehand,
      "Select the first matching contact from the search results dropdown"
    );
    await delay(1000);

    // Select the pipeline
    await safeAct(
      stagehand,
      `Click the pipeline dropdown and select "${input.pipelineName}"`
    );
    await delay(1000);

    // Select the stage
    await safeAct(
      stagehand,
      `Click the stage dropdown and select "${input.stageName}"`
    );
    await delay(500);

    // Set opportunity name if provided
    if (input.name) {
      await safeAct(
        stagehand,
        `Type "${input.name}" into the opportunity name field`
      );
      await delay(500);
    }

    // Set monetary value if provided
    if (input.value !== undefined) {
      await safeAct(
        stagehand,
        `Type "${input.value}" into the opportunity value or monetary value field`
      );
      await delay(500);
    }

    // Set status if not the default "open"
    if (input.status && input.status !== "open") {
      await safeAct(
        stagehand,
        `Click the status dropdown and select "${input.status}"`
      );
      await delay(500);
    }

    // Assign a user if provided
    if (input.assignedUser) {
      await safeAct(
        stagehand,
        `Click the assigned user or owner dropdown and select "${input.assignedUser}"`
      );
      await delay(500);
    }

    // Add notes if provided
    if (input.notes) {
      await safeAct(
        stagehand,
        `Type "${input.notes}" into the notes or description field`
      );
      await delay(500);
    }

    // Save the opportunity
    await safeAct(
      stagehand,
      'Click the "Save", "Create", or "Add" button to save the opportunity'
    );
    await delay(2000);

    // Verify by checking page content
    const page = getPage(stagehand);
    const pageContent = await page.content();
    const confirmed =
      pageContent.includes(input.contactSearchTerm) ||
      (input.name ? pageContent.includes(input.name) : true);

    console.log(
      `[GHL opportunity_create] Opportunity ${confirmed ? "created successfully" : "creation could not be confirmed"}`
    );

    return {
      contactSearchTerm: input.contactSearchTerm,
      pipelineName: input.pipelineName,
      stageName: input.stageName,
      opportunityName: input.name,
      value: input.value,
      status: input.status,
      assignedUser: input.assignedUser,
      confirmed,
    };
  });
}

/**
 * Move an existing opportunity to a different pipeline stage.
 *
 * Finds the opportunity by contact name or opportunity name, then either
 * uses the edit dialog to change the stage or drags it to the new stage column.
 */
export async function opportunityUpdateStage(
  stagehand: Stagehand,
  ctx: GHLAutomationContext,
  input: OpportunityUpdateStageInput
): Promise<GHLAutomationResult> {
  return executeFunction("opportunity_update_stage", async () => {
    const searchTerm = input.opportunityName || input.contactSearchTerm;
    console.log(
      `[GHL opportunity_update_stage] Moving opportunity "${searchTerm}" to stage "${input.newStageName}"`
    );

    // Navigate to Opportunities
    await navigateTo(stagehand, ctx, "/opportunities");
    await delay(1000);

    // If a specific pipeline is provided, select it first
    if (input.pipelineName) {
      await safeAct(
        stagehand,
        `Click the pipeline dropdown and select "${input.pipelineName}"`
      );
      await delay(1500);
    }

    // Search for the opportunity by contact or opportunity name
    if (searchTerm) {
      await safeAct(
        stagehand,
        `Type "${searchTerm}" into the opportunity search or filter input`
      );
      await delay(1500);
    }

    // Try to open the opportunity card for editing
    const clickedCard = await safeAct(
      stagehand,
      `Click on the opportunity card for "${searchTerm}" to open its details`
    );
    await delay(1500);

    if (clickedCard) {
      // Use the edit form to change the stage
      const changedStage = await safeAct(
        stagehand,
        `Click the stage dropdown or stage selector and change it to "${input.newStageName}"`
      );
      await delay(500);

      if (!changedStage) {
        // Fallback: try clicking an edit button first
        await safeAct(stagehand, 'Click the "Edit" button on the opportunity');
        await delay(1000);
        await safeAct(
          stagehand,
          `Click the stage dropdown and select "${input.newStageName}"`
        );
        await delay(500);
      }

      // Save changes
      await safeAct(
        stagehand,
        'Click the "Save", "Update", or "Done" button to save the stage change'
      );
      await delay(2000);
    } else {
      // Fallback: attempt drag-and-drop via Stagehand act
      console.log(
        "[GHL opportunity_update_stage] Card click failed, attempting drag-and-drop"
      );
      await safeAct(
        stagehand,
        `Drag the opportunity card for "${searchTerm}" and drop it on the "${input.newStageName}" stage column`
      );
      await delay(2000);
    }

    // Verify the stage update
    const page = getPage(stagehand);
    const pageContent = await page.content();
    const confirmed = pageContent.includes(input.newStageName);

    console.log(
      `[GHL opportunity_update_stage] Stage update ${confirmed ? "confirmed" : "could not be confirmed"}`
    );

    return {
      searchTerm,
      pipelineName: input.pipelineName,
      newStageName: input.newStageName,
      confirmed,
    };
  });
}
