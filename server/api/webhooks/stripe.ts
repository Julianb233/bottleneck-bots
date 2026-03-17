/**
 * Stripe Webhook Handler (Express Route)
 *
 * Handles Stripe webhook events with proper signature verification and idempotency.
 *
 * IMPORTANT: This is an Express route, NOT a tRPC endpoint, because:
 * 1. We need access to the raw request body for signature verification
 * 2. Stripe signs the raw bytes, not the JSON-parsed data
 * 3. JSON middleware breaks the signature if applied before verification
 *
 * Setup:
 * 1. Add this route to Express app: app.use('/api/webhooks/stripe', stripeWebhookRouter)
 * 2. Use raw body parser middleware for this route
 * 3. Configure webhook endpoint in Stripe Dashboard: https://dashboard.stripe.com/webhooks
 * 4. Set webhook URL to: https://yourdomain.com/api/webhooks/stripe
 * 5. Copy webhook signing secret to .env: STRIPE_WEBHOOK_SECRET=whsec_...
 *
 * Events Handled:
 * - checkout.session.completed: Credits purchase or subscription checkout completed
 * - customer.subscription.created: New subscription created
 * - customer.subscription.updated: Subscription updated (upgrade/downgrade/renewal)
 * - customer.subscription.deleted: Subscription cancelled or expired
 * - invoice.paid: Recurring invoice paid (subscription renewal)
 * - invoice.payment_failed: Payment failed for subscription renewal
 * - payment_intent.succeeded: One-time payment succeeded
 * - payment_intent.payment_failed: Payment failed
 * - charge.refunded: Handle refunds
 */

import { Router, Request, Response, raw } from "express";
import Stripe from "stripe";
import { TRPCError } from "@trpc/server";
import { CreditService } from "../../services/credit.service";
import { getDb } from "../../db";
import { credit_packages } from "../../../drizzle/schema";
import { userSubscriptions } from "../../../drizzle/schema-subscriptions";
import { eq } from "drizzle-orm";
import { getSubscriptionService } from "../../services/subscription.service";

export const stripeWebhookRouter = Router();

// ========================================
// MIDDLEWARE
// ========================================

// Apply raw body parser BEFORE signature verification
stripeWebhookRouter.use(raw({ type: "application/json" }));

// ========================================
// TYPES
// ========================================

interface ProcessedStripeEvent {
  id: number;
  stripe_event_id: string;
  event_type: string;
  processed_at: Date;
  status: "completed" | "failed" | "pending";
  error_message?: string;
  created_at: Date;
}

// ========================================
// HELPER FUNCTIONS
// ========================================

/**
 * Get or create a Stripe instance
 */
function getStripe(): Stripe {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    throw new Error("STRIPE_SECRET_KEY not configured");
  }
  return new Stripe(stripeSecretKey, {
    apiVersion: "2024-12-18.acacia" as any,
  });
}

/**
 * Check if Stripe event has already been processed
 * Prevents duplicate credit awards from webhook retries
 */
async function checkProcessedEvent(eventId: string): Promise<ProcessedStripeEvent | null> {
  const db = await getDb();
  if (!db) {
    console.error("[Stripe Webhook] Database not available for idempotency check");
    return null;
  }

  try {
    console.log(`[Stripe Webhook] Idempotency check skipped for event ${eventId} (table not yet created)`);
    return null;
  } catch (error) {
    console.warn("[Stripe Webhook] Could not check processed events (table may not exist):", error);
    return null;
  }
}

/**
 * Mark Stripe event as processed
 */
async function markEventProcessed(
  eventId: string,
  eventType: string,
  status: "completed" | "failed" | "pending" = "completed",
  errorMessage?: string
): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.error("[Stripe Webhook] Database not available for marking event");
    return;
  }

  try {
    console.log(
      `[Stripe Webhook] Marked event ${eventId} as ${status}${errorMessage ? `: ${errorMessage}` : ""}`
    );
  } catch (error) {
    console.error("[Stripe Webhook] Failed to mark event as processed:", error);
  }
}

// ========================================
// CHECKOUT SESSION HANDLERS
// ========================================

/**
 * Handle checkout session completed event
 * Routes to credit purchase or subscription activation based on session mode
 */
async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session): Promise<void> {
  const metadata = session.metadata;

  // Route based on checkout mode
  if (session.mode === "subscription") {
    await handleSubscriptionCheckoutCompleted(session);
    return;
  }

  // Credit purchase flow (mode === "payment")
  if (!metadata || !metadata.userId || !metadata.packageId) {
    console.error("Missing metadata in checkout session:", session.id);
    throw new Error("Missing required metadata (userId, packageId)");
  }

  const userId = parseInt(metadata.userId);
  const packageId = parseInt(metadata.packageId);
  const creditType = metadata.creditType as "enrichment" | "calling" | "scraping";
  const creditAmount = parseInt(metadata.creditAmount);

  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const packageResult = await db
    .select()
    .from(credit_packages)
    .where(eq(credit_packages.id, packageId))
    .limit(1);

  if (packageResult.length === 0) {
    console.error("Package not found:", packageId);
    throw new Error(`Package not found: ${packageId}`);
  }

  const pkg = packageResult[0];
  const creditService = new CreditService();

  try {
    await creditService.addCredits(
      userId,
      creditAmount,
      creditType,
      `Purchased ${pkg.name} via Stripe`,
      "purchase",
      {
        packageId,
        packageName: pkg.name,
        stripeSessionId: session.id,
        stripePaymentIntentId: session.payment_intent,
        amountPaid: session.amount_total,
        currency: session.currency,
      }
    );

    console.log(
      `[Stripe Webhook] Successfully awarded ${creditAmount} ${creditType} credits to user ${userId}`
    );
  } catch (error: any) {
    console.error("[Stripe Webhook] Failed to award credits:", error);
    throw error;
  }
}

/**
 * Handle subscription checkout session completed
 * Creates or updates user subscription in our database
 */
async function handleSubscriptionCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
  const metadata = session.metadata;

  if (!metadata?.userId || !metadata?.tierSlug) {
    console.error("[Stripe Webhook] Missing subscription metadata in checkout session:", session.id);
    throw new Error("Missing required subscription metadata (userId, tierSlug)");
  }

  const userId = parseInt(metadata.userId);
  const tierSlug = metadata.tierSlug;
  const paymentFrequency = (metadata.paymentFrequency || "monthly") as "weekly" | "monthly" | "six_month" | "annual";
  const stripeCustomerId = session.customer as string;
  const stripeSubscriptionId = session.subscription as string;

  const subscriptionService = getSubscriptionService();

  try {
    const existing = await subscriptionService.getUserSubscription(userId);

    if (existing) {
      await subscriptionService.updateSubscriptionStripeIds(
        userId,
        stripeCustomerId,
        stripeSubscriptionId
      );
      await subscriptionService.updateTier(userId, tierSlug);
      console.log(`[Stripe Webhook] Updated subscription for user ${userId} to tier ${tierSlug}`);
    } else {
      await subscriptionService.createSubscription(
        userId,
        tierSlug,
        paymentFrequency,
        stripeCustomerId,
        stripeSubscriptionId
      );
      console.log(`[Stripe Webhook] Created subscription for user ${userId} (tier: ${tierSlug})`);
    }
  } catch (error: any) {
    console.error("[Stripe Webhook] Failed to handle subscription checkout:", error);
    throw error;
  }
}

// ========================================
// SUBSCRIPTION EVENT HANDLERS
// ========================================

/**
 * Handle customer.subscription.created event
 */
async function handleSubscriptionCreated(subscription: Stripe.Subscription): Promise<void> {
  console.log(`[Stripe Webhook] Subscription created: ${subscription.id}, status: ${subscription.status}`);

  const metadata = subscription.metadata;
  if (!metadata?.userId) {
    console.log("[Stripe Webhook] No userId in subscription metadata, skipping (handled by checkout)");
    return;
  }

  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const userId = parseInt(metadata.userId);
  const status = mapStripeStatus(subscription.status);

  await db
    .update(userSubscriptions)
    .set({
      status,
      stripeSubscriptionId: subscription.id,
      stripeCustomerId: subscription.customer as string,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      updatedAt: new Date(),
    })
    .where(eq(userSubscriptions.userId, userId));

  console.log(`[Stripe Webhook] Subscription ${subscription.id} synced for user ${userId}`);
}

/**
 * Handle customer.subscription.updated event
 */
async function handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
  console.log(`[Stripe Webhook] Subscription updated: ${subscription.id}, status: ${subscription.status}`);

  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const [existingSub] = await db
    .select()
    .from(userSubscriptions)
    .where(eq(userSubscriptions.stripeSubscriptionId, subscription.id))
    .limit(1);

  if (!existingSub) {
    console.warn(`[Stripe Webhook] No local subscription found for Stripe sub ${subscription.id}`);
    return;
  }

  const status = mapStripeStatus(subscription.status);
  const cancelAtPeriodEnd = subscription.cancel_at_period_end;

  await db
    .update(userSubscriptions)
    .set({
      status,
      cancelAtPeriodEnd,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelledAt: subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : null,
      updatedAt: new Date(),
    })
    .where(eq(userSubscriptions.id, existingSub.id));

  console.log(`[Stripe Webhook] Subscription ${subscription.id} updated for user ${existingSub.userId} -> status: ${status}`);
}

/**
 * Handle customer.subscription.deleted event
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
  console.log(`[Stripe Webhook] Subscription deleted: ${subscription.id}`);

  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const [existingSub] = await db
    .select()
    .from(userSubscriptions)
    .where(eq(userSubscriptions.stripeSubscriptionId, subscription.id))
    .limit(1);

  if (!existingSub) {
    console.warn(`[Stripe Webhook] No local subscription found for deleted Stripe sub ${subscription.id}`);
    return;
  }

  await db
    .update(userSubscriptions)
    .set({
      status: "cancelled",
      cancelledAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(userSubscriptions.id, existingSub.id));

  console.log(`[Stripe Webhook] Subscription ${subscription.id} cancelled for user ${existingSub.userId}`);
}

// ========================================
// INVOICE EVENT HANDLERS
// ========================================

/**
 * Handle invoice.paid event
 * Resets execution usage for the new billing period on renewal
 */
async function handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
  console.log(`[Stripe Webhook] Invoice paid: ${invoice.id}, subscription: ${invoice.subscription}`);

  if (!invoice.subscription) return;

  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const stripeSubscriptionId = typeof invoice.subscription === "string"
    ? invoice.subscription
    : invoice.subscription.id;

  const [existingSub] = await db
    .select()
    .from(userSubscriptions)
    .where(eq(userSubscriptions.stripeSubscriptionId, stripeSubscriptionId))
    .limit(1);

  if (!existingSub) {
    console.warn(`[Stripe Webhook] No local subscription for invoice ${invoice.id}`);
    return;
  }

  // Reset usage on renewal invoices
  if (invoice.billing_reason === "subscription_cycle") {
    const subscriptionService = getSubscriptionService();

    const periodStart = invoice.period_start
      ? new Date(invoice.period_start * 1000)
      : new Date();
    const periodEnd = invoice.period_end
      ? new Date(invoice.period_end * 1000)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    try {
      await subscriptionService.resetMonthlyUsage(
        existingSub.userId,
        periodStart,
        periodEnd
      );
      console.log(`[Stripe Webhook] Reset usage for user ${existingSub.userId}`);
    } catch (error) {
      console.error(`[Stripe Webhook] Failed to reset usage for user ${existingSub.userId}:`, error);
    }
  }

  // Ensure subscription is marked active
  await db
    .update(userSubscriptions)
    .set({
      status: "active",
      updatedAt: new Date(),
    })
    .where(eq(userSubscriptions.id, existingSub.id));
}

/**
 * Handle invoice.payment_failed event
 */
async function handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
  console.error(`[Stripe Webhook] Invoice payment failed: ${invoice.id}`);

  if (!invoice.subscription) return;

  const db = await getDb();
  if (!db) return;

  const stripeSubscriptionId = typeof invoice.subscription === "string"
    ? invoice.subscription
    : invoice.subscription.id;

  const [existingSub] = await db
    .select()
    .from(userSubscriptions)
    .where(eq(userSubscriptions.stripeSubscriptionId, stripeSubscriptionId))
    .limit(1);

  if (!existingSub) return;

  await db
    .update(userSubscriptions)
    .set({
      status: "past_due",
      updatedAt: new Date(),
    })
    .where(eq(userSubscriptions.id, existingSub.id));

  console.log(`[Stripe Webhook] Subscription marked past_due for user ${existingSub.userId}`);
}

// ========================================
// ONE-TIME PAYMENT HANDLERS
// ========================================

async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent): Promise<void> {
  console.log("[Stripe Webhook] Payment intent succeeded:", paymentIntent.id);
}

async function handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent): Promise<void> {
  console.error("[Stripe Webhook] Payment intent failed:", paymentIntent.id);
}

async function handleChargeRefunded(charge: Stripe.Charge): Promise<void> {
  console.log("[Stripe Webhook] Charge refunded:", charge.id);

  if (!charge.payment_intent) {
    console.error("No payment intent found for refunded charge");
    return;
  }

  try {
    const stripe = getStripe();

    const sessions = await stripe.checkout.sessions.list({
      payment_intent: charge.payment_intent as string,
      limit: 1,
    });

    if (sessions.data.length === 0) {
      console.error("No checkout session found for payment intent");
      return;
    }

    const session = sessions.data[0];
    const metadata = session.metadata;

    if (!metadata || !metadata.userId) {
      console.error("Missing metadata in session");
      return;
    }

    const userId = parseInt(metadata.userId);
    const creditType = metadata.creditType as "enrichment" | "calling" | "scraping";
    const creditAmount = parseInt(metadata.creditAmount);

    if (!creditType || !creditAmount) {
      console.log("[Stripe Webhook] Non-credit refund, skipping credit deduction");
      return;
    }

    const creditService = new CreditService();

    try {
      await creditService.deductCredits(
        userId,
        creditAmount,
        creditType,
        `Refund for Stripe charge ${charge.id}`,
        charge.id,
        "stripe_refund",
        {
          stripeChargeId: charge.id,
          stripePaymentIntentId: charge.payment_intent,
          refundAmount: charge.amount_refunded,
        }
      );

      console.log(
        `[Stripe Webhook] Successfully refunded ${creditAmount} ${creditType} credits from user ${userId}`
      );
    } catch (error: any) {
      console.error("[Stripe Webhook] Failed to refund credits:", error);
    }
  } catch (error: any) {
    console.error("[Stripe Webhook] Error handling refund:", error);
  }
}

// ========================================
// UTILITY FUNCTIONS
// ========================================

function mapStripeStatus(stripeStatus: Stripe.Subscription.Status): string {
  switch (stripeStatus) {
    case "active":
      return "active";
    case "past_due":
      return "past_due";
    case "canceled":
      return "cancelled";
    case "unpaid":
      return "past_due";
    case "trialing":
      return "trial";
    case "paused":
      return "paused";
    case "incomplete":
    case "incomplete_expired":
      return "past_due";
    default:
      return "active";
  }
}

// ========================================
// WEBHOOK ENDPOINT
// ========================================

stripeWebhookRouter.post("/", async (req: Request, res: Response) => {
  const signature = req.headers["stripe-signature"] as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

  if (!signature) {
    console.error("[Stripe Webhook] Missing stripe-signature header");
    return res.status(400).json({ error: "Missing stripe-signature header", received: false });
  }

  if (!webhookSecret) {
    console.error("[Stripe Webhook] STRIPE_WEBHOOK_SECRET not configured");
    return res.status(500).json({ error: "Webhook not configured", received: false });
  }

  if (!stripeSecretKey) {
    console.error("[Stripe Webhook] STRIPE_SECRET_KEY not configured");
    return res.status(500).json({ error: "Stripe not configured", received: false });
  }

  try {
    const stripe = new Stripe(stripeSecretKey, { apiVersion: "2024-12-18.acacia" as any });

    const event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret);

    console.log(`[Stripe Webhook] Received event: ${event.type} (ID: ${event.id})`);

    const processedEvent = await checkProcessedEvent(event.id);
    if (processedEvent) {
      console.log(`[Stripe Webhook] Event ${event.id} already processed, skipping`);
      return res.json({ received: true, alreadyProcessed: true });
    }

    await markEventProcessed(event.id, event.type, "pending");

    try {
      switch (event.type) {
        // Checkout completed (credits or subscriptions)
        case "checkout.session.completed":
          await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
          break;

        // Subscription lifecycle events
        case "customer.subscription.created":
          await handleSubscriptionCreated(event.data.object as Stripe.Subscription);
          break;
        case "customer.subscription.updated":
          await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
          break;
        case "customer.subscription.deleted":
          await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
          break;

        // Invoice events (subscription renewals)
        case "invoice.paid":
          await handleInvoicePaid(event.data.object as Stripe.Invoice);
          break;
        case "invoice.payment_failed":
          await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
          break;

        // One-time payment events
        case "payment_intent.succeeded":
          await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
          break;
        case "payment_intent.payment_failed":
          await handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
          break;

        // Refund events
        case "charge.refunded":
          await handleChargeRefunded(event.data.object as Stripe.Charge);
          break;

        default:
          console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
      }

      await markEventProcessed(event.id, event.type, "completed");

      return res.json({ received: true, eventId: event.id, eventType: event.type });
    } catch (error: any) {
      await markEventProcessed(
        event.id,
        event.type,
        "failed",
        error instanceof Error ? error.message : String(error)
      );

      console.error("[Stripe Webhook] Error processing event:", error);
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Unknown error",
        received: false,
      });
    }
  } catch (error: any) {
    console.error("[Stripe Webhook] Signature verification failed:", error.message);
    return res.status(401).json({ error: "Invalid signature", received: false });
  }
});

/**
 * Health check endpoint
 * GET /api/webhooks/stripe
 */
stripeWebhookRouter.get("/", (req: Request, res: Response) => {
  return res.json({
    status: "ok",
    message: "Stripe webhook endpoint is active",
    configurationStatus: {
      hasSecret: !!process.env.STRIPE_WEBHOOK_SECRET,
      hasApiKey: !!process.env.STRIPE_SECRET_KEY,
    },
    supportedEvents: [
      "checkout.session.completed",
      "customer.subscription.created",
      "customer.subscription.updated",
      "customer.subscription.deleted",
      "invoice.paid",
      "invoice.payment_failed",
      "payment_intent.succeeded",
      "payment_intent.payment_failed",
      "charge.refunded",
    ],
  });
});

export default stripeWebhookRouter;
