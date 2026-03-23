/**
 * GHL Webhook Receiver
 *
 * Express routes for receiving inbound webhooks from GoHighLevel.
 * Handles contact events, opportunity events, and campaign events
 * for lead routing and data flow synchronization.
 *
 * Routes:
 *   POST /api/ghl/webhooks/inbound — receive GHL webhook events
 *   GET  /api/ghl/webhooks/health  — health check
 *
 * Linear: AI-3461
 */

import express, { Request, Response } from "express";
import crypto from "crypto";

const webhookRouter = express.Router();

// ========================================
// TYPES
// ========================================

interface GHLWebhookEvent {
  type: string;
  locationId?: string;
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

type WebhookHandler = (event: GHLWebhookEvent) => Promise<void>;

// ========================================
// EVENT HANDLERS
// ========================================

const eventHandlers: Record<string, WebhookHandler> = {
  "ContactCreate": async (event) => {
    console.log("[GHL Webhook] New contact created:", {
      contactId: event.contact?.id,
      name: `${event.contact?.firstName || ""} ${event.contact?.lastName || ""}`.trim(),
      email: event.contact?.email,
      source: event.contact?.source,
      locationId: event.locationId,
    });
    // Lead routing logic: tag-based routing happens in GHL workflows,
    // but we log and can trigger internal automations here
  },

  "ContactUpdate": async (event) => {
    console.log("[GHL Webhook] Contact updated:", {
      contactId: event.contact?.id,
      locationId: event.locationId,
    });
  },

  "ContactTagUpdate": async (event) => {
    console.log("[GHL Webhook] Contact tags changed:", {
      contactId: event.contact?.id,
      tags: event.contact?.tags,
      locationId: event.locationId,
    });
  },

  "OpportunityCreate": async (event) => {
    console.log("[GHL Webhook] New opportunity:", {
      opportunityId: event.opportunity?.id,
      name: event.opportunity?.name,
      pipelineId: event.opportunity?.pipelineId,
      stageId: event.opportunity?.pipelineStageId,
      contactId: event.opportunity?.contactId,
      value: event.opportunity?.monetaryValue,
      locationId: event.locationId,
    });
  },

  "OpportunityStageUpdate": async (event) => {
    console.log("[GHL Webhook] Opportunity stage changed:", {
      opportunityId: event.opportunity?.id,
      newStage: event.opportunity?.pipelineStageId,
      status: event.opportunity?.status,
      locationId: event.locationId,
    });
  },

  "OpportunityStatusUpdate": async (event) => {
    console.log("[GHL Webhook] Opportunity status changed:", {
      opportunityId: event.opportunity?.id,
      status: event.opportunity?.status,
      locationId: event.locationId,
    });
  },

  "CampaignStatusUpdate": async (event) => {
    console.log("[GHL Webhook] Campaign status update:", {
      campaignId: event.campaign?.id,
      contactId: event.contactId,
      locationId: event.locationId,
    });
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
    console.warn("[GHL Webhook] Invalid signature, rejecting");
    res.status(401).json({ error: "Invalid webhook signature" });
    return;
  }

  let event: GHLWebhookEvent;
  try {
    event = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  } catch {
    console.error("[GHL Webhook] Failed to parse body");
    res.status(400).json({ error: "Invalid JSON body" });
    return;
  }

  const eventType = event.type;
  if (!eventType) {
    console.warn("[GHL Webhook] Missing event type");
    res.status(400).json({ error: "Missing event type" });
    return;
  }

  console.log(`[GHL Webhook] Received event: ${eventType}`, {
    locationId: event.locationId,
    timestamp: event.timestamp || new Date().toISOString(),
  });

  // Respond immediately (GHL expects quick 200)
  res.status(200).json({ received: true, type: eventType });

  // Process event asynchronously
  const handler = eventHandlers[eventType];
  if (handler) {
    try {
      await handler(event);
    } catch (err) {
      console.error(`[GHL Webhook] Error handling ${eventType}:`, err);
    }
  } else {
    console.log(`[GHL Webhook] No handler for event type: ${eventType}`);
  }
});

// ========================================
// HEALTH CHECK
// ========================================

webhookRouter.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    service: "ghl-webhooks",
    configured: !!process.env.GHL_WEBHOOK_SECRET,
    supportedEvents: Object.keys(eventHandlers),
    timestamp: new Date().toISOString(),
  });
});

export default webhookRouter;
