/**
 * GHL Workflows & Automation Functions
 * Module 2: Create, edit, duplicate, delete, and test GoHighLevel workflows
 */

import { Stagehand } from "@browserbasehq/stagehand";
import type {
  GHLAutomationContext,
  GHLAutomationResult,
  WorkflowCreateInput,
  WorkflowEditInput,
  WorkflowDuplicateInput,
  WorkflowDeleteInput,
  WorkflowTestInput,
} from "./types";
import {
  executeFunction,
  navigateTo,
  safeAct,
  delay,
  getPage,
  confirmDialog,
} from "./helpers";

// ========================================
// WORKFLOW CREATE
// ========================================

/**
 * Create a new automated workflow in GoHighLevel.
 * Navigates to /workflows, creates a new workflow, sets the name and trigger,
 * adds optional actions, and optionally activates it.
 */
export async function workflowCreate(
  stagehand: Stagehand,
  ctx: GHLAutomationContext,
  input: WorkflowCreateInput
): Promise<GHLAutomationResult> {
  return executeFunction("workflow_create", async () => {
    // Navigate to the workflows page
    await navigateTo(stagehand, ctx, "/workflows", {
      waitForSelector: '[class*="workflow"]',
    });

    // Click Create Workflow button
    console.log("[GHL Workflow] Clicking Create Workflow...");
    const clickedCreate = await safeAct(
      stagehand,
      'Click the "Create Workflow" or "New Workflow" button'
    );
    if (!clickedCreate) {
      throw new Error("Could not find Create Workflow button");
    }
    await delay(2000);

    // Select "Start from Scratch" or a blank template to begin
    await safeAct(
      stagehand,
      'Select "Start from Scratch" or "Blank Workflow" option if a template selection modal appears'
    );
    await delay(1500);

    // Name the workflow
    console.log(`[GHL Workflow] Naming workflow: ${input.name}`);
    await safeAct(
      stagehand,
      `Click on the workflow name or title field and replace it with "${input.name}"`
    );
    await delay(1000);

    // Add the trigger
    console.log(`[GHL Workflow] Setting trigger type: ${input.triggerType}`);
    await safeAct(
      stagehand,
      'Click on "Add New Trigger" or the trigger placeholder in the workflow builder'
    );
    await delay(1500);

    await safeAct(
      stagehand,
      `Search for and select the "${input.triggerType}" trigger type`
    );
    await delay(1500);

    // Configure trigger options if provided
    if (input.triggerConfig) {
      for (const [key, value] of Object.entries(input.triggerConfig)) {
        console.log(`[GHL Workflow] Setting trigger config: ${key} = ${value}`);
        await safeAct(
          stagehand,
          `Set the "${key}" field to "${value}" in the trigger configuration panel`
        );
        await delay(500);
      }
    }

    // Save the trigger configuration
    await safeAct(stagehand, 'Click "Save Trigger" or close the trigger configuration panel');
    await delay(1000);

    // Add actions if provided
    if (input.actions && input.actions.length > 0) {
      for (const action of input.actions) {
        console.log(`[GHL Workflow] Adding action: ${action.type}`);
        await safeAct(stagehand, 'Click the "+" button or "Add Action" to add a new workflow action');
        await delay(1500);

        await safeAct(
          stagehand,
          `Search for and select the "${action.type}" action type`
        );
        await delay(1500);

        // Configure action options if provided
        if (action.config) {
          for (const [key, value] of Object.entries(action.config)) {
            console.log(`[GHL Workflow] Setting action config: ${key} = ${value}`);
            await safeAct(
              stagehand,
              `Set the "${key}" field to "${value}" in the action configuration panel`
            );
            await delay(500);
          }
        }

        // Save the action
        await safeAct(stagehand, 'Click "Save Action" or close the action configuration panel');
        await delay(1000);
      }
    }

    // Save the workflow
    console.log("[GHL Workflow] Saving workflow...");
    await safeAct(stagehand, 'Click the "Save" button to save the workflow');
    await delay(2000);

    // Activate if requested
    if (input.activate) {
      console.log("[GHL Workflow] Activating workflow...");
      const activated = await safeAct(
        stagehand,
        'Toggle the workflow status to "Published" or "Active", or click the publish/activate switch'
      );
      if (activated) {
        await delay(1500);
        // Confirm activation if a dialog appears
        await safeAct(stagehand, 'Click "Publish" or "Yes" if a confirmation dialog appears');
        await delay(1000);
      }
    }

    // Extract confirmation details
    const page = getPage(stagehand);
    const currentUrl = page.url();

    return {
      workflowName: input.name,
      triggerType: input.triggerType,
      actionsAdded: input.actions?.length ?? 0,
      activated: input.activate ?? false,
      url: currentUrl,
    };
  });
}

// ========================================
// WORKFLOW EDIT
// ========================================

/**
 * Edit an existing workflow in GoHighLevel.
 * Finds the workflow by name, opens it for editing, and applies updates
 * such as renaming, adding/removing actions, or activating/deactivating.
 */
export async function workflowEdit(
  stagehand: Stagehand,
  ctx: GHLAutomationContext,
  input: WorkflowEditInput
): Promise<GHLAutomationResult> {
  return executeFunction("workflow_edit", async () => {
    // Navigate to workflows
    await navigateTo(stagehand, ctx, "/workflows", {
      waitForSelector: '[class*="workflow"]',
    });

    // Search for the workflow by name
    console.log(`[GHL Workflow] Searching for workflow: ${input.workflowName}`);
    await safeAct(
      stagehand,
      `Type "${input.workflowName}" into the search or filter input on the workflows page`
    );
    await delay(2000);

    // Click on the workflow to open it for editing
    const opened = await safeAct(
      stagehand,
      `Click on the workflow named "${input.workflowName}" to open it`
    );
    if (!opened) {
      throw new Error(`Could not find workflow: ${input.workflowName}`);
    }
    await delay(2000);

    const changes: string[] = [];

    // Rename the workflow if requested
    if (input.updates.name) {
      console.log(`[GHL Workflow] Renaming workflow to: ${input.updates.name}`);
      await safeAct(
        stagehand,
        `Click on the workflow name/title and change it to "${input.updates.name}"`
      );
      await delay(1000);
      changes.push(`renamed to "${input.updates.name}"`);
    }

    // Remove actions by index if requested (remove in reverse order to preserve indices)
    if (input.updates.removeActionIndices && input.updates.removeActionIndices.length > 0) {
      const sortedIndices = [...input.updates.removeActionIndices].sort((a, b) => b - a);
      for (const index of sortedIndices) {
        console.log(`[GHL Workflow] Removing action at index: ${index}`);
        await safeAct(
          stagehand,
          `Click on action step number ${index + 1} in the workflow to select it`
        );
        await delay(1000);
        await safeAct(
          stagehand,
          'Click the delete or remove button for the selected action step'
        );
        await delay(1000);
        // Confirm deletion if prompted
        await safeAct(stagehand, 'Click "Yes" or "Delete" to confirm removing the action if prompted');
        await delay(500);
      }
      changes.push(`removed ${sortedIndices.length} action(s)`);
    }

    // Add new actions if requested
    if (input.updates.addActions && input.updates.addActions.length > 0) {
      for (const action of input.updates.addActions) {
        console.log(`[GHL Workflow] Adding action: ${action.type}`);
        await safeAct(stagehand, 'Click the "+" button or "Add Action" to add a new workflow action');
        await delay(1500);

        await safeAct(
          stagehand,
          `Search for and select the "${action.type}" action type`
        );
        await delay(1500);

        // Configure action options if provided
        if (action.config) {
          for (const [key, value] of Object.entries(action.config)) {
            await safeAct(
              stagehand,
              `Set the "${key}" field to "${value}" in the action configuration panel`
            );
            await delay(500);
          }
        }

        await safeAct(stagehand, 'Click "Save Action" or close the action configuration panel');
        await delay(1000);
      }
      changes.push(`added ${input.updates.addActions.length} action(s)`);
    }

    // Activate or deactivate the workflow if requested
    if (input.updates.activate !== undefined) {
      const action = input.updates.activate ? "activate" : "deactivate";
      console.log(`[GHL Workflow] ${action} workflow...`);
      await safeAct(
        stagehand,
        input.updates.activate
          ? 'Toggle the workflow status to "Published" or "Active", or click the publish/activate switch'
          : 'Toggle the workflow status to "Draft" or "Inactive", or click the publish/activate switch to turn it off'
      );
      await delay(1500);
      // Confirm if prompted
      await safeAct(stagehand, 'Click "Yes" or "Confirm" if a confirmation dialog appears');
      await delay(1000);
      changes.push(input.updates.activate ? "activated" : "deactivated");
    }

    // Save changes
    console.log("[GHL Workflow] Saving workflow changes...");
    await safeAct(stagehand, 'Click the "Save" button to save the workflow changes');
    await delay(2000);

    return {
      workflowName: input.updates.name || input.workflowName,
      changes,
    };
  });
}

// ========================================
// WORKFLOW DUPLICATE
// ========================================

/**
 * Duplicate an existing workflow in GoHighLevel.
 * Finds the workflow by name, opens the three-dot context menu,
 * selects Duplicate, and optionally renames the copy.
 */
export async function workflowDuplicate(
  stagehand: Stagehand,
  ctx: GHLAutomationContext,
  input: WorkflowDuplicateInput
): Promise<GHLAutomationResult> {
  return executeFunction("workflow_duplicate", async () => {
    // Navigate to workflows
    await navigateTo(stagehand, ctx, "/workflows", {
      waitForSelector: '[class*="workflow"]',
    });

    // Search for the workflow by name
    console.log(`[GHL Workflow] Searching for workflow to duplicate: ${input.workflowName}`);
    await safeAct(
      stagehand,
      `Type "${input.workflowName}" into the search or filter input on the workflows page`
    );
    await delay(2000);

    // Click the three-dot menu on the workflow
    const menuClicked = await safeAct(
      stagehand,
      `Click the three-dot menu or more options button on the workflow named "${input.workflowName}"`
    );
    if (!menuClicked) {
      throw new Error(`Could not find workflow: ${input.workflowName}`);
    }
    await delay(1000);

    // Select Duplicate from the context menu
    console.log("[GHL Workflow] Selecting Duplicate...");
    const duplicated = await safeAct(
      stagehand,
      'Click "Duplicate" or "Clone" from the dropdown menu'
    );
    if (!duplicated) {
      throw new Error("Could not find Duplicate option in the menu");
    }
    await delay(2000);

    // Rename the duplicated workflow if a new name is provided
    if (input.newName) {
      console.log(`[GHL Workflow] Renaming duplicate to: ${input.newName}`);
      // The duplicate typically opens or a rename prompt appears
      await safeAct(
        stagehand,
        `Click on the duplicated workflow name and change it to "${input.newName}"`
      );
      await delay(1000);

      // Save the rename
      await safeAct(stagehand, 'Click "Save" or press Enter to confirm the new name');
      await delay(1500);
    }

    const finalName = input.newName || `${input.workflowName} (Copy)`;
    console.log(`[GHL Workflow] Workflow duplicated as: ${finalName}`);

    return {
      originalName: input.workflowName,
      duplicatedName: finalName,
    };
  });
}

// ========================================
// WORKFLOW DELETE
// ========================================

/**
 * Delete a workflow from GoHighLevel.
 * Finds the workflow by name, opens the three-dot context menu,
 * selects Delete, and confirms the deletion.
 */
export async function workflowDelete(
  stagehand: Stagehand,
  ctx: GHLAutomationContext,
  input: WorkflowDeleteInput
): Promise<GHLAutomationResult> {
  return executeFunction("workflow_delete", async () => {
    if (!input.confirmDeletion) {
      throw new Error("Deletion not confirmed. Set confirmDeletion to true.");
    }

    // Navigate to workflows
    await navigateTo(stagehand, ctx, "/workflows", {
      waitForSelector: '[class*="workflow"]',
    });

    // Search for the workflow by name
    console.log(`[GHL Workflow] Searching for workflow to delete: ${input.workflowName}`);
    await safeAct(
      stagehand,
      `Type "${input.workflowName}" into the search or filter input on the workflows page`
    );
    await delay(2000);

    // Click the three-dot menu on the workflow
    const menuClicked = await safeAct(
      stagehand,
      `Click the three-dot menu or more options button on the workflow named "${input.workflowName}"`
    );
    if (!menuClicked) {
      throw new Error(`Could not find workflow: ${input.workflowName}`);
    }
    await delay(1000);

    // Select Delete from the context menu
    console.log("[GHL Workflow] Selecting Delete...");
    const deleteClicked = await safeAct(
      stagehand,
      'Click "Delete" from the dropdown menu'
    );
    if (!deleteClicked) {
      throw new Error("Could not find Delete option in the menu");
    }
    await delay(1500);

    // Confirm the deletion dialog
    console.log("[GHL Workflow] Confirming deletion...");
    const confirmed = await confirmDialog(stagehand);
    if (!confirmed) {
      throw new Error("Could not confirm the deletion dialog");
    }
    await delay(2000);

    console.log(`[GHL Workflow] Workflow "${input.workflowName}" deleted`);

    return {
      deletedWorkflow: input.workflowName,
    };
  });
}

// ========================================
// WORKFLOW TEST
// ========================================

/**
 * Test a workflow in GoHighLevel.
 * Finds and opens the workflow, clicks the Test button,
 * and optionally provides a test contact email.
 */
export async function workflowTest(
  stagehand: Stagehand,
  ctx: GHLAutomationContext,
  input: WorkflowTestInput
): Promise<GHLAutomationResult> {
  return executeFunction("workflow_test", async () => {
    // Navigate to workflows
    await navigateTo(stagehand, ctx, "/workflows", {
      waitForSelector: '[class*="workflow"]',
    });

    // Search for the workflow by name
    console.log(`[GHL Workflow] Searching for workflow to test: ${input.workflowName}`);
    await safeAct(
      stagehand,
      `Type "${input.workflowName}" into the search or filter input on the workflows page`
    );
    await delay(2000);

    // Click on the workflow to open it
    const opened = await safeAct(
      stagehand,
      `Click on the workflow named "${input.workflowName}" to open it`
    );
    if (!opened) {
      throw new Error(`Could not find workflow: ${input.workflowName}`);
    }
    await delay(2000);

    // Click the Test Workflow button
    console.log("[GHL Workflow] Clicking Test Workflow button...");
    const testClicked = await safeAct(
      stagehand,
      'Click the "Test Workflow" or "Test" button in the workflow builder'
    );
    if (!testClicked) {
      throw new Error("Could not find Test Workflow button");
    }
    await delay(2000);

    // Provide a test contact email if specified
    if (input.testContactEmail) {
      console.log(`[GHL Workflow] Providing test contact: ${input.testContactEmail}`);
      await safeAct(
        stagehand,
        `Type "${input.testContactEmail}" into the test contact email or search field in the test dialog`
      );
      await delay(1500);

      // Select the contact from results or confirm the email
      await safeAct(
        stagehand,
        'Select the first matching contact from the search results, or click "Use" to confirm the test contact'
      );
      await delay(1000);
    }

    // Execute the test
    console.log("[GHL Workflow] Running workflow test...");
    await safeAct(
      stagehand,
      'Click "Run Test", "Execute", or "Send Test" button to run the workflow test'
    );
    await delay(3000);

    // Try to extract the test result status
    let testStatus = "submitted";
    try {
      const page = getPage(stagehand);
      const pageContent = await page.content();
      const contentLower = pageContent.toLowerCase();
      if (contentLower.includes("success") || contentLower.includes("completed")) {
        testStatus = "success";
      } else if (contentLower.includes("fail") || contentLower.includes("error")) {
        testStatus = "failed";
      }
    } catch {
      // Could not determine test status; leave as submitted
    }

    console.log(`[GHL Workflow] Workflow test status: ${testStatus}`);

    return {
      workflowName: input.workflowName,
      testContactEmail: input.testContactEmail || null,
      testStatus,
    };
  });
}
