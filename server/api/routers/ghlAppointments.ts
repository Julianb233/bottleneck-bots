/**
 * GHL Appointments tRPC Router
 *
 * CRUD operations for GoHighLevel calendar appointments
 * and webhook event management.
 *
 * Endpoints:
 * - ghlAppointments.create / get / update / delete
 * - ghlAppointments.getAvailability
 * - ghlAppointments.listCalendars
 * - ghlAppointments.listWebhookEvents
 * - ghlAppointments.retryWebhookEvent
 */

import { z } from "zod";
import { router, protectedProcedure } from "../../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getGHLService } from "../../services/ghl.service";
import { getDb } from "../../db";
import { eq, and, desc } from "drizzle-orm";
import { ghlWebhookEvents } from "../../../drizzle/schema-ghl";

// ========================================
// VALIDATION SCHEMAS
// ========================================

const createAppointmentSchema = z.object({
  locationId: z.string().min(1),
  calendarId: z.string().min(1),
  contactId: z.string().min(1),
  title: z.string().min(1).max(500),
  startTime: z.string().min(1), // ISO 8601
  endTime: z.string().min(1),
  appointmentStatus: z.enum(["confirmed", "cancelled", "showed", "noshow"]).optional(),
  assignedUserId: z.string().optional(),
  notes: z.string().max(5000).optional(),
});

const updateAppointmentSchema = z.object({
  locationId: z.string().min(1),
  appointmentId: z.string().min(1),
  title: z.string().min(1).max(500).optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  appointmentStatus: z.enum(["confirmed", "cancelled", "showed", "noshow"]).optional(),
  assignedUserId: z.string().optional(),
  notes: z.string().max(5000).optional(),
});

// ========================================
// ROUTER
// ========================================

export const ghlAppointmentsRouter = router({
  /**
   * Create a new appointment in GHL
   */
  create: protectedProcedure
    .input(createAppointmentSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const service = getGHLService();
        const result = await service.createAppointment(
          ctx.user.id,
          input.locationId,
          {
            calendarId: input.calendarId,
            contactId: input.contactId,
            title: input.title,
            startTime: input.startTime,
            endTime: input.endTime,
            appointmentStatus: input.appointmentStatus,
            assignedUserId: input.assignedUserId,
            notes: input.notes,
          }
        );
        return result;
      } catch (err) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: err instanceof Error ? err.message : "Failed to create appointment",
        });
      }
    }),

  /**
   * Get an appointment by ID
   */
  get: protectedProcedure
    .input(z.object({
      locationId: z.string().min(1),
      appointmentId: z.string().min(1),
    }))
    .query(async ({ ctx, input }) => {
      try {
        const service = getGHLService();
        return await service.getAppointment(ctx.user.id, input.locationId, input.appointmentId);
      } catch (err) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: err instanceof Error ? err.message : "Failed to get appointment",
        });
      }
    }),

  /**
   * Update an appointment
   */
  update: protectedProcedure
    .input(updateAppointmentSchema)
    .mutation(async ({ ctx, input }) => {
      const { locationId, appointmentId, ...data } = input;
      try {
        const service = getGHLService();
        return await service.updateAppointment(ctx.user.id, locationId, appointmentId, data);
      } catch (err) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: err instanceof Error ? err.message : "Failed to update appointment",
        });
      }
    }),

  /**
   * Delete an appointment
   */
  delete: protectedProcedure
    .input(z.object({
      locationId: z.string().min(1),
      appointmentId: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const service = getGHLService();
        await service.deleteAppointment(ctx.user.id, input.locationId, input.appointmentId);
        return { success: true };
      } catch (err) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: err instanceof Error ? err.message : "Failed to delete appointment",
        });
      }
    }),

  /**
   * Get calendar availability (free slots)
   */
  getAvailability: protectedProcedure
    .input(z.object({
      locationId: z.string().min(1),
      calendarId: z.string().min(1),
      startDate: z.string().min(1),
      endDate: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      try {
        const service = getGHLService();
        return await service.getAvailability(
          ctx.user.id,
          input.locationId,
          input.calendarId,
          input.startDate,
          input.endDate
        );
      } catch (err) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: err instanceof Error ? err.message : "Failed to get availability",
        });
      }
    }),

  /**
   * List calendars for a location
   */
  listCalendars: protectedProcedure
    .input(z.object({
      locationId: z.string().min(1),
    }))
    .query(async ({ ctx, input }) => {
      try {
        const service = getGHLService();
        return await service.listCalendars(ctx.user.id, input.locationId);
      } catch (err) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: err instanceof Error ? err.message : "Failed to list calendars",
        });
      }
    }),

  /**
   * List recent webhook events (paginated)
   */
  listWebhookEvents: protectedProcedure
    .input(z.object({
      locationId: z.string().optional(),
      status: z.enum(["pending", "processed", "failed", "dead_letter"]).optional(),
      limit: z.number().int().min(1).max(100).default(50),
      offset: z.number().int().min(0).default(0),
    }).optional())
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return { events: [], total: 0 };

      try {
        const conditions = [];
        if (input?.locationId) {
          conditions.push(eq(ghlWebhookEvents.locationId, input.locationId));
        }
        if (input?.status) {
          conditions.push(eq(ghlWebhookEvents.status, input.status));
        }

        const query = db
          .select()
          .from(ghlWebhookEvents)
          .orderBy(desc(ghlWebhookEvents.createdAt))
          .limit(input?.limit || 50)
          .offset(input?.offset || 0);

        if (conditions.length > 0) {
          const events = await query.where(and(...conditions));
          return { events, total: events.length };
        }

        const events = await query;
        return { events, total: events.length };
      } catch (err) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: err instanceof Error ? err.message : "Failed to list webhook events",
        });
      }
    }),

  /**
   * Retry a failed or dead-letter webhook event
   */
  retryWebhookEvent: protectedProcedure
    .input(z.object({
      eventId: z.number().int(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      try {
        const [event] = await db
          .select()
          .from(ghlWebhookEvents)
          .where(eq(ghlWebhookEvents.id, input.eventId))
          .limit(1);

        if (!event) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Webhook event not found" });
        }

        if (event.status !== "failed" && event.status !== "dead_letter") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Can only retry failed or dead-letter events",
          });
        }

        // Reset to pending for reprocessing
        await db
          .update(ghlWebhookEvents)
          .set({
            status: "pending",
            error: null,
          })
          .where(eq(ghlWebhookEvents.id, input.eventId));

        return { success: true, message: "Event queued for retry" };
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: err instanceof Error ? err.message : "Failed to retry event",
        });
      }
    }),
});
