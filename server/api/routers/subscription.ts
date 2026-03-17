/**
 * Subscription tRPC Router
 * Handles subscription management, usage tracking, and billing operations
 */

import { z } from "zod";
import { router, protectedProcedure, publicProcedure } from "../../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getSubscriptionService } from "../../services/subscription.service";
import { TIER_SLUGS } from "../../../drizzle/schema-subscriptions";

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
   * Create a Stripe Checkout Session for a new subscription
   * Returns a checkout URL for client-side redirect
   */
  createCheckout: protectedProcedure
    .input(
      z.object({
        tierSlug: z.enum(["starter", "growth", "professional", "enterprise"]),
        paymentFrequency: z.enum(["weekly", "monthly", "six_month", "annual"]).default("monthly"),
        successUrl: z.string().url().optional(),
        cancelUrl: z.string().url().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const service = getSubscriptionService();

        const result = await service.createSubscriptionCheckout(
          ctx.user.id,
          input.tierSlug,
          input.paymentFrequency,
          input.successUrl,
          input.cancelUrl
        );

        return {
          success: true,
          checkoutUrl: result.checkoutUrl,
          sessionId: result.sessionId,
        };
      } catch (error) {
        console.error("Failed to create checkout:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create checkout session. Please try again.",
        });
      }
    }),

  /**
   * Create a new subscription (direct, without Stripe - for dev/testing)
   * In production, use createCheckout instead
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

        // If Stripe is configured, redirect to checkout instead
        if (process.env.STRIPE_SECRET_KEY) {
          const result = await service.createSubscriptionCheckout(
            ctx.user.id,
            input.tierSlug,
            input.paymentFrequency
          );

          return {
            success: true,
            subscriptionId: null,
            message: "Redirecting to Stripe checkout",
            checkoutUrl: result.checkoutUrl,
          };
        }

        // Fallback: create subscription directly (dev mode)
        const subscription = await service.createSubscription(
          ctx.user.id,
          input.tierSlug,
          input.paymentFrequency
        );

        return {
          success: true,
          subscriptionId: subscription.id,
          message: "Subscription created successfully",
          checkoutUrl: null,
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
   * If Stripe is connected, redirects to checkout for the new tier
   */
  updateTier: protectedProcedure
    .input(updateTierSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const service = getSubscriptionService();

        // If user has Stripe subscription, use Stripe Checkout for upgrades
        const existing = await service.getUserSubscription(ctx.user.id);
        if (existing?.subscription.stripeSubscriptionId && process.env.STRIPE_SECRET_KEY) {
          const result = await service.createSubscriptionCheckout(
            ctx.user.id,
            input.newTierSlug,
            (existing.subscription.paymentFrequency as any) || "monthly"
          );

          return {
            success: true,
            subscriptionId: existing.subscription.id,
            newTier: input.newTierSlug,
            message: "Redirecting to Stripe checkout for upgrade",
            checkoutUrl: result.checkoutUrl,
          };
        }

        // Direct update for non-Stripe subscriptions
        const subscription = await service.updateTier(ctx.user.id, input.newTierSlug);

        return {
          success: true,
          subscriptionId: subscription.id,
          newTier: input.newTierSlug,
          message: "Subscription tier updated successfully",
          checkoutUrl: null,
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
   * Cancel subscription (schedules cancellation at period end)
   */
  cancel: protectedProcedure
    .input(
      z.object({
        reason: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const service = getSubscriptionService();
        const subscription = await service.cancelSubscription(ctx.user.id, input.reason);

        return {
          success: true,
          message: "Subscription will be cancelled at the end of the current billing period",
          cancelAtPeriodEnd: true,
          currentPeriodEnd: subscription.currentPeriodEnd,
        };
      } catch (error) {
        console.error("Failed to cancel subscription:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to cancel subscription",
        });
      }
    }),

  /**
   * Resume a cancelled subscription (undo cancellation)
   */
  resume: protectedProcedure.mutation(async ({ ctx }) => {
    try {
      const service = getSubscriptionService();
      await service.resumeSubscription(ctx.user.id);

      return {
        success: true,
        message: "Subscription resumed successfully",
      };
    } catch (error) {
      console.error("Failed to resume subscription:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to resume subscription",
      });
    }
  }),

  /**
   * Get Stripe Billing Portal URL for self-serve subscription management
   * Allows users to update payment method, view invoices, etc.
   */
  getBillingPortalUrl: protectedProcedure
    .input(
      z.object({
        returnUrl: z.string().url().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const service = getSubscriptionService();
        const url = await service.createBillingPortalSession(
          ctx.user.id,
          input.returnUrl
        );

        return {
          success: true,
          url,
        };
      } catch (error) {
        console.error("Failed to create billing portal session:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to open billing portal. Ensure you have an active Stripe subscription.",
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
});
