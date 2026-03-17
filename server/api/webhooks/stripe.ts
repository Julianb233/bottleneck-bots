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
 * 1. Add this route to Express app BEFORE body parsers:
 *    app.use('/api/webhooks/stripe', stripeWebhookRouter)
 * 2. Configure webhook endpoint in Stripe Dashboard: https://dashboard.stripe.com/webhooks
 * 3. Set webhook URL to: https://yourdomain.com/api/webhooks/stripe
 * 4. Copy webhook signing secret to .env: STRIPE_WEBHOOK_SECRET=whsec_...
 *
 * Events Handled:
 * - checkout.session.completed: Credits purchase or subscription checkout completed
 * - invoice.paid: Recurring subscription payment succeeded — allocate credits
 * - customer.subscription.updated: Plan change (upgrade/downgrade)
 * - customer.subscription.deleted: Subscription cancelled
 * - payment_intent.succeeded: Payment succeeded
 * - payment_intent.payment_failed: Payment failed
 * - charge.refunded: Handle refunds
 */

import { Router, Request, Response, raw } from "express";
import Stripe from "stripe";
import { CreditService } from "../../services/credit.service";
import { getDb } from "../../db";
import { credit_packages } from "../../../drizzle/schema";
import {
  userSubscriptions,
  subscriptionTiers,
} from "../../../drizzle/schema-subscriptions";
import { eq, sql } from "drizzle-orm";

export const stripeWebhookRouter = Router();

// ========================================
// MIDDLEWARE
// ========================================

// Apply raw body parser BEFORE signature verification
stripeWebhookRouter.use(raw({ type: "application/json" }));

// ========================================
// HELPER: Stripe singleton
// ========================================

function getStripeClient(): Stripe | null {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) return null;
  return new Stripe(stripeSecretKey, {
    apiVersion: "2024-12-18.acacia" as any,
  });
}

// ========================================
// IDEMPOTENCY — SQL-backed via stripe_processed_events
// ========================================

/**
 * Check if Stripe event has already been processed.
 * Uses raw SQL so we don't need a Drizzle schema — the table is created by migration.
 */
async function checkProcessedEvent(eventId: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  try {
    const result = await db.execute(
      sql`SELECT id, status FROM stripe_processed_events WHERE stripe_event_id = ${eventId} LIMIT 1`
    );
    const rows = (result as any).rows || result;
    if (rows && rows.length > 0 && rows[0].status === "completed") {
      return true;
    }
    return false;
  } catch (error: any) {
    // Table may not exist yet — silently continue without idempotency
    if (error?.message?.includes("does not exist") || error?.code === "42P01") {
      return false;
    }
    console.warn("[Stripe Webhook] Idempotency check error:", error.message);
    return false;
  }
}

/**
 * Mark Stripe event as processed (upsert).
 */
async function markEventProcessed(
  eventId: string,
  eventType: string,
  status: "completed" | "failed" | "pending" = "completed",
  errorMessage?: string
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  try {
    await db.execute(
      sql`INSERT INTO stripe_processed_events (stripe_event_id, event_type, status, error_message, processed_at, created_at, updated_at)
          VALUES (${eventId}, ${eventType}, ${status}, ${errorMessage || null}, NOW(), NOW(), NOW())
          ON CONFLICT (stripe_event_id)
          DO UPDATE SET status = ${status}, error_message = ${errorMessage || null}, processed_at = NOW(), updated_at = NOW()`
    );
  } catch (error: any) {
    // Table may not exist — log and continue
    if (!error?.message?.includes("does not exist") && error?.code !== "42P01") {
      console.error("[Stripe Webhook] Failed to mark event:", error.message);
    }
  }
}

// ========================================
// EVENT HANDLERS
// ========================================

/**
 * Handle checkout.session.completed
 *
 * Two modes based on session metadata:
 * 1. Credit package purchase — metadata contains packageId & creditAmount
 * 2. Subscription checkout — metadata contains subscriptionTierSlug
 */
async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session): Promise<void> {
  const metadata = session.metadata || {};

  // --- Mode 1: Credit package purchase ---
  if (metadata.packageId && metadata.creditAmount) {
    await handleCreditPurchase(session, metadata);
    return;
  }

  // --- Mode 2: Subscription checkout ---
  if (metadata.subscriptionTierSlug && metadata.userId) {
    await handleSubscriptionCheckout(session, metadata);
    return;
  }

  // If mode is "subscription" via Stripe Checkout, the subscription is created
  // automatically by Stripe; invoice.paid will handle credit allocation.
  if (session.mode === "subscription" && session.subscription) {
    console.log(
      `[Stripe Webhook] Subscription checkout completed. Stripe sub: ${session.subscription}. Credits will be allocated on invoice.paid.`
    );

    // Link the Stripe subscription/customer to our user record
    if (metadata.userId) {
      const db = await getDb();
      if (db) {
        try {
          await db
            .update(userSubscriptions)
            .set({
              stripeCustomerId: session.customer as string,
              stripeSubscriptionId: session.subscription as string,
              updatedAt: new Date(),
            })
            .where(eq(userSubscriptions.userId, parseInt(metadata.userId)));
          console.log(`[Stripe Webhook] Linked Stripe sub ${session.subscription} to user ${metadata.userId}`);
        } catch (err) {
          console.error("[Stripe Webhook] Failed to link Stripe subscription:", err);
        }
      }
    }
    return;
  }

  console.warn("[Stripe Webhook] checkout.session.completed with unrecognised metadata:", metadata);
}

/**
 * Award credits from a one-time credit package purchase
 */
async function handleCreditPurchase(
  session: Stripe.Checkout.Session,
  metadata: Stripe.Metadata
): Promise<void> {
  const userId = parseInt(metadata.userId);
  const packageId = parseInt(metadata.packageId);
  const creditType = metadata.creditType as "enrichment" | "calling" | "scraping";
  const creditAmount = parseInt(metadata.creditAmount);

  if (!userId || !packageId || !creditType || !creditAmount) {
    throw new Error(`Invalid credit purchase metadata: ${JSON.stringify(metadata)}`);
  }

  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const packageResult = await db
    .select()
    .from(credit_packages)
    .where(eq(credit_packages.id, packageId))
    .limit(1);

  if (packageResult.length === 0) {
    throw new Error(`Package not found: ${packageId}`);
  }

  const pkg = packageResult[0];
  const creditService = new CreditService();

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
    `[Stripe Webhook] Awarded ${creditAmount} ${creditType} credits to user ${userId} (package: ${pkg.name})`
  );
}

/**
 * Activate (or re-activate) a subscription from checkout
 */
async function handleSubscriptionCheckout(
  session: Stripe.Checkout.Session,
  metadata: Stripe.Metadata
): Promise<void> {
  const userId = parseInt(metadata.userId);
  const tierSlug = metadata.subscriptionTierSlug;
  const paymentFrequency = (metadata.paymentFrequency || "monthly") as any;

  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Find the tier
  const [tier] = await db
    .select()
    .from(subscriptionTiers)
    .where(eq(subscriptionTiers.slug, tierSlug))
    .limit(1);

  if (!tier) {
    throw new Error(`Tier not found: ${tierSlug}`);
  }

  const now = new Date();
  let periodEnd: Date;
  switch (paymentFrequency) {
    case "weekly":
      periodEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      break;
    case "six_month":
      periodEnd = new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000);
      break;
    case "annual":
      periodEnd = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
      break;
    default:
      periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  }

  // Check if subscription already exists for user
  const [existing] = await db
    .select()
    .from(userSubscriptions)
    .where(eq(userSubscriptions.userId, userId))
    .limit(1);

  if (existing) {
    // Re-activate / update existing subscription
    await db
      .update(userSubscriptions)
      .set({
        tierId: tier.id,
        status: "active",
        paymentFrequency,
        stripeCustomerId: session.customer as string,
        stripeSubscriptionId: session.subscription as string || existing.stripeSubscriptionId,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        executionsUsedThisPeriod: 0,
        agentsSpawnedThisPeriod: 0,
        cancelAtPeriodEnd: false,
        cancelledAt: null,
        cancellationReason: null,
        updatedAt: now,
      })
      .where(eq(userSubscriptions.userId, userId));
  } else {
    // Create new subscription
    await db.insert(userSubscriptions).values({
      userId,
      tierId: tier.id,
      status: "active",
      paymentFrequency,
      stripeCustomerId: session.customer as string,
      stripeSubscriptionId: session.subscription as string || null,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
    });
  }

  console.log(
    `[Stripe Webhook] Subscription activated for user ${userId}: ${tier.name} (${paymentFrequency})`
  );
}

/**
 * Handle invoice.paid — recurring subscription payment succeeded.
 * This is the primary event for allocating monthly credits on renewal.
 */
async function handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
  // Access subscription via any — the Stripe SDK type may differ across API versions
  const subscriptionId = (invoice as any).subscription as string;
  if (!subscriptionId) {
    console.log("[Stripe Webhook] invoice.paid without subscription — skipping (one-time payment)");
    return;
  }

  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Find user by Stripe subscription ID
  const [subscription] = await db
    .select()
    .from(userSubscriptions)
    .where(eq(userSubscriptions.stripeSubscriptionId, subscriptionId))
    .limit(1);

  if (!subscription) {
    console.warn(`[Stripe Webhook] No local subscription found for Stripe sub ${subscriptionId}`);
    return;
  }

  // Get the tier to determine execution limits
  const [tier] = await db
    .select()
    .from(subscriptionTiers)
    .where(eq(subscriptionTiers.id, subscription.tierId))
    .limit(1);

  if (!tier) {
    console.error(`[Stripe Webhook] Tier ${subscription.tierId} not found`);
    return;
  }

  // Determine billing period from invoice lines
  const invoiceAny = invoice as any;
  const periodStart = invoiceAny.period_start
    ? new Date(invoiceAny.period_start * 1000)
    : new Date();
  const periodEnd = invoiceAny.period_end
    ? new Date(invoiceAny.period_end * 1000)
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  // Reset usage counters for the new billing period and mark active
  await db
    .update(userSubscriptions)
    .set({
      status: "active",
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      executionsUsedThisPeriod: 0,
      agentsSpawnedThisPeriod: 0,
      additionalExecutions: 0,
      updatedAt: new Date(),
    })
    .where(eq(userSubscriptions.id, subscription.id));

  console.log(
    `[Stripe Webhook] Invoice paid — renewed ${tier.name} for user ${subscription.userId}. ` +
    `Period: ${periodStart.toISOString()} → ${periodEnd.toISOString()}, ` +
    `Execution limit: ${tier.monthlyExecutionLimit}`
  );
}

/**
 * Handle customer.subscription.updated — tier change (upgrade/downgrade), status changes
 */
async function handleSubscriptionUpdated(stripeSubscription: Stripe.Subscription): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [subscription] = await db
    .select()
    .from(userSubscriptions)
    .where(eq(userSubscriptions.stripeSubscriptionId, stripeSubscription.id))
    .limit(1);

  if (!subscription) {
    console.warn(`[Stripe Webhook] No local subscription for Stripe sub ${stripeSubscription.id}`);
    return;
  }

  // Map Stripe status to our status
  const statusMap: Record<string, string> = {
    active: "active",
    past_due: "past_due",
    canceled: "cancelled",
    unpaid: "past_due",
    incomplete: "active",
    incomplete_expired: "cancelled",
    trialing: "trial",
    paused: "paused",
  };

  const newStatus = statusMap[stripeSubscription.status] || "active";

  // Check if the Stripe subscription has metadata indicating a tier change
  const newTierSlug = stripeSubscription.metadata?.tierSlug;
  let tierId = subscription.tierId;

  if (newTierSlug) {
    const [newTier] = await db
      .select()
      .from(subscriptionTiers)
      .where(eq(subscriptionTiers.slug, newTierSlug))
      .limit(1);

    if (newTier) {
      tierId = newTier.id;
      console.log(
        `[Stripe Webhook] Tier changed to ${newTier.name} for user ${subscription.userId}`
      );
    }
  }

  // Update period from Stripe data — use `as any` for cross-version compatibility
  const subAny = stripeSubscription as any;
  const periodStart = subAny.current_period_start
    ? new Date(subAny.current_period_start * 1000)
    : subscription.currentPeriodStart;
  const periodEnd = subAny.current_period_end
    ? new Date(subAny.current_period_end * 1000)
    : subscription.currentPeriodEnd;

  await db
    .update(userSubscriptions)
    .set({
      tierId,
      status: newStatus,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end || false,
      updatedAt: new Date(),
    })
    .where(eq(userSubscriptions.id, subscription.id));

  console.log(
    `[Stripe Webhook] Subscription updated for user ${subscription.userId}: status=${newStatus}, cancelAtPeriodEnd=${stripeSubscription.cancel_at_period_end}`
  );
}

/**
 * Handle customer.subscription.deleted — subscription fully cancelled
 */
async function handleSubscriptionDeleted(stripeSubscription: Stripe.Subscription): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [subscription] = await db
    .select()
    .from(userSubscriptions)
    .where(eq(userSubscriptions.stripeSubscriptionId, stripeSubscription.id))
    .limit(1);

  if (!subscription) {
    console.warn(`[Stripe Webhook] No local subscription for Stripe sub ${stripeSubscription.id}`);
    return;
  }

  await db
    .update(userSubscriptions)
    .set({
      status: "cancelled",
      cancelledAt: new Date(),
      cancellationReason: stripeSubscription.cancellation_details?.reason || "stripe_deleted",
      updatedAt: new Date(),
    })
    .where(eq(userSubscriptions.id, subscription.id));

  console.log(
    `[Stripe Webhook] Subscription deleted/cancelled for user ${subscription.userId}`
  );
}

/**
 * Handle payment_intent.succeeded
 */
async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent): Promise<void> {
  console.log("[Stripe Webhook] Payment intent succeeded:", paymentIntent.id);
}

/**
 * Handle payment_intent.payment_failed — update subscription status to past_due
 */
async function handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent): Promise<void> {
  console.error("[Stripe Webhook] Payment intent failed:", paymentIntent.id);

  // If this is tied to a subscription invoice, mark subscription as past_due
  const piAny = paymentIntent as any;
  if (piAny.invoice) {
    const db = await getDb();
    if (!db) return;

    const stripe = getStripeClient();
    if (!stripe) return;

    try {
      const invoice = await stripe.invoices.retrieve(piAny.invoice as string);
      const invoiceSub = (invoice as any).subscription;
      if (invoiceSub) {
        await db
          .update(userSubscriptions)
          .set({
            status: "past_due",
            updatedAt: new Date(),
          })
          .where(eq(userSubscriptions.stripeSubscriptionId, invoiceSub as string));

        console.log(`[Stripe Webhook] Marked subscription ${invoiceSub} as past_due`);
      }
    } catch (err) {
      console.error("[Stripe Webhook] Error handling payment failure:", err);
    }
  }
}

/**
 * Handle charge.refunded
 */
async function handleChargeRefunded(charge: Stripe.Charge): Promise<void> {
  console.log("[Stripe Webhook] Charge refunded:", charge.id);

  if (!charge.payment_intent) {
    console.error("[Stripe Webhook] No payment intent for refunded charge");
    return;
  }

  const stripe = getStripeClient();
  if (!stripe) {
    console.error("[Stripe Webhook] Stripe not configured");
    return;
  }

  try {
    const sessions = await stripe.checkout.sessions.list({
      payment_intent: charge.payment_intent as string,
      limit: 1,
    });

    if (sessions.data.length === 0) {
      console.warn("[Stripe Webhook] No checkout session found for refunded charge");
      return;
    }

    const session = sessions.data[0];
    const metadata = session.metadata;

    if (!metadata || !metadata.userId || !metadata.creditAmount || !metadata.creditType) {
      console.warn("[Stripe Webhook] Missing metadata on refunded session — skipping credit clawback");
      return;
    }

    const userId = parseInt(metadata.userId);
    const creditType = metadata.creditType as "enrichment" | "calling" | "scraping";
    const creditAmount = parseInt(metadata.creditAmount);
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
        `[Stripe Webhook] Refunded ${creditAmount} ${creditType} credits from user ${userId}`
      );
    } catch (error: any) {
      // Don't throw — we don't want the webhook to fail for credit clawback issues
      console.error("[Stripe Webhook] Failed to claw back credits on refund:", error.message);
    }
  } catch (error: any) {
    console.error("[Stripe Webhook] Error handling refund:", error.message);
  }
}

// ========================================
// WEBHOOK ENDPOINT
// ========================================

/**
 * Main Stripe webhook endpoint
 * POST /api/webhooks/stripe
 */
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

  let event: Stripe.Event;

  try {
    const stripe = new Stripe(stripeSecretKey, { apiVersion: "2024-12-18.acacia" as any });
    event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret);
  } catch (error: any) {
    console.error("[Stripe Webhook] Signature verification failed:", error.message);
    return res.status(401).json({ error: "Invalid signature", received: false });
  }

  console.log(`[Stripe Webhook] Received event: ${event.type} (ID: ${event.id})`);

  // Idempotency check
  const alreadyProcessed = await checkProcessedEvent(event.id);
  if (alreadyProcessed) {
    console.log(`[Stripe Webhook] Event ${event.id} already processed, skipping`);
    return res.json({ received: true, alreadyProcessed: true });
  }

  // Mark as pending
  await markEventProcessed(event.id, event.type, "pending");

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case "invoice.paid":
        await handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;

      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case "payment_intent.succeeded":
        await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;

      case "payment_intent.payment_failed":
        await handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
        break;

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
});

/**
 * Health check endpoint
 * GET /api/webhooks/stripe
 */
stripeWebhookRouter.get("/", (_req: Request, res: Response) => {
  return res.json({
    status: "ok",
    message: "Stripe webhook endpoint is active",
    configurationStatus: {
      hasSecret: !!process.env.STRIPE_WEBHOOK_SECRET,
      hasApiKey: !!process.env.STRIPE_SECRET_KEY,
    },
  });
});

export default stripeWebhookRouter;
