/**
 * GHL Contacts tRPC Router
 *
 * CRUD + search endpoints for GoHighLevel contacts.
 * All procedures require authentication and a locationId.
 *
 * Linear: AI-2877
 */

import { z } from "zod";
import { router, protectedProcedure } from "../../_core/trpc";
import { TRPCError } from "@trpc/server";
import { GHLError } from "../../services/ghl.service";
import { createGHLContactsService } from "../../services/ghlContacts.service";

// ========================================
// SHARED SCHEMAS
// ========================================

const locationInput = z.object({
  locationId: z.string().min(1, "locationId is required"),
});

const customFieldSchema = z.object({
  id: z.string(),
  field_value: z.unknown(),
});

const contactWriteSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  name: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  companyName: z.string().optional(),
  address1: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
  website: z.string().optional(),
  timezone: z.string().optional(),
  dnd: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  source: z.string().optional(),
  customFields: z.array(customFieldSchema).optional(),
});

// ========================================
// HELPERS
// ========================================

function mapGHLError(err: unknown): TRPCError {
  if (err instanceof GHLError) {
    const code =
      err.category === "auth"
        ? "UNAUTHORIZED"
        : err.category === "rate_limit"
          ? "TOO_MANY_REQUESTS"
          : err.category === "client"
            ? "BAD_REQUEST"
            : "INTERNAL_SERVER_ERROR";
    return new TRPCError({ code, message: err.message });
  }
  if (err instanceof TRPCError) return err;
  return new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: err instanceof Error ? err.message : "Unknown error",
  });
}

// ========================================
// ROUTER
// ========================================

export const contactsRouter = router({
  /**
   * Get a single contact by ID.
   */
  get: protectedProcedure
    .input(
      locationInput.extend({
        contactId: z.string().min(1, "contactId is required"),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const svc = createGHLContactsService(input.locationId, ctx.user.id);
        const contact = await svc.getContact(input.contactId);
        return { contact };
      } catch (err) {
        throw mapGHLError(err);
      }
    }),

  /**
   * Search / list contacts for a location.
   */
  search: protectedProcedure
    .input(
      locationInput.extend({
        query: z.string().optional(),
        email: z.string().optional(),
        phone: z.string().optional(),
        limit: z.number().int().min(1).max(100).default(20),
        startAfterId: z.string().optional(),
        startAfter: z.number().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const svc = createGHLContactsService(input.locationId, ctx.user.id);
        const result = await svc.searchContacts({
          query: input.query,
          email: input.email,
          phone: input.phone,
          limit: input.limit,
          startAfterId: input.startAfterId,
          startAfter: input.startAfter,
        });
        return result;
      } catch (err) {
        throw mapGHLError(err);
      }
    }),

  /**
   * Create a new contact.
   */
  create: protectedProcedure
    .input(locationInput.extend({ data: contactWriteSchema }))
    .mutation(async ({ ctx, input }) => {
      try {
        const svc = createGHLContactsService(input.locationId, ctx.user.id);
        const contact = await svc.createContact(input.data);
        return { contact };
      } catch (err) {
        throw mapGHLError(err);
      }
    }),

  /**
   * Update an existing contact.
   */
  update: protectedProcedure
    .input(
      locationInput.extend({
        contactId: z.string().min(1, "contactId is required"),
        data: contactWriteSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const svc = createGHLContactsService(input.locationId, ctx.user.id);
        const contact = await svc.updateContact(input.contactId, input.data);
        return { contact };
      } catch (err) {
        throw mapGHLError(err);
      }
    }),

  /**
   * Delete a contact.
   */
  delete: protectedProcedure
    .input(
      locationInput.extend({
        contactId: z.string().min(1, "contactId is required"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const svc = createGHLContactsService(input.locationId, ctx.user.id);
        await svc.deleteContact(input.contactId);
        return { success: true, message: `Contact ${input.contactId} deleted` };
      } catch (err) {
        throw mapGHLError(err);
      }
    }),
});
