/**
 * GHL Reporting & Analytics Automation
 * Functions for viewing dashboards and creating custom reports
 */

import { Stagehand } from "@browserbasehq/stagehand";
import { z } from "zod";
import type {
  GHLAutomationContext,
  GHLAutomationResult,
  DashboardViewInput,
  ReportCreateInput,
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
 * View the analytics dashboard with a specified date range.
 * Navigates to /reporting or /dashboard, sets the date range,
 * and extracts visible metrics.
 */
export async function dashboardView(
  stagehand: Stagehand,
  ctx: GHLAutomationContext,
  input: DashboardViewInput,
): Promise<GHLAutomationResult> {
  return executeFunction("dashboard_view", async () => {
    // Navigate to reporting/dashboard
    await navigateTo(stagehand, ctx, "/dashboard", {
      waitForSelector: '[data-testid="dashboard"]',
    });
    await waitForPageLoad(stagehand);

    // Set date range
    const dateRangeLabel =
      input.dateRange === "today" ? "Today" :
      input.dateRange === "yesterday" ? "Yesterday" :
      input.dateRange === "last_7_days" ? "Last 7 Days" :
      input.dateRange === "last_30_days" ? "Last 30 Days" :
      input.dateRange === "this_month" ? "This Month" :
      input.dateRange === "last_month" ? "Last Month" :
      "Custom";

    console.log(`[GHL Reporting] Setting date range: ${dateRangeLabel}`);
    await safeAct(stagehand, "Click on the date range picker or date filter dropdown");
    await delay(1000);
    await safeAct(stagehand, `Select "${dateRangeLabel}" from the date range options`);
    await delay(1000);

    // Handle custom date range
    if (input.dateRange === "custom" && input.customStartDate && input.customEndDate) {
      console.log(`[GHL Reporting] Setting custom range: ${input.customStartDate} to ${input.customEndDate}`);
      await safeAct(
        stagehand,
        `Set the start date to ${input.customStartDate}`,
      );
      await delay(500);
      await safeAct(
        stagehand,
        `Set the end date to ${input.customEndDate}`,
      );
      await delay(500);
      await safeAct(stagehand, "Click Apply or Confirm to apply the custom date range");
      await delay(1500);
    }

    await waitForPageLoad(stagehand);

    // Extract dashboard metrics
    console.log("[GHL Reporting] Extracting dashboard metrics...");
    const metrics = await safeExtract(
      stagehand,
      "Extract all visible metrics and KPIs from the dashboard including leads, appointments, revenue, conversion rates, contacts added, and any other visible numbers",
      z.object({
        totalLeads: z.number().optional(),
        totalAppointments: z.number().optional(),
        totalRevenue: z.number().optional(),
        conversionRate: z.string().optional(),
        contactsAdded: z.number().optional(),
        emailsSent: z.number().optional(),
        smsSent: z.number().optional(),
        additionalMetrics: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
      }),
    );

    console.log("[GHL Reporting] Dashboard metrics:", metrics);
    return {
      dateRange: input.dateRange,
      metrics: metrics ?? {},
    };
  });
}

/**
 * Create a custom report.
 * Navigates to reporting, creates a new report, sets
 * name/type/date range/grouping/filters, and saves.
 */
export async function reportCreate(
  stagehand: Stagehand,
  ctx: GHLAutomationContext,
  input: ReportCreateInput,
): Promise<GHLAutomationResult> {
  return executeFunction("report_create", async () => {
    // Navigate to reporting
    await navigateTo(stagehand, ctx, "/reporting", {
      waitForSelector: '[data-testid="reporting"]',
    });
    await waitForPageLoad(stagehand);

    // Create new report
    console.log(`[GHL Reporting] Creating report: ${input.name}`);
    await safeAct(stagehand, "Click the Create Report or New Report button");
    await delay(1500);
    await waitForPageLoad(stagehand);

    // Set report name
    await safeAct(stagehand, `Type "${input.name}" into the report name field`);
    await delay(500);

    // Set report type
    const typeLabel =
      input.type === "leads" ? "Leads" :
      input.type === "appointments" ? "Appointments" :
      input.type === "revenue" ? "Revenue" :
      input.type === "campaigns" ? "Campaigns" :
      "Custom";
    console.log(`[GHL Reporting] Setting report type: ${typeLabel}`);
    await safeAct(stagehand, `Select "${typeLabel}" as the report type`);
    await delay(500);

    // Set date range
    const dateRangeLabel =
      input.dateRange === "last_7_days" ? "Last 7 Days" :
      input.dateRange === "last_30_days" ? "Last 30 Days" :
      input.dateRange === "last_90_days" ? "Last 90 Days" :
      "This Year";
    console.log(`[GHL Reporting] Setting date range: ${dateRangeLabel}`);
    await safeAct(stagehand, `Select "${dateRangeLabel}" as the report date range`);
    await delay(500);

    // Set grouping if provided
    if (input.groupBy) {
      const groupLabel =
        input.groupBy === "day" ? "Day" :
        input.groupBy === "week" ? "Week" :
        "Month";
      console.log(`[GHL Reporting] Setting group by: ${groupLabel}`);
      await safeAct(stagehand, `Select "Group by ${groupLabel}" or set the grouping to "${groupLabel}"`);
      await delay(500);
    }

    // Apply filters if provided
    if (input.filters) {
      console.log("[GHL Reporting] Applying filters...");
      for (const [filterKey, filterValue] of Object.entries(input.filters)) {
        await safeAct(stagehand, "Click the Add Filter button");
        await delay(500);
        await safeAct(
          stagehand,
          `Set the filter field to "${filterKey}" and value to "${filterValue}"`,
        );
        await delay(500);
      }
    }

    // Save the report
    await safeAct(stagehand, "Click the Save or Generate Report button");
    await delay(2000);

    // Verify creation
    const result = await safeExtract(
      stagehand,
      "Check if the report was created and saved successfully",
      z.object({
        created: z.boolean(),
        reportName: z.string().optional(),
        reportId: z.string().optional(),
      }),
    );

    console.log("[GHL Reporting] Report creation result:", result);
    return {
      reportCreated: result?.created ?? true,
      name: input.name,
      type: input.type,
      dateRange: input.dateRange,
    };
  });
}
