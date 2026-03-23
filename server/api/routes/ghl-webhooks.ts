/**
 * GHL Webhook Receiver -- Production-Grade
 *
 * Express routes for receiving inbound webhooks from GoHighLevel.
 * Handles contact events, opportunity events, and campaign events
 * with real DB sync, event deduplication, dead letter queue,
 * structured logging, and workflow engine integration.
 *
 * Routes:
 *   POST /api/ghl/webhooks/inbound  -- receive GHL webhook events
 *   GET  /api/ghl/webhooks/health   -- health check
 *   GET  /api/ghl/webhooks/dlq      -- view dead letter queue
 *   POST /api/ghl/webhooks/dlq/:id/retry -- retry a dead letter
 *
 * Linear: AI-5147
 */

import express, { Request, Response } from "express";
import crypto from "crypto";
import { eq, and, desc } from "drizzle-orm";
import { getDb } from "../../db";
import { ghlLocations } from "../../../drizzle/schema-ghl-locations";
import {
  ghlContacts,
  ghlOpportunities,
  ghlWebhookEvents,
  ghlWebhookDeadLetters,
} from "../../../drizzle/schema-ghl-webhooks";
import { addWorkflowExecutionJob, REDIS_AVAILABLE } from "../../_core/queue";
import { logger } from "../../lib/logger";

const webhookRouter = express.Router();
const log = logger.child({ service: "ghl-webhooks" });

// ========================================
// TYPES
// ========================================

interface GHLWebhookEvent {
  type: string;
  locationId?: string;
  /** GHL-provided event ID for deduplication */
  id?: string;
  // Contact events
  contact?: {
    id: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    tags?: string[];
    source?: string;
    customFields?: Array<{ id: string; value: string }>;
  };
  // Opportunity events
  opportunity?: {
    id: string;
    name: string;
    pipelineId: string;
    pipelineStageId: string;
    status: string;
    monetaryValue?: number;
    contactId: string;
  };
  // Campaign events
  campaign?: {
    id: string;
    name: string;
  };
  contactId?: string;
  timestamp?: string;
}

type WebhookHandler = (event: GHLWebhookEvent, userId: number) => Promise<void>;

// ========================================
// HELPERS
// ========================================

/**
 * Resolve the userId that owns a given GHL locationId.
 * Returns null if the location is not connected.
 */
async function resolveUserForLocation(locationId: string): Promise<number | null> {
  const db = await getDb();
  if (!db || !locationId) return null;

  const rows = await db
    .select({ userId: ghlLocations.userId })
    .from(ghlLocations)
    .where(and(eq(ghlLocations.locationId, locationId), eq(ghlLocations.isActive, true)))
    .limit(1);

  return rows.length > 0 ? rows[0].userId : null;
}

/**
 * Generate a deterministic event ID when GHL does not provide one.
 * Uses type + locationId + contactId/opportunityId + timestamp.
 */
function deriveEventId(event: GHLWebhookEvent): string {
  if (event.id) return event.id;
  const parts = [
    event.type,
    event.locationId || "",
    event.contact?.id || event.opportunity?.id || event.contactId || "",
    event.timestamp || "",
  ];
  return crypto.createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 64);
}

/**
 * Check if this event has already been processed (dedup).
 */
async function isDuplicateEvent(eventId: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  const rows = await db
    .select({ id: ghlWebhookEvents.id })
    .from(ghlWebhookEvents)
    .where(eq(ghlWebhookEvents.eventId, eventId))
    .limit(1);

  return rows.length > 0;
}

/**
 * Record a processed event for future dedup.
 */
async function recordEvent(eventId: string, eventType: string, locationId: string | undefined, success: boolean): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.insert(ghlWebhookEvents).values({
    eventId,
    eventType,
    locationId: locationId || null,
    success,
  }).onConflictDoNothing();
}

/**
 * Push a failed event into the dead letter queue.
 */
async function pushToDeadLetterQueue(
  event: GHLWebhookEvent,
  eventId: string,
  error: string
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.insert(ghlWebhookDeadLetters).values({
    eventId,
    eventType: event.type,
    locationId: event.locationId || null,
    payload: event as unknown as Record<string, unknown>,
    error,
  });

  log.warn({ eventId, eventType: event.type, error }, "Event pushed to dead letter queue");
}

/**
 * Fire a workflow execution job if Redis + workflow queue is available.
 */
async function triggerWorkflow(userId: number, event: GHLWebhookEvent): Promise<void> {
  if (!REDIS_AVAILABLE) return;

  try {
    await addWorkflowExecutionJob({
      userId: String(userId),
      workflowId: `ghl-webhook-${event.type}`,
      triggerId: event.id || deriveEventId(event),
      context: {
        source: "ghl-webhook",
        eventType: event.type,
        locationId: event.locationId,
        contactId: event.contact?.id || event.contactId,
        opportunityId: event.opportunity?.id,
        campaignId: event.campaign?.id,
        timestamp: event.timestamp || new Date().toISOString(),
      },
    });

    log.debug({ eventType: event.type, userId }, "Workflow job enqueued");
  } catch (err) {
    log.warn({ err, eventType: event.type }, "Failed to enqueue workflow job (non-fatal)");
  }
}

// ========================================
// EVENT HANDLERS
// ========================================

const eventHandlers: Record<string, WebhookHandler> = {
  ContactCreate: async (event, userId) => {
    const c = event.contact;
    if (!c?.id) throw new Error("Missing contact.id in ContactCreate event");

    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const now = new Date();
    await db.insert(ghlContacts).values({
      userId,
      ghlContactId: c.id,
      locationId: event.locationId || "",
      firstName: c.firstName || null,
      lastName: c.lastName || null,
      email: c.email || null,
      phone: c.phone || null,
      tags: c.tags || null,
      source: c.source || null,
      customFields: c.customFields || null,
      lastWebhookAt: now,
      createdAt: now,
      updatedAt: now,
    }).onConflictDoUpdate({
      target: [ghlContacts.ghlContactId, ghlContacts.locationId],
      set: {
        firstName: c.firstName || null,
        lastName: c.lastName || null,
        email: c.email || null,
        phone: c.phone || null,
        tags: c.tags || null,
        source: c.source || null,
        customFields: c.customFields || null,
        lastWebhookAt: now,
        updatedAt: now,
      },
    });

    log.info({
      contactId: c.id,
      email: c.email,
      locationId: event.locationId,
    }, "Contact created/upserted");
  },

  ContactUpdate: async (event, userId) => {
    const c = event.contact;
    if (!c?.id) throw new Error("Missing contact.id in ContactUpdate event");

    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const now = new Date();
    await db.insert(ghlContacts).values({
      userId,
      ghlContactId: c.id,
      locationId: event.locationId || "",
      firstName: c.firstName || null,
      lastName: c.lastName || null,
      email: c.email || null,
      phone: c.phone || null,
      tags: c.tags || null,
      source: c.source || null,
      customFields: c.customFields || null,
      lastWebhookAt: now,
      createdAt: now,
      updatedAt: now,
    }).onConflictDoUpdate({
      target: [ghlContacts.ghlContactId, ghlContacts.locationId],
      set: {
        firstName: c.firstName || null,
        lastName: c.lastName || null,
        email: c.email || null,
        phone: c.phone || null,
        tags: c.tags || null,
        source: c.source || null,
        customFields: c.customFields || null,
        lastWebhookAt: now,
        updatedAt: now,
      },
    });

    log.info({ contactId: c.id, locationId: event.locationId }, "Contact updated");
  },

  ContactTagUpdate: async (event, userId) => {
    const c = event.contact;
    if (!c?.id) throw new Error("Missing contact.id in ContactTagUpdate event");

    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const now = new Date();
    await db.insert(ghlContacts).values({
      userId,
      ghlContactId: c.id,
      locationId: event.locationId || "",
      tags: c.tags || null,
      lastWebhookAt: now,
      createdAt: now,
      updatedAt: now,
    }).onConflictDoUpdate({
      target: [ghlContacts.ghlContactId, ghlContacts.locationId],
      set: {
        tags: c.tags || null,
        lastWebhookAt: now,
        updatedAt: now,
      },
    });

    log.info({ contactId: c.id, tags: c.tags, locationId: event.locationId }, "Contact tags updated");
  },

  OpportunityCreate: async (event, userId) => {
    const o = event.opportunity;
    if (!o?.id) throw new Error("Missing opportunity.id in OpportunityCreate event");

    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const now = new Date();
    await db.insert(ghlOpportunities).values({
      userId,
      ghlOpportunityId: o.id,
      locationId: event.locationId || "",
      name: o.name || null,
      pipelineId: o.pipelineId || null,
      pipelineStageId: o.pipelineStageId || null,
      status: o.status || null,
      monetaryValue: o.monetaryValue != null ? String(o.monetaryValue) : null,
      ghlContactId: o.contactId || null,
      lastWebhookAt: now,
      createdAt: now,
      updatedAt: now,
    }).onConflictDoUpdate({
      target: [ghlOpportunities.ghlOpportunityId, ghlOpportunities.locationId],
      set: {
        name: o.name || null,
        pipelineId: o.pipelineId || null,
        pipelineStageId: o.pipelineStageId || null,
        status: o.status || null,
        monetaryValue: o.monetaryValue != null ? String(o.monetaryValue) : null,
        ghlContactId: o.contactId || null,
        lastWebhookAt: now,
        updatedAt: now,
      },
    });

    log.info({
      opportunityId: o.id,
      pipeline: o.pipelineId,
      stage: o.pipelineStageId,
      value: o.monetaryValue,
      locationId: event.locationId,
    }, "Opportunity created/upserted");
  },

  OpportunityStageUpdate: async (event, userId) => {
    const o = event.opportunity;
    if (!o?.id) throw new Error("Missing opportunity.id in OpportunityStageUpdate event");

    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const now = new Date();
    await db.insert(ghlOpportunities).values({
      userId,
      ghlOpportunityId: o.id,
      locationId: event.locationId || "",
      name: o.name || null,
      pipelineId: o.pipelineId || null,
      pipelineStageId: o.pipelineStageId || null,
      status: o.status || null,
      monetaryValue: o.monetaryValue != null ? String(o.monetaryValue) : null,
      ghlContactId: o.contactId || null,
      lastWebhookAt: now,
      createdAt: now,
      updatedAt: now,
    }).onConflictDoUpdate({
      target: [ghlOpportunities.ghlOpportunityId, ghlOpportunities.locationId],
      set: {
        pipelineStageId: o.pipelineStageId || null,
        status: o.status || null,
        lastWebhookAt: now,
        updatedAt: now,
      },
    });

    log.info({
      opportunityId: o.id,
      newStage: o.pipelineStageId,
      status: o.status,
      locationId: event.locationId,
    }, "Opportunity stage updated");
  },

  OpportunityStatusUpdate: async (event, userId) => {
    const o = event.opportunity;
    if (!o?.id) throw new Error("Missing opportunity.id in OpportunityStatusUpdate event");

    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const now = new Date();
    await db.insert(ghlOpportunities).values({
      userId,
      ghlOpportunityId: o.id,
      locationId: event.locationId || "",
      name: o.name || null,
      pipelineId: o.pipelineId || null,
      pipelineStageId: o.pipelineStageId || null,
      status: o.status || null,
      monetaryValue: o.monetaryValue != null ? String(o.monetaryValue) : null,
      ghlContactId: o.contactId || null,
      lastWebhookAt: now,
      createdAt: now,
      updatedAt: now,
    }).onConflictDoUpdate({
      target: [ghlOpportunities.ghlOpportunityId, ghlOpportunities.locationId],
      set: {
        status: o.status || null,
        lastWebhookAt: now,
        updatedAt: now,
      },
    });

    log.info({
      opportunityId: o.id,
      status: o.status,
      locationId: event.locationId,
    }, "Opportunity status updated");
  },

  CampaignStatusUpdate: async (event, _userId) => {
    // Campaign events are logged and forwarded to workflow engine.
    // No dedicated table -- these trigger internal automations.
    log.info({
      campaignId: event.campaign?.id,
      campaignName: event.campaign?.name,
      contactId: event.contactId,
      locationId: event.locationId,
    }, "Campaign status update received");
  },
};

// ========================================
// SIGNATURE VERIFICATION
// ========================================

function verifyWebhookSignature(
  body: string,
  signature: string | undefined,
  secret: string
): boolean {
  if (!signature || !secret) return !secret; // Skip if no secret configured
  const expected = crypto
    .createHmac("sha256", secret)
    .update(body)
    .digest("hex");
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}

// ========================================
// POST /api/ghl/webhooks/inbound
// ========================================

webhookRouter.post("/inbound", express.text({ type: "*/*" }), async (req: Request, res: Response) => {
  const webhookSecret = process.env.GHL_WEBHOOK_SECRET;
  const signature = req.headers["x-ghl-signature"] as string | undefined;
  const rawBody = typeof req.body === "string" ? req.body : JSON.stringify(req.body);

  // Verify signature if secret is configured
  if (webhookSecret && !verifyWebhookSignature(rawBody, signature, webhookSecret)) {
    log.warn({ ip: req.ip }, "Invalid webhook signature, rejecting");
    res.status(401).json({ error: "Invalid webhook signature" });
    return;
  }

  let event: GHLWebhookEvent;
  try {
    event = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  } catch {
    log.error("Failed to parse webhook body");
    res.status(400).json({ error: "Invalid JSON body" });
    return;
  }

  const eventType = event.type;
  if (!eventType) {
    log.warn("Missing event type in webhook payload");
    res.status(400).json({ error: "Missing event type" });
    return;
  }

  const eventId = deriveEventId(event);

  log.info({
    eventId,
    eventType,
    locationId: event.locationId,
    timestamp: event.timestamp || new Date().toISOString(),
  }, "Webhook received");

  // Respond immediately (GHL expects quick 200)
  res.status(200).json({ received: true, type: eventType, eventId });

  // ---- Async processing below ----

  // 1. Dedup check
  try {
    if (await isDuplicateEvent(eventId)) {
      log.info({ eventId, eventType }, "Duplicate event, skipping");
      return;
    }
  } catch (err) {
    log.warn({ err, eventId }, "Dedup check failed, processing anyway");
  }

  // 2. Resolve user from locationId
  let userId: number | null = null;
  if (event.locationId) {
    userId = await resolveUserForLocation(event.locationId);
  }

  if (!userId) {
    log.warn({ locationId: event.locationId, eventType }, "No user found for location, using DLQ");
    await pushToDeadLetterQueue(event, eventId, `No user found for locationId: ${event.locationId || "missing"}`);
    await recordEvent(eventId, eventType, event.locationId, false);
    return;
  }

  // 3. Process event
  const handler = eventHandlers[eventType];
  if (handler) {
    try {
      await handler(event, userId);
      await recordEvent(eventId, eventType, event.locationId, true);

      // 4. Trigger workflow engine
      await triggerWorkflow(userId, event);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      log.error({ err, eventId, eventType, locationId: event.locationId }, "Handler failed");
      await pushToDeadLetterQueue(event, eventId, errorMsg);
      await recordEvent(eventId, eventType, event.locationId, false);
    }
  } else {
    log.info({ eventType }, "No handler registered for event type");
    await recordEvent(eventId, eventType, event.locationId, true);
  }
});

// ========================================
// HEALTH CHECK
// ========================================

webhookRouter.get("/health", async (_req: Request, res: Response) => {
  const db = await getDb();
  let dlqCount = 0;

  if (db) {
    try {
      const rows = await db
        .select({ id: ghlWebhookDeadLetters.id })
        .from(ghlWebhookDeadLetters)
        .where(eq(ghlWebhookDeadLetters.resolved, false));
      dlqCount = rows.length;
    } catch {
      // DB may not have the table yet
    }
  }

  res.json({
    status: "ok",
    service: "ghl-webhooks",
    configured: !!process.env.GHL_WEBHOOK_SECRET,
    supportedEvents: Object.keys(eventHandlers),
    deadLetterCount: dlqCount,
    workflowQueueAvailable: REDIS_AVAILABLE,
    timestamp: new Date().toISOString(),
  });
});

// ========================================
// DLQ MANAGEMENT
// ========================================

webhookRouter.get("/dlq", async (_req: Request, res: Response) => {
  const db = await getDb();
  if (!db) {
    res.status(503).json({ error: "Database not available" });
    return;
  }

  try {
    const items = await db
      .select()
      .from(ghlWebhookDeadLetters)
      .where(eq(ghlWebhookDeadLetters.resolved, false))
      .orderBy(desc(ghlWebhookDeadLetters.createdAt))
      .limit(100);

    res.json({ count: items.length, items });
  } catch (err) {
    log.error({ err }, "Failed to fetch DLQ items");
    res.status(500).json({ error: "Failed to fetch dead letter queue" });
  }
});

webhookRouter.post("/dlq/:id/retry", async (req: Request, res: Response) => {
  const db = await getDb();
  if (!db) {
    res.status(503).json({ error: "Database not available" });
    return;
  }

  const dlqId = parseInt(req.params.id, 10);
  if (isNaN(dlqId)) {
    res.status(400).json({ error: "Invalid DLQ entry ID" });
    return;
  }

  try {
    const rows = await db
      .select()
      .from(ghlWebhookDeadLetters)
      .where(eq(ghlWebhookDeadLetters.id, dlqId))
      .limit(1);

    if (rows.length === 0) {
      res.status(404).json({ error: "DLQ entry not found" });
      return;
    }

    const entry = rows[0];
    if (entry.resolved) {
      res.status(400).json({ error: "DLQ entry already resolved" });
      return;
    }

    if (entry.retryCount >= entry.maxRetries) {
      res.status(400).json({ error: "Max retries exceeded" });
      return;
    }

    const event = entry.payload as unknown as GHLWebhookEvent;
    const eventType = event.type || entry.eventType;

    // Re-resolve user
    let userId: number | null = null;
    if (event.locationId) {
      userId = await resolveUserForLocation(event.locationId);
    }

    if (!userId) {
      await db.update(ghlWebhookDeadLetters).set({
        retryCount: entry.retryCount + 1,
        lastRetriedAt: new Date(),
        error: `Retry failed: No user found for locationId: ${event.locationId || "missing"}`,
        updatedAt: new Date(),
      }).where(eq(ghlWebhookDeadLetters.id, dlqId));

      res.status(422).json({ error: "No user found for location on retry" });
      return;
    }

    const handler = eventHandlers[eventType];
    if (!handler) {
      res.status(422).json({ error: `No handler for event type: ${eventType}` });
      return;
    }

    try {
      await handler(event, userId);
      await triggerWorkflow(userId, event);

      // Mark resolved
      await db.update(ghlWebhookDeadLetters).set({
        resolved: true,
        retryCount: entry.retryCount + 1,
        lastRetriedAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(ghlWebhookDeadLetters.id, dlqId));

      log.info({ dlqId, eventType }, "DLQ entry retried successfully");
      res.json({ success: true, message: "Event reprocessed successfully" });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      await db.update(ghlWebhookDeadLetters).set({
        retryCount: entry.retryCount + 1,
        lastRetriedAt: new Date(),
        error: `Retry failed: ${errorMsg}`,
        updatedAt: new Date(),
      }).where(eq(ghlWebhookDeadLetters.id, dlqId));

      log.error({ err, dlqId, eventType }, "DLQ retry failed");
      res.status(500).json({ error: "Retry failed", detail: errorMsg });
    }
  } catch (err) {
    log.error({ err }, "Failed to process DLQ retry");
    res.status(500).json({ error: "Failed to process retry" });
  }
});

export default webhookRouter;
