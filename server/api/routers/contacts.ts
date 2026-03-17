/**
 * Contacts Router - tRPC API for GHL Contact Management
 *
 * Endpoints:
 *   contacts.search       — Search/filter contacts
 *   contacts.get          — Get a single contact by ID
 *   contacts.create       — Create a new contact
 *   contacts.update       — Update contact fields
 *   contacts.delete       — Delete a contact
 *   contacts.addTags      — Add tags to a contact
 *   contacts.removeTags   — Remove tags from a contact
 *   contacts.findByEmail  — Look up a contact by email
 *   contacts.findByPhone  — Look up a contact by phone
 *
 * Linear: AI-2877
 */

import { z } from "zod";
import { router, protectedProcedure } from "../../_core/trpc";
import { TRPCError } from "@trpc/server";
import { createContactsService } from "../../services/contacts.service";
import { GHLError } from "../../services/ghl.service";

// ========================================
// SHARED HELPERS
// ========================================

const locationInput = z.object({
  locationId: z.string().min(1, "locationId is required"),
});

const customFieldSchema = z.object({
  id: z.string().min(1),
  field_value: z.union([z.string(), z.array(z.string())]),
});

function mapGHLError(err: unknown): TRPCError {
  if (err instanceof GHLError) {
    const code =
      err.category === "auth"
        ? ("UNAUTHORIZED" as const)
        : err.category === "rate_limit"
          ? ("TOO_MANY_REQUESTS" as const)
          : err.category === "client"
            ? ("BAD_REQUEST" as const)
            : ("INTERNAL_SERVER_ERROR" as const);
    return new TRPCError({ code, message: err.message });
  }
  return new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: err instanceof Error ? err.message : "Unknown error",
  });
}

// ========================================
// ROUTER
// ========================================

export const contactsRouter = router({
  // ----------------------------------------
  // Search / List
  // ----------------------------------------

  search: protectedProcedure
    .input(
      locationInput.extend({
        query: z.string().optional(),
        email: z.string().optional(),
        phone: z.string().optional(),
        source: z.string().optional(),
        assignedTo: z.string().optional(),
        limit: z.number().min(1).max(100).optional(),
        startAfter: z.string().optional(),
        startAfterId: z.string().optional(),
        order: z
          .enum([
            "date_added_asc",
            "date_added_desc",
            "date_updated_asc",
            "date_updated_desc",
          ])
          .optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const { locationId, ...searchParams } = input;
        const svc = createContactsService(locationId, ctx.user.id);
        return await svc.searchContacts(searchParams);
      } catch (err) {
        throw mapGHLError(err);
      }
    }),

  // ----------------------------------------
  // Get single contact
  // ----------------------------------------

  get: protectedProcedure
    .input(
      locationInput.extend({
        contactId: z.string().min(1),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const svc = createContactsService(input.locationId, ctx.user.id);
        return await svc.getContact(input.contactId);
      } catch (err) {
        throw mapGHLError(err);
      }
    }),

  // ----------------------------------------
  // Create
  // ----------------------------------------

  create: protectedProcedure
    .input(
      locationInput.extend({
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
        source: z.string().optional(),
        tags: z.array(z.string()).optional(),
        dateOfBirth: z.string().optional(),
        assignedTo: z.string().optional(),
        dnd: z.boolean().optional(),
        customFields: z.array(customFieldSchema).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const { locationId, ...createInput } = input;
        const svc = createContactsService(locationId, ctx.user.id);
        return await svc.createContact(createInput);
      } catch (err) {
        throw mapGHLError(err);
      }
    }),

  // ----------------------------------------
  // Update
  // ----------------------------------------

  update: protectedProcedure
    .input(
      locationInput.extend({
        contactId: z.string().min(1),
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
        source: z.string().optional(),
        tags: z.array(z.string()).optional(),
        dateOfBirth: z.string().optional(),
        assignedTo: z.string().optional(),
        dnd: z.boolean().optional(),
        customFields: z.array(customFieldSchema).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const { locationId, contactId, ...updateInput } = input;
        const svc = createContactsService(locationId, ctx.user.id);
        return await svc.updateContact(contactId, updateInput);
      } catch (err) {
        throw mapGHLError(err);
      }
    }),

  // ----------------------------------------
  // Delete
  // ----------------------------------------

  delete: protectedProcedure
    .input(
      locationInput.extend({
        contactId: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const svc = createContactsService(input.locationId, ctx.user.id);
        await svc.deleteContact(input.contactId);
        return {
          success: true,
          message: `Contact ${input.contactId} deleted`,
        };
      } catch (err) {
        throw mapGHLError(err);
      }
    }),

  // ----------------------------------------
  // Tag operations
  // ----------------------------------------

  addTags: protectedProcedure
    .input(
      locationInput.extend({
        contactId: z.string().min(1),
        tags: z.array(z.string().min(1)).min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const svc = createContactsService(input.locationId, ctx.user.id);
        return await svc.addTags(input.contactId, input.tags);
      } catch (err) {
        throw mapGHLError(err);
      }
    }),

  removeTags: protectedProcedure
    .input(
      locationInput.extend({
        contactId: z.string().min(1),
        tags: z.array(z.string().min(1)).min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const svc = createContactsService(input.locationId, ctx.user.id);
        return await svc.removeTags(input.contactId, input.tags);
      } catch (err) {
        throw mapGHLError(err);
      }
    }),

  // ----------------------------------------
  // Lookup helpers
  // ----------------------------------------

  findByEmail: protectedProcedure
    .input(
      locationInput.extend({
        email: z.string().email(),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const svc = createContactsService(input.locationId, ctx.user.id);
        return await svc.findByEmail(input.email);
      } catch (err) {
        throw mapGHLError(err);
      }
    }),

  findByPhone: protectedProcedure
    .input(
      locationInput.extend({
        phone: z.string().min(1),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const svc = createContactsService(input.locationId, ctx.user.id);
        return await svc.findByPhone(input.phone);
      } catch (err) {
        throw mapGHLError(err);
      }
    }),
});
