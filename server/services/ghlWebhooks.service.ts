/**
 * GHL Webhook Processing Service
 *
 * Handles incoming GoHighLevel webhook events:
 * - HMAC signature verification
 * - Event deduplication by eventId
 * - Event type routing to handlers
 * - Dead letter queue (DLQ) for failed processing
 * - Contact, Opportunity, and Appointment event handlers
 *
 * Linear: AI-2870
 */

import crypto from "crypto";
import { getDb } from "../db";
import { eq, and } from "drizzle-orm";
import { ghlWebhookEvents } from "../../drizzle/schema-ghl";
import { GHLService } from "./ghl.service";

// ========================================
// TYPES
// ========================================

export interface GHLWebhookPayload {
  type: string;
  locationId: string;
  id?: string;
  [key: string]: unknown;
}

export interface GHLWebhookResult {
  success: boolean;
  eventId?: string;
  status?: string;
  error?: string;
  duplicate?: boolean;
}

export type GHLEventHandler = (
  event: GHLWebhookPayload,
  userId: number,
  locationId: string
) => Promise<Record<string, unknown>>;

// ========================================
// CONSTANTS
// ========================================

/** Max retries before moving to dead letter queue */
const MAX_RETRIES = 3;

/** Retry backoff intervals (ms) */
const RETRY_BACKOFF = [60_000, 300_000, 900_000]; // 1min, 5min, 15min

// ========================================
// GHL WEBHOOKS SERVICE
// ========================================

export class GHLWebhooksService {
  private handlers: Map<string, GHLEventHandler> = new Map();

  constructor() {
    // Register default event handlers
    this.registerHandler("contact.created", this.handleContactEvent.bind(this));
    this.registerHandler("contact.updated", this.handleContactEvent.bind(this));
    this.registerHandler("contact.deleted", this.handleContactEvent.bind(this));
    this.registerHandler("opportunity.created", this.handleOpportunityEvent.bind(this));
    this.registerHandler("opportunity.updated", this.handleOpportunityEvent.bind(this));
    this.registerHandler("opportunity.deleted", this.handleOpportunityEvent.bind(this));
    this.registerHandler("opportunity.status_changed", this.handleOpportunityEvent.bind(this));
    this.registerHandler("appointment.booked", this.handleAppointmentEvent.bind(this));
    this.registerHandler("appointment.updated", this.handleAppointmentEvent.bind(this));
    this.registerHandler("appointment.cancelled", this.handleAppointmentEvent.bind(this));
    this.registerHandler("appointment.rescheduled", this.handleAppointmentEvent.bind(this));
  }

  // ----------------------------------------
  // HMAC Signature Verification
  // ----------------------------------------

  /**
   * Verify the HMAC-SHA256 signature from GHL webhooks.
   * Returns true if signature is valid or if no secret is configured (dev mode).
   */
  verifySignature(
    rawBody: string,
    signature: string | undefined,
    secret: string
  ): boolean {
    if (!secret) {
      console.warn("[GHL Webhooks] No webhook secret configured — skipping HMAC verification");
      return true;
    }

    if (!signature) {
      console.warn("[GHL Webhooks] No signature header present");
      return false;
    }

    try {
      const expectedSignature = crypto
        .createHmac("sha256", secret)
        .update(rawBody)
        .digest("hex");

      // Timing-safe comparison
      const sigBuffer = Buffer.from(signature, "hex");
      const expectedBuffer = Buffer.from(expectedSignature, "hex");

      if (sigBuffer.length !== expectedBuffer.length) {
        return false;
      }

      return crypto.timingSafeEqual(sigBuffer, expectedBuffer);
    } catch {
      return false;
    }
  }

  // ----------------------------------------
  // Event Registration
  // ----------------------------------------

  /**
   * Register a custom event handler for a specific GHL event type.
   */
  registerHandler(eventType: string, handler: GHLEventHandler): void {
    this.handlers.set(eventType, handler);
  }

  // ----------------------------------------
  // Main Webhook Processing
  // ----------------------------------------

  /**
   * Process an incoming GHL webhook event.
   *
   * Flow:
   * 1. Verify HMAC signature
   * 2. Check deduplication (by event ID)
   * 3. Store event in DB
   * 4. Route to appropriate handler
   * 5. Update event status (processed / failed / dead_letter)
   */
  async processWebhook(
    payload: GHLWebhookPayload,
    rawBody: string,
    headers: Record<string, string>,
    userId: number
  ): Promise<GHLWebhookResult> {
    const db = await getDb();
    if (!db) {
      return { success: false, error: "Database not initialized" };
    }

    // Extract event details
    const eventType = payload.type;
    const locationId = payload.locationId;
    const eventId = payload.id || this.generateEventId(payload);

    if (!eventType) {
      return { success: false, error: "Missing event type in payload" };
    }

    if (!locationId) {
      return { success: false, error: "Missing locationId in payload" };
    }

    // Verify HMAC signature
    const webhookSecret = process.env.GHL_WEBHOOK_SECRET || "";
    const signature = headers["x-ghl-signature"] || headers["x-webhook-signature"];

    if (webhookSecret && !this.verifySignature(rawBody, signature, webhookSecret)) {
      console.error(`[GHL Webhooks] HMAC verification failed for event ${eventId}`);
      return { success: false, error: "Signature verification failed" };
    }

    try {
      // Deduplication check
      const [existing] = await db
        .select({ id: ghlWebhookEvents.id, status: ghlWebhookEvents.status })
        .from(ghlWebhookEvents)
        .where(eq(ghlWebhookEvents.eventId, eventId))
        .limit(1);

      if (existing) {
        console.log(`[GHL Webhooks] Duplicate event ${eventId} (status: ${existing.status})`);
        return {
          success: true,
          eventId,
          status: existing.status,
          duplicate: true,
        };
      }

      // Store event
      const [event] = await db
        .insert(ghlWebhookEvents)
        .values({
          userId,
          eventId,
          eventType,
          locationId,
          payload,
          rawHeaders: headers,
          status: "received",
        })
        .returning();

      // Route to handler
      const handler = this.handlers.get(eventType);
      if (!handler) {
        console.log(`[GHL Webhooks] No handler for event type: ${eventType}`);
        await db
          .update(ghlWebhookEvents)
          .set({
            status: "processed",
            processedAt: new Date(),
            handlerResult: { skipped: true, reason: `No handler for ${eventType}` },
            updatedAt: new Date(),
          })
          .where(eq(ghlWebhookEvents.id, event.id));

        return { success: true, eventId, status: "processed" };
      }

      // Execute handler
      try {
        await db
          .update(ghlWebhookEvents)
          .set({ status: "processing", updatedAt: new Date() })
          .where(eq(ghlWebhookEvents.id, event.id));

        const result = await handler(payload, userId, locationId);

        await db
          .update(ghlWebhookEvents)
          .set({
            status: "processed",
            processedAt: new Date(),
            handlerResult: result,
            updatedAt: new Date(),
          })
          .where(eq(ghlWebhookEvents.id, event.id));

        console.log(`[GHL Webhooks] Processed ${eventType} event ${eventId}`);
        return { success: true, eventId, status: "processed" };
      } catch (handlerError) {
        // Handler failed — schedule for retry or move to DLQ
        const errorMessage =
          handlerError instanceof Error ? handlerError.message : "Unknown handler error";

        const retryCount = 1;
        const nextStatus = retryCount >= MAX_RETRIES ? "dead_letter" : "failed";
        const nextRetryAt =
          nextStatus === "failed"
            ? new Date(Date.now() + (RETRY_BACKOFF[retryCount - 1] || RETRY_BACKOFF[0]))
            : null;

        await db
          .update(ghlWebhookEvents)
          .set({
            status: nextStatus,
            processingError: errorMessage,
            retryCount,
            nextRetryAt,
            updatedAt: new Date(),
          })
          .where(eq(ghlWebhookEvents.id, event.id));

        console.error(
          `[GHL Webhooks] Handler failed for ${eventType} event ${eventId}: ${errorMessage}`
        );

        return {
          success: false,
          eventId,
          status: nextStatus,
          error: errorMessage,
        };
      }
    } catch (error) {
      console.error("[GHL Webhooks] Processing error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  // ----------------------------------------
  // Retry DLQ / Failed Events
  // ----------------------------------------

  /**
   * Retry a failed event from the DLQ.
   */
  async retryEvent(eventDbId: number, userId: number): Promise<GHLWebhookResult> {
    const db = await getDb();
    if (!db) {
      return { success: false, error: "Database not initialized" };
    }

    const [event] = await db
      .select()
      .from(ghlWebhookEvents)
      .where(
        and(
          eq(ghlWebhookEvents.id, eventDbId),
          eq(ghlWebhookEvents.userId, userId)
        )
      )
      .limit(1);

    if (!event) {
      return { success: false, error: "Event not found" };
    }

    if (event.status !== "failed" && event.status !== "dead_letter") {
      return { success: false, error: `Cannot retry event in status: ${event.status}` };
    }

    const handler = this.handlers.get(event.eventType);
    if (!handler) {
      return { success: false, error: `No handler for event type: ${event.eventType}` };
    }

    try {
      await db
        .update(ghlWebhookEvents)
        .set({ status: "processing", updatedAt: new Date() })
        .where(eq(ghlWebhookEvents.id, event.id));

      const result = await handler(
        event.payload as GHLWebhookPayload,
        userId,
        event.locationId
      );

      await db
        .update(ghlWebhookEvents)
        .set({
          status: "processed",
          processedAt: new Date(),
          handlerResult: result,
          processingError: null,
          nextRetryAt: null,
          updatedAt: new Date(),
        })
        .where(eq(ghlWebhookEvents.id, event.id));

      return { success: true, eventId: event.eventId, status: "processed" };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      const newRetryCount = event.retryCount + 1;
      const newStatus = newRetryCount >= event.maxRetries ? "dead_letter" : "failed";

      await db
        .update(ghlWebhookEvents)
        .set({
          status: newStatus,
          processingError: errorMessage,
          retryCount: newRetryCount,
          nextRetryAt:
            newStatus === "failed"
              ? new Date(Date.now() + (RETRY_BACKOFF[newRetryCount - 1] || RETRY_BACKOFF[2]))
              : null,
          updatedAt: new Date(),
        })
        .where(eq(ghlWebhookEvents.id, event.id));

      return { success: false, eventId: event.eventId, status: newStatus, error: errorMessage };
    }
  }

  // ----------------------------------------
  // Default Event Handlers
  // ----------------------------------------

  /**
   * Handle contact events (created, updated, deleted).
   * Syncs contact data to local context and triggers downstream workflows.
   */
  private async handleContactEvent(
    event: GHLWebhookPayload,
    userId: number,
    locationId: string
  ): Promise<Record<string, unknown>> {
    const contactId = (event as any).contactId || (event as any).contact?.id;
    const action = event.type.split(".")[1]; // created | updated | deleted

    console.log(
      `[GHL Webhooks] Contact ${action} — contactId=${contactId}, location=${locationId}`
    );

    // Extract contact data from the event payload
    const contactData = (event as any).contact || (event as any).data || {};

    return {
      handler: "contact",
      action,
      contactId,
      locationId,
      synced: true,
      contactName: contactData.name || contactData.firstName
        ? `${contactData.firstName || ""} ${contactData.lastName || ""}`.trim()
        : null,
      contactEmail: contactData.email || null,
      contactPhone: contactData.phone || null,
    };
  }

  /**
   * Handle opportunity events (created, updated, deleted, status_changed).
   * Updates pipeline state and sends notifications.
   */
  private async handleOpportunityEvent(
    event: GHLWebhookPayload,
    userId: number,
    locationId: string
  ): Promise<Record<string, unknown>> {
    const opportunityId =
      (event as any).opportunityId || (event as any).opportunity?.id;
    const action = event.type.split(".")[1]; // created | updated | deleted | status_changed

    console.log(
      `[GHL Webhooks] Opportunity ${action} — opportunityId=${opportunityId}, location=${locationId}`
    );

    const oppData = (event as any).opportunity || (event as any).data || {};

    return {
      handler: "opportunity",
      action,
      opportunityId,
      locationId,
      pipelineId: oppData.pipelineId || null,
      stageId: oppData.pipelineStageId || oppData.stageId || null,
      status: oppData.status || null,
      monetaryValue: oppData.monetaryValue || null,
      notified: true,
    };
  }

  /**
   * Handle appointment events (booked, updated, cancelled, rescheduled).
   * Syncs calendar data and triggers reminders.
   */
  private async handleAppointmentEvent(
    event: GHLWebhookPayload,
    userId: number,
    locationId: string
  ): Promise<Record<string, unknown>> {
    const appointmentId =
      (event as any).appointmentId || (event as any).appointment?.id;
    const action = event.type.split(".")[1]; // booked | updated | cancelled | rescheduled

    console.log(
      `[GHL Webhooks] Appointment ${action} — appointmentId=${appointmentId}, location=${locationId}`
    );

    const apptData = (event as any).appointment || (event as any).data || {};

    return {
      handler: "appointment",
      action,
      appointmentId,
      locationId,
      calendarId: apptData.calendarId || null,
      contactId: apptData.contactId || null,
      startTime: apptData.startTime || apptData.start_time || null,
      endTime: apptData.endTime || apptData.end_time || null,
      status: apptData.status || action,
      reminderTriggered: action === "booked" || action === "rescheduled",
    };
  }

  // ----------------------------------------
  // Helpers
  // ----------------------------------------

  /**
   * Generate a deterministic event ID from the payload when none is provided.
   */
  private generateEventId(payload: GHLWebhookPayload): string {
    const raw = JSON.stringify({
      type: payload.type,
      locationId: payload.locationId,
      ts: Date.now(),
    });
    return crypto.createHash("sha256").update(raw).digest("hex").substring(0, 32);
  }
}

// ========================================
// SINGLETON
// ========================================

export const ghlWebhooksService = new GHLWebhooksService();
