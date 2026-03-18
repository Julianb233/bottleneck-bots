/**
 * GHL Webhook Express Routes
 *
 * Handles incoming webhooks from GoHighLevel:
 * - POST /api/webhooks/ghl - Receive and process GHL webhook events
 *
 * Flow:
 * 1. Verify HMAC-SHA256 signature using GHL_WEBHOOK_SECRET
 * 2. Deduplicate events by eventId
 * 3. Store event in ghlWebhookEvents table
 * 4. Process asynchronously (or inline for simple events)
 * 5. Return 200 immediately for GHL to consider delivery successful
 */

import { Router, Request, Response } from "express";
import crypto from "crypto";
import { getDb } from "../../db";
import { eq, and } from "drizzle-orm";
import { ghlWebhookEvents, ghlSyncLog } from "../../../drizzle/schema-ghl";
import { ENV } from "../../_core/env";

export const ghlWebhookRouter = Router();

// ========================================
// TYPES
// ========================================

export type GHLEventType =
  | "ContactCreate"
  | "ContactUpdate"
  | "ContactDelete"
  | "ContactTagUpdate"
  | "ContactDndUpdate"
  | "OpportunityCreate"
  | "OpportunityUpdate"
  | "OpportunityStageUpdate"
  | "OpportunityStatusUpdate"
  | "OpportunityAssignedToUpdate"
  | "AppointmentCreate"
  | "AppointmentUpdate"
  | "AppointmentDelete"
  | "TaskCreate"
  | "TaskComplete"
  | "NoteCreate"
  | "NoteUpdate"
  | "InboundMessage"
  | "OutboundMessage"
  | "FormSubmission"
  | "CallCompleted";

interface GHLWebhookPayload {
  type: string;
  locationId: string;
  id?: string;
  body?: Record<string, unknown>;
  [key: string]: unknown;
}

// ========================================
// SIGNATURE VERIFICATION
// ========================================

function verifySignature(
  payload: string,
  signature: string | undefined,
  secret: string
): boolean {
  if (!signature || !secret) return false;

  const computed = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");

  // Timing-safe comparison
  try {
    return crypto.timingSafeEqual(
      Buffer.from(computed, "hex"),
      Buffer.from(signature, "hex")
    );
  } catch {
    return false;
  }
}

// ========================================
// WEBHOOK HANDLER
// ========================================

ghlWebhookRouter.post("/", async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    // 1. Signature Verification
    const signature = req.headers["x-ghl-signature"] as string | undefined;
    const webhookSecret = ENV.ghlWebhookSecret;

    if (webhookSecret) {
      const rawBody = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
      if (!verifySignature(rawBody, signature, webhookSecret)) {
        console.warn("[GHL Webhook] Invalid signature");
        res.status(401).json({ error: "Invalid webhook signature" });
        return;
      }
    }

    const payload = req.body as GHLWebhookPayload;

    if (!payload || !payload.type) {
      res.status(400).json({ error: "Invalid webhook payload: missing type" });
      return;
    }

    const eventType = payload.type;
    const locationId = payload.locationId || "";
    const eventId = payload.id || `${eventType}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    console.log(`[GHL Webhook] Received event: ${eventType} for location ${locationId}`);

    const db = await getDb();
    if (!db) {
      // Accept the event even if DB is unavailable (don't lose webhooks)
      console.error("[GHL Webhook] Database unavailable, accepting event");
      res.status(200).json({ received: true, queued: false });
      return;
    }

    // 2. Deduplication
    const [existing] = await db
      .select({ id: ghlWebhookEvents.id })
      .from(ghlWebhookEvents)
      .where(eq(ghlWebhookEvents.eventId, eventId))
      .limit(1);

    if (existing) {
      console.log(`[GHL Webhook] Duplicate event ${eventId}, skipping`);
      res.status(200).json({ received: true, duplicate: true });
      return;
    }

    // 3. Store Event
    const [storedEvent] = await db
      .insert(ghlWebhookEvents)
      .values({
        locationId,
        eventType,
        eventId,
        payload: payload as Record<string, unknown>,
        status: "pending",
        retryCount: 0,
      })
      .returning();

    // 4. Process Event (inline for now; can be moved to BullMQ worker later)
    try {
      await processGHLEvent(db, storedEvent.id, eventType, locationId, payload);

      await db
        .update(ghlWebhookEvents)
        .set({
          status: "processed",
          processedAt: new Date(),
        })
        .where(eq(ghlWebhookEvents.id, storedEvent.id));
    } catch (processError) {
      const errorMsg = processError instanceof Error ? processError.message : "Unknown processing error";

      await db
        .update(ghlWebhookEvents)
        .set({
          status: (storedEvent.retryCount ?? 0) >= 4 ? "dead_letter" : "failed",
          errorMessage: errorMsg,
          retryCount: (storedEvent.retryCount ?? 0) + 1,
        })
        .where(eq(ghlWebhookEvents.id, storedEvent.id));

      console.error(`[GHL Webhook] Processing failed for event ${eventId}: ${errorMsg}`);
    }

    const processingTime = Date.now() - startTime;
    console.log(`[GHL Webhook] Event ${eventType} processed in ${processingTime}ms`);

    // 5. Return 200 immediately
    res.status(200).json({ received: true, eventId: storedEvent.id });
  } catch (error) {
    console.error("[GHL Webhook] Handler error:", error);
    // Still return 200 to prevent GHL from retrying (we'll handle retries ourselves)
    res.status(200).json({ received: true, error: "Processing deferred" });
  }
});

// ========================================
// EVENT PROCESSING
// ========================================

async function processGHLEvent(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  eventDbId: number,
  eventType: string,
  locationId: string,
  payload: GHLWebhookPayload
): Promise<void> {
  // Route to handler based on event type
  switch (eventType) {
    case "ContactCreate":
    case "ContactUpdate":
    case "ContactDelete":
    case "ContactTagUpdate":
    case "ContactDndUpdate":
      await handleContactEvent(db, eventType, locationId, payload);
      break;

    case "OpportunityCreate":
    case "OpportunityUpdate":
    case "OpportunityStageUpdate":
    case "OpportunityStatusUpdate":
    case "OpportunityAssignedToUpdate":
      await handleOpportunityEvent(db, eventType, locationId, payload);
      break;

    case "AppointmentCreate":
    case "AppointmentUpdate":
    case "AppointmentDelete":
      await handleAppointmentEvent(db, eventType, locationId, payload);
      break;

    case "FormSubmission":
      await handleFormSubmission(db, locationId, payload);
      break;

    case "InboundMessage":
    case "OutboundMessage":
      await handleMessageEvent(db, eventType, locationId, payload);
      break;

    case "CallCompleted":
      await handleCallEvent(db, locationId, payload);
      break;

    default:
      console.log(`[GHL Webhook] Unhandled event type: ${eventType}`);
      break;
  }

  // Log sync operation
  try {
    // Find the user who owns this location
    const { ghlConnections } = await import("../../../drizzle/schema-ghl");
    const [connection] = await db
      .select()
      .from(ghlConnections)
      .where(eq(ghlConnections.locationId, locationId))
      .limit(1);

    if (connection) {
      await db.insert(ghlSyncLog).values({
        connectionId: connection.id,
        userId: connection.userId,
        syncType: `webhook:${eventType.toLowerCase()}`,
        direction: "pull",
        status: "success",
        recordsProcessed: 1,
        metadata: { eventId: payload.id || null, locationId },
      });
    }
  } catch {
    // Non-critical: don't fail the event processing if logging fails
  }
}

// ========================================
// EVENT HANDLERS
// ========================================

async function handleContactEvent(
  db: any,
  eventType: string,
  locationId: string,
  payload: GHLWebhookPayload
): Promise<void> {
  console.log(`[GHL Webhook] Contact event: ${eventType} for location ${locationId}`);
  // Contact events are logged and can trigger workflows.
  // The actual contact data sync is handled by the contact management service (03-02).
}

async function handleOpportunityEvent(
  db: any,
  eventType: string,
  locationId: string,
  payload: GHLWebhookPayload
): Promise<void> {
  console.log(`[GHL Webhook] Opportunity event: ${eventType} for location ${locationId}`);
  // Opportunity events trigger pipeline stage change notifications and workflows.
}

async function handleAppointmentEvent(
  db: any,
  eventType: string,
  locationId: string,
  payload: GHLWebhookPayload
): Promise<void> {
  console.log(`[GHL Webhook] Appointment event: ${eventType} for location ${locationId}`);
  // Appointment events can trigger reminder workflows and calendar sync.
}

async function handleFormSubmission(
  db: any,
  locationId: string,
  payload: GHLWebhookPayload
): Promise<void> {
  console.log(`[GHL Webhook] Form submission for location ${locationId}`);
  // Form submissions create/update contacts and trigger lead capture workflows.
}

async function handleMessageEvent(
  db: any,
  eventType: string,
  locationId: string,
  payload: GHLWebhookPayload
): Promise<void> {
  console.log(`[GHL Webhook] Message event: ${eventType} for location ${locationId}`);
  // Messages route to conversation inbox and can trigger response workflows.
}

async function handleCallEvent(
  db: any,
  locationId: string,
  payload: GHLWebhookPayload
): Promise<void> {
  console.log(`[GHL Webhook] Call completed for location ${locationId}`);
  // Call events can trigger follow-up workflows.
}
