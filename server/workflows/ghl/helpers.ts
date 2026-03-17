/**
 * GHL Automation Helpers
 * Shared utilities for all GoHighLevel automation workflows
 */

import { Stagehand } from "@browserbasehq/stagehand";
import { z } from "zod";
import type { Page } from "playwright";
import type { GHLAutomationContext, GHLAutomationResult, GHLFunctionId } from "./types";

const GHL_BASE_URL = "https://app.gohighlevel.com";

/** Get Playwright page from Stagehand */
export function getPage(stagehand: Stagehand): Page {
  return stagehand.context.pages()[0] as unknown as Page;
}

/** Promise-based delay */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** Build GHL location URL */
export function ghlUrl(ctx: GHLAutomationContext, path: string): string {
  const base = ctx.baseUrl || GHL_BASE_URL;
  return `${base}/v2/location/${ctx.locationId}${path}`;
}

/** Navigate to a GHL module page */
export async function navigateTo(
  stagehand: Stagehand,
  ctx: GHLAutomationContext,
  path: string,
  options?: { waitForSelector?: string }
): Promise<void> {
  const page = getPage(stagehand);
  const url = ghlUrl(ctx, path);
  console.log(`[GHL] Navigating to ${url}`);
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await delay(2000);
  if (options?.waitForSelector) {
    try {
      await page.waitForSelector(options.waitForSelector, { timeout: 10000 });
    } catch {
      // Selector didn't appear, continue anyway
    }
  }
}

/** Search for a contact by name/email/phone */
export async function searchContact(
  stagehand: Stagehand,
  ctx: GHLAutomationContext,
  searchTerm: string
): Promise<boolean> {
  const page = getPage(stagehand);
  const currentUrl = page.url();

  if (!currentUrl.includes("/contacts")) {
    await navigateTo(stagehand, ctx, "/contacts");
  }

  await stagehand.act(`Type "${searchTerm}" into the search input and press Enter`);
  await delay(2000);

  // Check if results were found
  try {
    const results: any = await stagehand.extract(
      "Check if any contacts are shown in the results list",
      z.object({
        hasResults: z.boolean(),
        count: z.number().optional(),
      }) as any
    );
    return results?.hasResults ?? false;
  } catch {
    return false;
  }
}

/** Click on the first contact in search results */
export async function openFirstContact(stagehand: Stagehand): Promise<void> {
  await stagehand.act("Click on the first contact in the search results or contact list");
  await delay(2000);
}

/** Wait for a page to finish loading */
export async function waitForPageLoad(stagehand: Stagehand, timeoutMs = 5000): Promise<void> {
  const page = getPage(stagehand);
  try {
    await page.waitForLoadState("networkidle", { timeout: timeoutMs });
  } catch {
    // Timeout is acceptable; page may have long-running requests
  }
}

/** Safely extract data with error handling */
export async function safeExtract<T>(
  stagehand: Stagehand,
  instruction: string,
  schema: z.ZodType<T>
): Promise<T | null> {
  try {
    const result: any = await stagehand.extract(instruction, schema as any);
    return result ?? null;
  } catch (error) {
    console.error("[GHL] Extract failed:", error);
    return null;
  }
}

/** Safely perform an action with error handling */
export async function safeAct(
  stagehand: Stagehand,
  instruction: string,
  retries = 1
): Promise<boolean> {
  for (let i = 0; i <= retries; i++) {
    try {
      await stagehand.act(instruction);
      return true;
    } catch (error) {
      if (i === retries) {
        console.error(`[GHL] Action failed after ${retries + 1} attempts:`, instruction, error);
        return false;
      }
      await delay(1000);
    }
  }
  return false;
}

/** Fill a form field using Playwright native method (for sensitive/formatted data) */
export async function fillField(
  stagehand: Stagehand,
  selector: string,
  value: string,
  fallbackInstruction?: string
): Promise<boolean> {
  const page = getPage(stagehand);
  try {
    const element = page.locator(selector).first();
    await element.fill(value);
    return true;
  } catch {
    if (fallbackInstruction) {
      return safeAct(stagehand, fallbackInstruction);
    }
    return false;
  }
}

/** Handle duplicate contact modal */
export async function handleDuplicateModal(stagehand: Stagehand): Promise<void> {
  try {
    const page = getPage(stagehand);
    const modalVisible = await page.locator('text=already exists').isVisible({ timeout: 2000 });
    if (modalVisible) {
      await stagehand.act("Click 'Add Anyway' or 'Create Anyway' button");
      await delay(1000);
    }
  } catch {
    // No duplicate modal
  }
}

/** Wrap a function execution with timing and error handling */
export async function executeFunction<T>(
  functionId: GHLFunctionId,
  fn: () => Promise<T>
): Promise<GHLAutomationResult<T>> {
  const startTime = Date.now();
  try {
    const data = await fn();
    return {
      success: true,
      functionId,
      data,
      executionTimeMs: Date.now() - startTime,
    };
  } catch (error) {
    console.error(`[GHL ${functionId}] Error:`, error);
    return {
      success: false,
      functionId,
      error: error instanceof Error ? error.message : "Unknown error",
      executionTimeMs: Date.now() - startTime,
    };
  }
}

/** Confirm a destructive action dialog */
export async function confirmDialog(stagehand: Stagehand): Promise<boolean> {
  return safeAct(stagehand, "Click the Confirm or Yes button on the confirmation dialog");
}

/** Dismiss any open modal/dialog */
export async function dismissModal(stagehand: Stagehand): Promise<void> {
  try {
    const page = getPage(stagehand);
    const closeBtn = page.locator('[aria-label="Close"], button:has-text("Close"), .modal-close').first();
    if (await closeBtn.isVisible({ timeout: 1000 })) {
      await closeBtn.click();
      await delay(500);
    }
  } catch {
    // No modal to dismiss
  }
}
