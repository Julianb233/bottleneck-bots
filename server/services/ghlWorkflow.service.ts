/**
 * GHL Workflow Trigger Service
 *
 * Bidirectional workflow triggers between GHL and Bottleneck Bots:
 *
 * 1. Platform → GHL: Trigger GHL workflows via API
 *    - List available GHL workflows for a location
 *    - Execute a GHL workflow with contact + variables
 *    - Track execution results
 *
 * 2. GHL → Platform: Process inbound webhook events
 *    - Match events to configured triggers
 *    - Execute platform workflows with mapped data
 *    - Log events and processing results
 *
 * Linear: AI-2880
 */

import { getDb } from "../db";
import { eq, and, desc } from "drizzle-orm";
import { createGHLService, GHLError } from "./ghl.service";
import { automationWorkflows } from "../../drizzle/schema";
import {
  ghlWorkflowTriggers,
  ghlWebhookEvents,
  ghlWorkflowExecutions,
} from "../../drizzle/schema-ghl-triggers";

// ========================================
// TYPES
// ========================================

export interface GHLWorkflow {
  id: string;
  name: string;
  status: string;
  locationId: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface TriggerGHLWorkflowParams {
  userId: number;
  locationId: string;
  ghlWorkflowId: string;
  contactId: string;
  eventData?: Record<string, unknown>;
  triggerId?: number;
  sourceType: "trigger_rule" | "manual" | "workflow_step";
  sourceId?: string;
}

export interface TriggerGHLWorkflowResult {
  success: boolean;
  executionId: number;
  ghlResponse?: unknown;
  error?: string;
}

export interface ProcessWebhookEventParams {
  locationId: string;
  eventType: string;
  eventId?: string;
  payload: Record<string, unknown>;
  headers: Record<string, string>;
}

export interface ProcessWebhookEventResult {
  success: boolean;
  eventId: string;
  triggersMatched: number;
  triggersExecuted: number;
  errors: string[];
}

export interface TriggerFilterCondition {
  field: string;
  operator: "equals" | "not_equals" | "contains" | "not_contains" | "exists" | "not_exists" | "greater_than" | "less_than";
  value?: string | number | boolean;
}

export interface FieldMapping {
  mappings: Array<{ source: string; target: string }>;
  staticVars?: Record<string, unknown>;
}

// ========================================
// GHL WORKFLOW API OPERATIONS
// ========================================

/**
 * List available GHL workflows for a location.
 */
export async function listGHLWorkflows(
  userId: number,
  locationId: string
): Promise<GHLWorkflow[]> {
  const ghl = createGHLService(locationId, userId);

  const response = await ghl.request<{ workflows: GHLWorkflow[] }>({
    method: "GET",
    endpoint: "/workflows/",
    params: { locationId },
  });

  return (response.data.workflows || []).map((wf) => ({
    id: wf.id,
    name: wf.name,
    status: wf.status,
    locationId,
    createdAt: wf.createdAt,
    updatedAt: wf.updatedAt,
  }));
}

/**
 * Trigger a GHL workflow for a specific contact.
 * This is the Platform → GHL direction.
 */
export async function triggerGHLWorkflow(
  params: TriggerGHLWorkflowParams
): Promise<TriggerGHLWorkflowResult> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Create execution record
  const [execution] = await db
    .insert(ghlWorkflowExecutions)
    .values({
      userId: params.userId,
      triggerId: params.triggerId || null,
      ghlLocationId: params.locationId,
      ghlWorkflowId: params.ghlWorkflowId,
      ghlContactId: params.contactId,
      inputData: params.eventData || {},
      status: "pending",
      sourceType: params.sourceType,
      sourceId: params.sourceId || null,
    })
    .returning();

  try {
    const ghl = createGHLService(params.locationId, params.userId);

    // GHL API: Add contact to workflow
    // POST /contacts/{contactId}/workflow/{workflowId}
    const response = await ghl.request({
      method: "POST",
      endpoint: `/contacts/${params.contactId}/workflow/${params.ghlWorkflowId}`,
      data: {
        eventStartTime: new Date().toISOString(),
        ...(params.eventData || {}),
      },
    });

    // Update execution as sent
    await db
      .update(ghlWorkflowExecutions)
      .set({
        status: "sent",
        responseData: response.data as Record<string, unknown>,
        completedAt: new Date(),
      })
      .where(eq(ghlWorkflowExecutions.id, execution.id));

    // Update trigger stats if this came from a trigger rule
    if (params.triggerId) {
      await db
        .update(ghlWorkflowTriggers)
        .set({
          triggerCount: (await db
            .select()
            .from(ghlWorkflowTriggers)
            .where(eq(ghlWorkflowTriggers.id, params.triggerId))
            .limit(1)
            .then(([t]) => (t?.triggerCount || 0) + 1)),
          lastTriggeredAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(ghlWorkflowTriggers.id, params.triggerId));
    }

    return {
      success: true,
      executionId: execution.id,
      ghlResponse: response.data,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";

    // Update execution as failed
    await db
      .update(ghlWorkflowExecutions)
      .set({
        status: "failed",
        error: errorMsg,
        completedAt: new Date(),
      })
      .where(eq(ghlWorkflowExecutions.id, execution.id));

    // Update trigger error stats
    if (params.triggerId) {
      const [trigger] = await db
        .select()
        .from(ghlWorkflowTriggers)
        .where(eq(ghlWorkflowTriggers.id, params.triggerId))
        .limit(1);

      if (trigger) {
        await db
          .update(ghlWorkflowTriggers)
          .set({
            lastError: errorMsg,
            errorCount: (trigger.errorCount || 0) + 1,
            updatedAt: new Date(),
          })
          .where(eq(ghlWorkflowTriggers.id, params.triggerId));
      }
    }

    return {
      success: false,
      executionId: execution.id,
      error: errorMsg,
    };
  }
}

// ========================================
// INBOUND WEBHOOK EVENT PROCESSING
// ========================================

/**
 * Process an inbound GHL webhook event.
 * This is the GHL → Platform direction.
 *
 * 1. Log the event
 * 2. Find matching triggers
 * 3. For each matching trigger, execute the mapped platform workflow
 */
export async function processGHLWebhookEvent(
  params: ProcessWebhookEventParams
): Promise<ProcessWebhookEventResult> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const errors: string[] = [];

  // 1. Find the user who owns this location
  const userId = await resolveUserForLocation(params.locationId);
  if (!userId) {
    return {
      success: false,
      eventId: "",
      triggersMatched: 0,
      triggersExecuted: 0,
      errors: [`No user found for GHL location ${params.locationId}`],
    };
  }

  // 2. Log the event
  const [event] = await db
    .insert(ghlWebhookEvents)
    .values({
      userId,
      ghlLocationId: params.locationId,
      eventType: params.eventType,
      eventId: params.eventId || null,
      payload: params.payload,
      headers: params.headers,
      status: "received",
    })
    .returning();

  // 3. Find matching triggers
  const matchingTriggers = await db
    .select()
    .from(ghlWorkflowTriggers)
    .where(
      and(
        eq(ghlWorkflowTriggers.ghlLocationId, params.locationId),
        eq(ghlWorkflowTriggers.ghlEventType, params.eventType),
        eq(ghlWorkflowTriggers.direction, "ghl_to_platform"),
        eq(ghlWorkflowTriggers.isActive, true)
      )
    );

  if (matchingTriggers.length === 0) {
    // No triggers matched — mark event as skipped
    await db
      .update(ghlWebhookEvents)
      .set({ status: "skipped", processedAt: new Date() })
      .where(eq(ghlWebhookEvents.id, event.id));

    return {
      success: true,
      eventId: event.id,
      triggersMatched: 0,
      triggersExecuted: 0,
      errors: [],
    };
  }

  // 4. Process each matching trigger
  let triggersExecuted = 0;

  for (const trigger of matchingTriggers) {
    try {
      // Check filter conditions
      if (trigger.filterConditions) {
        const conditions = trigger.filterConditions as TriggerFilterCondition[];
        const passes = evaluateFilterConditions(conditions, params.payload);
        if (!passes) continue;
      }

      // Map fields from GHL event to platform workflow variables
      const variables = mapFields(
        trigger.fieldMapping as FieldMapping | null,
        params.payload
      );

      // If trigger has a platform workflow, queue it for execution
      if (trigger.platformWorkflowId) {
        // Verify workflow exists and is active
        const [workflow] = await db
          .select()
          .from(automationWorkflows)
          .where(
            and(
              eq(automationWorkflows.id, trigger.platformWorkflowId),
              eq(automationWorkflows.userId, userId),
              eq(automationWorkflows.isActive, true)
            )
          )
          .limit(1);

        if (workflow) {
          // Import dynamically to avoid circular deps
          const { executeWorkflow } = await import("./workflowExecution.service");

          const result = await executeWorkflow({
            workflowId: workflow.id,
            userId,
            variables,
          });

          // Update event with execution reference
          await db
            .update(ghlWebhookEvents)
            .set({
              triggerId: trigger.id,
              executionId: result.executionId,
              status: "processed",
              processedAt: new Date(),
            })
            .where(eq(ghlWebhookEvents.id, event.id));

          // Update trigger stats
          await db
            .update(ghlWorkflowTriggers)
            .set({
              triggerCount: (trigger.triggerCount || 0) + 1,
              lastTriggeredAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(ghlWorkflowTriggers.id, trigger.id));

          triggersExecuted++;
        } else {
          errors.push(`Workflow ${trigger.platformWorkflowId} not found or inactive for trigger ${trigger.id}`);
        }
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      errors.push(`Trigger ${trigger.id} failed: ${errorMsg}`);

      // Update trigger error stats
      await db
        .update(ghlWorkflowTriggers)
        .set({
          lastError: errorMsg,
          errorCount: (trigger.errorCount || 0) + 1,
          updatedAt: new Date(),
        })
        .where(eq(ghlWorkflowTriggers.id, trigger.id));
    }
  }

  // If no triggers executed successfully, mark as failed
  if (triggersExecuted === 0 && errors.length > 0) {
    await db
      .update(ghlWebhookEvents)
      .set({
        status: "failed",
        processingError: errors.join("; "),
        processedAt: new Date(),
      })
      .where(eq(ghlWebhookEvents.id, event.id));
  }

  return {
    success: errors.length === 0,
    eventId: event.id,
    triggersMatched: matchingTriggers.length,
    triggersExecuted,
    errors,
  };
}

// ========================================
// HELPER FUNCTIONS
// ========================================

/**
 * Resolve the Bottleneck Bots user who owns a given GHL location.
 * Looks up the integrations table for a `ghl:<locationId>` entry.
 */
async function resolveUserForLocation(locationId: string): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;

  // Import dynamically to avoid issues
  const { integrations } = await import("../../drizzle/schema");

  const [integration] = await db
    .select()
    .from(integrations)
    .where(
      and(
        eq(integrations.service, `ghl:${locationId}`),
        eq(integrations.isActive, "true")
      )
    )
    .limit(1);

  return integration?.userId ?? null;
}

/**
 * Map fields from a GHL event payload to platform workflow variables
 * using the configured field mapping.
 */
function mapFields(
  mapping: FieldMapping | null,
  payload: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  if (!mapping) {
    // No mapping configured — pass the entire payload as-is
    return { ghlEvent: payload };
  }

  // Apply static vars first
  if (mapping.staticVars) {
    Object.assign(result, mapping.staticVars);
  }

  // Apply field mappings
  if (mapping.mappings) {
    for (const m of mapping.mappings) {
      const value = getNestedValue(payload, m.source);
      if (value !== undefined) {
        result[m.target] = value;
      }
    }
  }

  // Always include the raw event as a fallback
  result.__ghlRawEvent = payload;

  return result;
}

/**
 * Get a nested value from an object using dot notation.
 * e.g. getNestedValue({ contact: { email: 'foo' } }, 'contact.email') → 'foo'
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/**
 * Evaluate filter conditions against a payload.
 * All conditions must pass (AND logic).
 */
function evaluateFilterConditions(
  conditions: TriggerFilterCondition[],
  payload: Record<string, unknown>
): boolean {
  for (const cond of conditions) {
    const value = getNestedValue(payload, cond.field);

    switch (cond.operator) {
      case "equals":
        if (value !== cond.value) return false;
        break;
      case "not_equals":
        if (value === cond.value) return false;
        break;
      case "contains":
        if (typeof value === "string" && typeof cond.value === "string") {
          if (!value.includes(cond.value)) return false;
        } else if (Array.isArray(value)) {
          if (!value.includes(cond.value)) return false;
        } else {
          return false;
        }
        break;
      case "not_contains":
        if (typeof value === "string" && typeof cond.value === "string") {
          if (value.includes(cond.value)) return false;
        } else if (Array.isArray(value)) {
          if (value.includes(cond.value)) return false;
        }
        break;
      case "exists":
        if (value === undefined || value === null) return false;
        break;
      case "not_exists":
        if (value !== undefined && value !== null) return false;
        break;
      case "greater_than":
        if (typeof value !== "number" || typeof cond.value !== "number" || value <= cond.value) return false;
        break;
      case "less_than":
        if (typeof value !== "number" || typeof cond.value !== "number" || value >= cond.value) return false;
        break;
    }
  }

  return true;
}

// ========================================
// SUPPORTED GHL EVENT TYPES
// ========================================

/**
 * Known GHL webhook event types that we support.
 */
export const GHL_EVENT_TYPES = [
  // Contact events
  "ContactCreate",
  "ContactDelete",
  "ContactDndUpdate",
  "ContactTagUpdate",
  "ContactNoteCreate",
  "ContactNoteDelete",

  // Opportunity / Pipeline events
  "OpportunityCreate",
  "OpportunityDelete",
  "OpportunityStageUpdate",
  "OpportunityStatusUpdate",
  "OpportunityMonetaryValueUpdate",
  "OpportunityAssignedToUpdate",

  // Appointment events
  "AppointmentCreate",
  "AppointmentDelete",
  "AppointmentUpdate",

  // Task events
  "TaskCreate",
  "TaskComplete",
  "TaskDelete",

  // Form events
  "FormSubmission",

  // Note events
  "NoteCreate",
  "NoteUpdate",
  "NoteDelete",

  // Conversation / Message events
  "InboundMessage",
  "OutboundMessage",
  "ConversationUnreadUpdate",

  // Campaign events
  "CampaignStatusUpdate",

  // Invoice events
  "InvoiceCreate",
  "InvoiceUpdate",
  "InvoiceDelete",
  "InvoicePaymentReceived",
] as const;

export type GHLEventType = (typeof GHL_EVENT_TYPES)[number];
