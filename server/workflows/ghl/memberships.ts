/**
 * GHL Memberships & Courses Automation
 * Functions for creating membership areas and online courses
 */

import { Stagehand } from "@browserbasehq/stagehand";
import { z } from "zod";
import type {
  GHLAutomationContext,
  GHLAutomationResult,
  MembershipCreateInput,
  CourseCreateInput,
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
 * Create a membership area.
 * Navigates to /memberships, creates a new membership,
 * sets name/description/access level, adds content categories,
 * and saves.
 */
export async function membershipCreate(
  stagehand: Stagehand,
  ctx: GHLAutomationContext,
  input: MembershipCreateInput,
): Promise<GHLAutomationResult> {
  return executeFunction("membership_create", async () => {
    // Navigate to memberships
    await navigateTo(stagehand, ctx, "/memberships", {
      waitForSelector: '[data-testid="memberships"]',
    });

    // Create new membership
    console.log(`[GHL Memberships] Creating membership: ${input.name}`);
    await safeAct(stagehand, "Click the Create or New Membership button");
    await delay(1500);
    await waitForPageLoad(stagehand);

    // Set membership name
    await safeAct(stagehand, `Type "${input.name}" into the membership name field`);
    await delay(500);

    // Set description if provided
    if (input.description) {
      console.log("[GHL Memberships] Setting description...");
      await safeAct(
        stagehand,
        `Type "${input.description}" into the description field`,
      );
      await delay(500);
    }

    // Set access level
    const accessLabel = input.accessLevel === "paid" ? "Paid" : "Free";
    console.log(`[GHL Memberships] Setting access level: ${accessLabel}`);
    await safeAct(stagehand, `Select "${accessLabel}" as the access level`);
    await delay(500);

    // Add content categories if provided
    if (input.contentCategories && input.contentCategories.length > 0) {
      console.log("[GHL Memberships] Adding content categories...");
      for (const category of input.contentCategories) {
        await safeAct(
          stagehand,
          `Add a new content category named "${category}"`,
        );
        await delay(500);
      }
    }

    // Save the membership
    await safeAct(stagehand, "Click the Save or Create button to save the membership");
    await delay(2000);

    // Verify creation
    const result = await safeExtract(
      stagehand,
      "Check if the membership was created successfully",
      z.object({
        created: z.boolean(),
        membershipName: z.string().optional(),
      }),
    );

    console.log("[GHL Memberships] Creation result:", result);
    return {
      membershipCreated: result?.created ?? true,
      name: input.name,
      accessLevel: input.accessLevel,
    };
  });
}

/**
 * Create an online course.
 * Navigates to courses, creates a new course, sets name/description,
 * adds modules with lessons, configures drip/certificates, and saves.
 */
export async function courseCreate(
  stagehand: Stagehand,
  ctx: GHLAutomationContext,
  input: CourseCreateInput,
): Promise<GHLAutomationResult> {
  return executeFunction("course_create", async () => {
    // Navigate to memberships/courses
    await navigateTo(stagehand, ctx, "/memberships", {
      waitForSelector: '[data-testid="memberships"]',
    });

    // Look for courses section
    await safeAct(stagehand, "Click on the Courses tab or section");
    await delay(1500);

    // Create new course
    console.log(`[GHL Memberships] Creating course: ${input.name}`);
    await safeAct(stagehand, "Click the Create Course or New Course button");
    await delay(1500);
    await waitForPageLoad(stagehand);

    // Set course name
    await safeAct(stagehand, `Type "${input.name}" into the course name field`);
    await delay(500);

    // Set description if provided
    if (input.description) {
      console.log("[GHL Memberships] Setting course description...");
      await safeAct(
        stagehand,
        `Type "${input.description}" into the course description field`,
      );
      await delay(500);
    }

    // Add modules and lessons if provided
    if (input.modules && input.modules.length > 0) {
      console.log(`[GHL Memberships] Adding ${input.modules.length} modules...`);
      for (const module of input.modules) {
        // Add module
        await safeAct(stagehand, "Click the Add Module or New Module button");
        await delay(1000);
        await safeAct(stagehand, `Type "${module.name}" into the module name field`);
        await delay(500);

        // Add lessons within the module
        if (module.lessons && module.lessons.length > 0) {
          for (const lesson of module.lessons) {
            await safeAct(stagehand, "Click the Add Lesson or New Lesson button");
            await delay(800);
            await safeAct(stagehand, `Type "${lesson.title}" into the lesson title field`);
            await delay(500);

            if (lesson.contentType) {
              const contentLabel = lesson.contentType === "video" ? "Video" : lesson.contentType === "text" ? "Text" : "Quiz";
              await safeAct(stagehand, `Select "${contentLabel}" as the lesson content type`);
              await delay(300);
            }

            // Save the lesson
            await safeAct(stagehand, "Click Save or Done to save the lesson");
            await delay(500);
          }
        }

        // Save the module
        await safeAct(stagehand, "Click Save or Done to save the module");
        await delay(500);
      }
    }

    // Configure drip schedule if enabled
    if (input.dripSchedule) {
      console.log("[GHL Memberships] Enabling drip schedule...");
      await safeAct(stagehand, "Enable the drip schedule or content dripping toggle");
      await delay(500);
    }

    // Configure certificate if enabled
    if (input.certificateEnabled) {
      console.log("[GHL Memberships] Enabling certificate...");
      await safeAct(stagehand, "Enable the certificate or completion certificate toggle");
      await delay(500);
    }

    // Save the course
    await safeAct(stagehand, "Click the Save or Publish button to save the course");
    await delay(2000);

    // Verify creation
    const result = await safeExtract(
      stagehand,
      "Check if the course was created successfully",
      z.object({
        created: z.boolean(),
        courseName: z.string().optional(),
      }),
    );

    console.log("[GHL Memberships] Course creation result:", result);
    return {
      courseCreated: result?.created ?? true,
      name: input.name,
      moduleCount: input.modules?.length ?? 0,
      dripEnabled: input.dripSchedule,
      certificateEnabled: input.certificateEnabled,
    };
  });
}
