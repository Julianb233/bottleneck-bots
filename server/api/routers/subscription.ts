/**
 * Subscription tRPC Router
 * Handles subscription management, usage tracking, and billing operations
 */

import { z } from "zod";
import { router, protectedProcedure, publicProcedure } from "../../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getSubscriptionService } from "../../services/subscription.service";
import { TIER_SLUGS } from "../../../drizzle/schema-subscriptions";
import Stripe from "stripe";

// ========================================
// INPUT SCHEMAS
// ========================================

const getTierSchema = z.object({
  slug: z.string(),
});

const createSubscriptionSchema = z.object({
  tierSlug: z.enum(["starter", "growth", "professional", "enterprise"]),
  paymentFrequency: z.enum(["weekly", "monthly", "six_month", "annual"]).default("monthly"),
  stripePaymentMethodId: z.string().optional(),
});

const updateTierSchema = z.object({
  newTierSlug: z.enum(["starter", "growth", "professional", "enterprise"]),
});

const purchasePackSchema = z.object({
  packSlug: z.string(),
  stripePaymentIntentId: z.string().optional(),
});

const purchaseAddOnSchema = z.object({
  addOnSlug: z.string(),
  quantity: z.number().int().min(1).max(10).default(1),
});

const checkLimitSchema = z.object({
  type: z.enum(["execution", "agent", "strategy"]),
  value: z.union([z.number(), z.string()]).optional(),
});

// ========================================
// SUBSCRIPTION ROUTER
// ========================================

export const subscriptionRouter = router({
  /**
   * Get all available subscription tiers
   * Public endpoint for pricing page
   */
  getTiers: publicProcedure.query(async () => {
    try {
      const service = getSubscriptionService();
      const tiers = await service.getTiers();

      return {
        success: true,
        tiers: tiers.map((tier) => ({
          id: tier.id,
          slug: tier.slug,
          name: tier.name,
          description: tier.description,
          monthlyPrice: tier.monthlyPriceCents / 100,
          setupFee: tier.setupFeeCents / 100,
          maxAgents: tier.maxAgents,
          maxConcurrentAgents: tier.maxConcurrentAgents,
          monthlyExecutionLimit: tier.monthlyExecutionLimit,
          maxGhlAccounts: tier.maxGhlAccounts,
          features: tier.features,
          allowedStrategies: tier.allowedStrategies,
          isPopular: tier.isPopular,
          discounts: {
            weekly: -tier.weeklyPremiumPercent, // Premium, not discount
            sixMonth: tier.sixMonthDiscountPercent,
            annual: tier.annualDiscountPercent,
          },
        })),
      };
    } catch (error) {
      console.error("Failed to get tiers:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch subscription tiers",
      });
    }
  }),

  /**
   * Get current user's subscription
   */
  getMySubscription: protectedProcedure.query(async ({ ctx }) => {
    try {
      const service = getSubscriptionService();
      const subscriptionInfo = await service.getUserSubscription(ctx.user.id);

      if (!subscriptionInfo) {
        return {
          success: true,
          hasSubscription: false,
          subscription: null,
        };
      }

      const { tier, subscription, limits, usage, activePacks, activeAddOns } = subscriptionInfo;

      return {
        success: true,
        hasSubscription: true,
        subscription: {
          id: subscription.id,
          status: subscription.status,
          paymentFrequency: subscription.paymentFrequency,
          currentPeriodStart: subscription.currentPeriodStart,
          currentPeriodEnd: subscription.currentPeriodEnd,
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        },
        tier: {
          id: tier.id,
          slug: tier.slug,
          name: tier.name,
          monthlyPrice: tier.monthlyPriceCents / 100,
        },
        limits: {
          maxAgents: limits.maxAgents,
          maxConcurrentAgents: limits.maxConcurrentAgents,
          monthlyExecutionLimit: limits.monthlyExecutionLimit,
          maxExecutionDurationMinutes: limits.maxExecutionDurationMinutes,
          maxGhlAccounts: limits.maxGhlAccounts,
          features: limits.features,
          allowedStrategies: limits.allowedStrategies,
        },
        usage: {
          executionsUsed: usage.executionsUsed,
          executionsRemaining: usage.executionsRemaining,
          executionLimit: usage.executionLimit,
          additionalExecutions: usage.additionalExecutions,
          agentsUsed: usage.agentsUsed,
          agentLimit: usage.agentLimit,
          additionalAgentSlots: usage.additionalAgentSlots,
          percentUsed: usage.percentUsed,
          periodStart: usage.periodStart,
          periodEnd: usage.periodEnd,
          daysRemaining: Math.ceil(
            (usage.periodEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
          ),
        },
        activePacks: activePacks.map((pack) => ({
          id: pack.id,
          executionsRemaining: pack.executionsRemaining,
          expiresAt: pack.expiresAt,
        })),
        activeAddOns: activeAddOns.map((addOn) => ({
          id: addOn.id,
          quantity: addOn.quantity,
        })),
      };
    } catch (error) {
      console.error("Failed to get subscription:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch subscription",
      });
    }
  }),

  /**
   * Check if user can perform an action (execution, spawn agent, use strategy)
   */
  checkLimit: protectedProcedure
    .input(checkLimitSchema)
    .query(async ({ ctx, input }) => {
      try {
        const service = getSubscriptionService();
        let result;

        switch (input.type) {
          case "execution":
            result = await service.canExecuteTask(ctx.user.id);
            break;
          case "agent":
            result = await service.canSpawnAgent(
              ctx.user.id,
              typeof input.value === "number" ? input.value : 1
            );
            break;
          case "strategy":
            result = await service.canUseStrategy(
              ctx.user.id,
              typeof input.value === "string" ? input.value : "auto"
            );
            break;
          default:
            throw new Error("Invalid limit type");
        }

        return {
          success: true,
          ...result,
        };
      } catch (error) {
        console.error("Failed to check limit:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to check limit",
        });
      }
    }),

  /**
   * Create a Stripe Checkout Session for a new subscription.
   * Returns a checkout URL the client should redirect to.
   */
  createCheckoutSession: protectedProcedure
    .input(
      z.object({
        tierSlug: z.enum(["starter", "growth", "professional", "enterprise"]),
        paymentFrequency: z.enum(["weekly", "monthly", "six_month", "annual"]).default("monthly"),
        successUrl: z.string().url().optional(),
        cancelUrl: z.string().url().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
      if (!stripeSecretKey) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Stripe is not configured. Please contact support.",
        });
      }

      try {
        const service = getSubscriptionService();

        // Get tier details for pricing
        const tier = await service.getTierBySlug(input.tierSlug);
        if (!tier) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: `Tier not found: ${input.tierSlug}`,
          });
        }

        // Calculate price based on frequency
        let pricePerPeriod = tier.monthlyPriceCents;
        let intervalLabel = "month";
        switch (input.paymentFrequency) {
          case "weekly":
            pricePerPeriod = Math.round(tier.monthlyPriceCents * (1 + tier.weeklyPremiumPercent / 100) / 4);
            intervalLabel = "week";
            break;
          case "six_month":
            pricePerPeriod = Math.round(tier.monthlyPriceCents * 6 * (1 - tier.sixMonthDiscountPercent / 100));
            intervalLabel = "6 months";
            break;
          case "annual":
            pricePerPeriod = Math.round(tier.monthlyPriceCents * 12 * (1 - tier.annualDiscountPercent / 100));
            intervalLabel = "year";
            break;
        }

        const stripe = new Stripe(stripeSecretKey, { apiVersion: "2024-12-18.acacia" as any });

        const baseUrl = process.env.FRONTEND_URL || "http://localhost:5173";
        const successUrl = input.successUrl || `${baseUrl}/settings/billing?success=true`;
        const cancelUrl = input.cancelUrl || `${baseUrl}/settings/billing?canceled=true`;

        // Create a one-time checkout that will trigger subscription creation via webhook
        const session = await stripe.checkout.sessions.create({
          payment_method_types: ["card"],
          line_items: [
            {
              price_data: {
                currency: "usd",
                product_data: {
                  name: `${tier.name} Plan`,
                  description: `${tier.name} subscription — ${tier.maxAgents} agents, ${tier.monthlyExecutionLimit} executions/mo`,
                },
                unit_amount: pricePerPeriod,
              },
              quantity: 1,
            },
          ],
          mode: "payment",
          success_url: successUrl,
          cancel_url: cancelUrl,
          metadata: {
            userId: String(ctx.user.id),
            subscriptionTierSlug: input.tierSlug,
            paymentFrequency: input.paymentFrequency,
          },
        });

        return {
          success: true,
          checkoutUrl: session.url,
          sessionId: session.id,
        };
      } catch (error) {
        console.error("Failed to create checkout session:", error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create checkout session",
        });
      }
    }),

  /**
   * Create a new subscription (direct — for free tier or internal use)
   */
  create: protectedProcedure
    .input(createSubscriptionSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const service = getSubscriptionService();

        // Check if user already has subscription
        const existing = await service.getUserSubscription(ctx.user.id);
        if (existing) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "User already has an active subscription. Use updateTier instead.",
          });
        }

        const subscription = await service.createSubscription(
          ctx.user.id,
          input.tierSlug,
          input.paymentFrequency
        );

        return {
          success: true,
          subscriptionId: subscription.id,
          message: "Subscription created successfully",
        };
      } catch (error) {
        console.error("Failed to create subscription:", error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create subscription",
        });
      }
    }),

  /**
   * Upgrade/downgrade subscription tier
   * If user has a Stripe subscription, updates it via Stripe API too.
   */
  updateTier: protectedProcedure
    .input(updateTierSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const service = getSubscriptionService();
        const currentSub = await service.getUserSubscription(ctx.user.id);

        // Update local tier
        const subscription = await service.updateTier(ctx.user.id, input.newTierSlug);

        // If there's a Stripe subscription, update its metadata so the next invoice reflects the change
        if (currentSub?.subscription.stripeSubscriptionId && process.env.STRIPE_SECRET_KEY) {
          try {
            const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
              apiVersion: "2024-12-18.acacia" as any,
            });
            await stripe.subscriptions.update(currentSub.subscription.stripeSubscriptionId, {
              metadata: { tierSlug: input.newTierSlug },
            });
          } catch (stripeError) {
            console.error("Failed to update Stripe subscription metadata:", stripeError);
            // Non-fatal — local tier is already updated
          }
        }

        return {
          success: true,
          subscriptionId: subscription.id,
          newTier: input.newTierSlug,
          message: "Subscription tier updated successfully",
        };
      } catch (error) {
        console.error("Failed to update tier:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update subscription tier",
        });
      }
    }),

  /**
   * Cancel subscription
   * If Stripe-managed, cancels at period end via Stripe API.
   * Otherwise marks subscription for cancellation locally.
   */
  cancel: protectedProcedure
    .input(
      z.object({
        reason: z.string().max(500).optional(),
        cancelImmediately: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const service = getSubscriptionService();
        const currentSub = await service.getUserSubscription(ctx.user.id);

        if (!currentSub) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "No active subscription found",
          });
        }

        // If Stripe-managed, cancel through Stripe (which fires customer.subscription.updated/deleted)
        if (currentSub.subscription.stripeSubscriptionId && process.env.STRIPE_SECRET_KEY) {
          try {
            const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
              apiVersion: "2024-12-18.acacia" as any,
            });

            if (input.cancelImmediately) {
              await stripe.subscriptions.cancel(currentSub.subscription.stripeSubscriptionId);
            } else {
              await stripe.subscriptions.update(currentSub.subscription.stripeSubscriptionId, {
                cancel_at_period_end: true,
                metadata: { cancellationReason: input.reason || "user_requested" },
              });
            }
          } catch (stripeError) {
            console.error("Failed to cancel Stripe subscription:", stripeError);
            // Fall through to local cancellation
          }
        }

        // Update local record
        await service.cancelSubscription(ctx.user.id, input.reason, input.cancelImmediately);

        return {
          success: true,
          message: input.cancelImmediately
            ? "Subscription cancelled immediately"
            : "Subscription will be cancelled at end of billing period",
        };
      } catch (error) {
        console.error("Failed to cancel subscription:", error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to cancel subscription",
        });
      }
    }),

  /**
   * Get available execution packs
   */
  getExecutionPacks: protectedProcedure.query(async () => {
    try {
      const service = getSubscriptionService();
      const packs = await service.getExecutionPacks();

      return {
        success: true,
        packs: packs.map((pack) => ({
          id: pack.id,
          slug: pack.slug,
          name: pack.name,
          description: pack.description,
          executionCount: pack.executionCount,
          validForDays: pack.validForDays,
          price: pack.priceCents / 100,
          maxPerMonth: pack.maxPerMonth,
        })),
      };
    } catch (error) {
      console.error("Failed to get execution packs:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch execution packs",
      });
    }
  }),

  /**
   * Purchase an execution pack
   */
  purchasePack: protectedProcedure
    .input(purchasePackSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const service = getSubscriptionService();

        // Check if user has subscription
        const subscription = await service.getUserSubscription(ctx.user.id);
        if (!subscription) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "You need an active subscription to purchase execution packs",
          });
        }

        const purchase = await service.purchaseExecutionPack(
          ctx.user.id,
          input.packSlug,
          input.stripePaymentIntentId
        );

        return {
          success: true,
          purchaseId: purchase.id,
          executionsAdded: purchase.executionsIncluded,
          message: "Execution pack purchased successfully",
        };
      } catch (error) {
        console.error("Failed to purchase pack:", error);
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to purchase execution pack",
        });
      }
    }),

  /**
   * Get available agent add-ons
   */
  getAgentAddOns: protectedProcedure.query(async () => {
    try {
      const service = getSubscriptionService();
      const addOns = await service.getAgentAddOns();

      return {
        success: true,
        addOns: addOns.map((addOn) => ({
          id: addOn.id,
          slug: addOn.slug,
          name: addOn.name,
          description: addOn.description,
          additionalAgents: addOn.additionalAgents,
          monthlyPrice: addOn.monthlyPriceCents / 100,
          maxPerUser: addOn.maxPerUser,
        })),
      };
    } catch (error) {
      console.error("Failed to get agent add-ons:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch agent add-ons",
      });
    }
  }),

  /**
   * Seed default subscription data (admin only)
   */
  seedDefaults: protectedProcedure.mutation(async ({ ctx }) => {
    // Simple admin check
    if (ctx.user.role !== "admin") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Admin access required",
      });
    }

    try {
      const service = getSubscriptionService();
      await service.seedDefaults();

      return {
        success: true,
        message: "Default subscription data seeded",
      };
    } catch (error) {
      console.error("Failed to seed defaults:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to seed default data",
      });
    }
  }),

  /**
   * Get usage history
   */
  getUsageHistory: protectedProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(12).default(6),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const { getDb } = await import("../../db");
        const { subscriptionUsageRecords, subscriptionTiers } = await import(
          "../../../drizzle/schema-subscriptions"
        );
        const { eq, desc } = await import("drizzle-orm");

        const db = await getDb();
        if (!db) {
          throw new Error("Database not initialized");
        }

        const records = await db
          .select({
            record: subscriptionUsageRecords,
            tier: subscriptionTiers,
          })
          .from(subscriptionUsageRecords)
          .leftJoin(
            subscriptionTiers,
            eq(subscriptionUsageRecords.tierId, subscriptionTiers.id)
          )
          .where(eq(subscriptionUsageRecords.userId, ctx.user.id))
          .orderBy(desc(subscriptionUsageRecords.periodStart))
          .limit(input.limit);

        return {
          success: true,
          history: records.map(({ record, tier }) => ({
            periodStart: record.periodStart,
            periodEnd: record.periodEnd,
            tierName: tier?.name || "Unknown",
            executionLimit: record.executionLimit,
            executionsUsed: record.executionsUsed,
            percentUsed: record.executionLimit > 0
              ? Math.round((record.executionsUsed / record.executionLimit) * 100)
              : 0,
            additionalExecutionsPurchased: record.additionalExecutionsPurchased,
            overageExecutions: record.overageExecutions,
            overageCharged: record.overageChargedCents / 100,
          })),
        };
      } catch (error) {
        console.error("Failed to get usage history:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch usage history",
        });
      }
    }),

  /**
   * Resume a cancelled subscription (undo cancel_at_period_end)
   */
  resume: protectedProcedure.mutation(async ({ ctx }) => {
    try {
      const service = getSubscriptionService();
      const currentSub = await service.getUserSubscription(ctx.user.id);
      if (!currentSub) {
        throw new TRPCError({ code: "NOT_FOUND", message: "No subscription found" });
      }
      if (!currentSub.subscription.cancelAtPeriodEnd) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Subscription is not scheduled for cancellation" });
      }
      if (currentSub.subscription.stripeSubscriptionId && process.env.STRIPE_SECRET_KEY) {
        try {
          const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-12-18.acacia" as any });
          await stripe.subscriptions.update(currentSub.subscription.stripeSubscriptionId, { cancel_at_period_end: false });
        } catch (e) { console.error("Failed to resume on Stripe:", e); }
      }
      const { getDb } = await import("../../db");
      const { userSubscriptions } = await import("../../../drizzle/schema-subscriptions");
      const { eq } = await import("drizzle-orm");
      const db = await getDb();
      if (db) {
        await db.update(userSubscriptions).set({ cancelAtPeriodEnd: false, cancellationReason: null, updatedAt: new Date() }).where(eq(userSubscriptions.userId, ctx.user.id));
      }
      return { success: true, message: "Subscription resumed successfully" };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to resume subscription" });
    }
  }),

  /**
   * Get Stripe Billing Portal URL for self-serve billing management
   */
  getBillingPortalUrl: protectedProcedure
    .input(z.object({ returnUrl: z.string().url().optional() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const service = getSubscriptionService();
        const currentSub = await service.getUserSubscription(ctx.user.id);
        if (!currentSub?.subscription.stripeCustomerId) {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "No Stripe customer found" });
        }
        if (!process.env.STRIPE_SECRET_KEY) {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Stripe is not configured" });
        }
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-12-18.acacia" as any });
        const baseUrl = process.env.FRONTEND_URL || "http://localhost:5173";
        const portalSession = await stripe.billingPortal.sessions.create({
          customer: currentSub.subscription.stripeCustomerId,
          return_url: input.returnUrl || `${baseUrl}/dashboard`,
        });
        return { success: true, url: portalSession.url };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to open billing portal" });
      }
    }),
});
