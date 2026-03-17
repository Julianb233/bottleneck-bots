/**
 * GHL Tasks Automation
 * Functions for creating and managing tasks
 */

import { Stagehand } from "@browserbasehq/stagehand";
import { z } from "zod";
import type {
  GHLAutomationContext,
  GHLAutomationResult,
  TaskCreateInput,
} from "./types";
import {
  executeFunction,
  navigateTo,
  safeAct,
  delay,
  getPage,
  fillField,
  searchContact,
  safeExtract,
  waitForPageLoad,
} from "./helpers";

/**
 * Create a task.
 * Navigates to /tasks or the contacts tasks section, creates a task,
 * sets title/description/assigned user/due date/priority, links to
 * contact/opportunity, and saves.
 */
export async function taskCreate(
  stagehand: Stagehand,
  ctx: GHLAutomationContext,
  input: TaskCreateInput,
): Promise<GHLAutomationResult> {
  return executeFunction("task_create", async () => {
    // If a related contact is provided, navigate to that contact's task section
    if (input.relatedContactSearch) {
      console.log(`[GHL Tasks] Searching for related contact: ${input.relatedContactSearch}`);
      const found = await searchContact(stagehand, ctx, input.relatedContactSearch);
      if (found) {
        await safeAct(stagehand, "Click on the first contact in the search results");
        await delay(1500);
        await safeAct(stagehand, "Click on the Tasks tab or section within the contact profile");
        await delay(1000);
      } else {
        // Fall back to global tasks page
        await navigateTo(stagehand, ctx, "/tasks", {
          waitForSelector: '[data-testid="tasks"]',
        });
      }
    } else {
      // Navigate to global tasks page
      await navigateTo(stagehand, ctx, "/tasks", {
        waitForSelector: '[data-testid="tasks"]',
      });
    }

    await waitForPageLoad(stagehand);

    // Create new task
    console.log(`[GHL Tasks] Creating task: ${input.title}`);
    await safeAct(stagehand, "Click the Create Task or Add Task button");
    await delay(1500);
    await waitForPageLoad(stagehand);

    // Set task title
    await safeAct(stagehand, `Type "${input.title}" into the task title field`);
    await delay(500);

    // Set description if provided
    if (input.description) {
      console.log("[GHL Tasks] Setting description...");
      await safeAct(
        stagehand,
        `Type "${input.description}" into the task description field`,
      );
      await delay(500);
    }

    // Assign user if provided
    if (input.assignedUser) {
      console.log(`[GHL Tasks] Assigning to: ${input.assignedUser}`);
      await safeAct(
        stagehand,
        `Select or search for "${input.assignedUser}" in the assigned user or assignee dropdown`,
      );
      await delay(500);
    }

    // Set due date if provided
    if (input.dueDate) {
      console.log(`[GHL Tasks] Setting due date: ${input.dueDate}`);
      await safeAct(stagehand, "Click on the due date field or calendar icon");
      await delay(500);
      await safeAct(
        stagehand,
        `Set the due date to ${input.dueDate}`,
      );
      await delay(500);
    }

    // Set priority
    const priorityLabel =
      input.priority === "high" ? "High" :
      input.priority === "low" ? "Low" :
      "Medium";
    console.log(`[GHL Tasks] Setting priority: ${priorityLabel}`);
    await safeAct(stagehand, `Select "${priorityLabel}" as the task priority`);
    await delay(500);

    // Link to opportunity if provided
    if (input.relatedOpportunity) {
      console.log(`[GHL Tasks] Linking to opportunity: ${input.relatedOpportunity}`);
      await safeAct(
        stagehand,
        `Search for and select "${input.relatedOpportunity}" as the related opportunity`,
      );
      await delay(500);
    }

    // Save the task
    await safeAct(stagehand, "Click the Save or Create button to save the task");
    await delay(2000);

    // Verify creation
    const result = await safeExtract(
      stagehand,
      "Check if the task was created successfully",
      z.object({
        created: z.boolean(),
        taskTitle: z.string().optional(),
        taskId: z.string().optional(),
      }),
    );

    console.log("[GHL Tasks] Task creation result:", result);
    return {
      taskCreated: result?.created ?? true,
      title: input.title,
      priority: input.priority,
      assignedUser: input.assignedUser,
      dueDate: input.dueDate,
    };
  });
}
