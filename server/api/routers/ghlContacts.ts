/**
 * GHL Contacts tRPC Router
 *
 * Typed RPC endpoints for GHL contact management:
 * - CRUD: create, get, update, delete
 * - Search with filters
 * - Bulk import/export
 * - Tag management
 * - Custom fields
 * - Activity timeline
 * - Contact merging
 *
 * Linear: AI-2870
 */

import { z } from "zod";
import { router, protectedProcedure } from "../../_core/trpc";
import { TRPCError } from "@trpc/server";
import { GHLService, GHLError } from "../../services/ghl.service";
import { GHLContactsService } from "../../services/ghlContacts.service";

// ========================================
// Shared helpers
// ========================================

function getContactsService(locationId: string, userId: number) {
  const ghl = new GHLService(locationId, userId);
  return new GHLContactsService(ghl, locationId);
}

function handleGHLError(err: unknown, fallbackMessage: string): never {
  if (err instanceof GHLError) {
    throw new TRPCError({
      code:
        err.category === "auth"
          ? "UNAUTHORIZED"
          : err.category === "rate_limit"
            ? "TOO_MANY_REQUESTS"
            : err.category === "client"
              ? "BAD_REQUEST"
              : "INTERNAL_SERVER_ERROR",
      message: err.message,
    });
  }
  throw new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: err instanceof Error ? err.message : fallbackMessage,
  });
}

// ========================================
// Zod schemas
// ========================================

const locationInput = z.object({
  locationId: z.string().min(1, "locationId is required"),
});

const contactIdInput = locationInput.extend({
  contactId: z.string().min(1, "contactId is required"),
});

const customFieldSchema = z.object({
  id: z.string(),
  key: z.string().optional(),
  field_value: z.unknown(),
});

const contactDataSchema = z.object({
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
  assignedTo: z.string().optional(),
});

const searchFiltersSchema = z.object({
  query: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  tags: z.array(z.string()).optional(),
  startAfter: z.string().optional(),
  startBefore: z.string().optional(),
  limit: z.number().min(1).max(100).optional(),
  offset: z.number().min(0).optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
});

const bulkImportContactSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  companyName: z.string().optional(),
  tags: z.array(z.string()).optional(),
  source: z.string().optional(),
  customFields: z
    .array(z.object({ id: z.string(), field_value: z.unknown() }))
    .optional(),
}).passthrough();

// ========================================
// Router
// ========================================

export const ghlContactsRouter = router({
  /**
   * Create a new contact.
   */
  create: protectedProcedure
    .input(locationInput.extend({ data: contactDataSchema }))
    .mutation(async ({ ctx, input }) => {
      try {
        const svc = getContactsService(input.locationId, ctx.user.id);
        const result = await svc.create(input.data);
        return result.data;
      } catch (err) {
        handleGHLError(err, "Failed to create contact");
      }
    }),

  /**
   * Get a contact by ID.
   */
  get: protectedProcedure
    .input(contactIdInput)
    .query(async ({ ctx, input }) => {
      try {
        const svc = getContactsService(input.locationId, ctx.user.id);
        const result = await svc.get(input.contactId);
        return result.data;
      } catch (err) {
        handleGHLError(err, "Failed to get contact");
      }
    }),

  /**
   * Update an existing contact.
   */
  update: protectedProcedure
    .input(contactIdInput.extend({ data: contactDataSchema }))
    .mutation(async ({ ctx, input }) => {
      try {
        const svc = getContactsService(input.locationId, ctx.user.id);
        const result = await svc.update(input.contactId, input.data);
        return result.data;
      } catch (err) {
        handleGHLError(err, "Failed to update contact");
      }
    }),

  /**
   * Delete a contact by ID.
   */
  delete: protectedProcedure
    .input(contactIdInput)
    .mutation(async ({ ctx, input }) => {
      try {
        const svc = getContactsService(input.locationId, ctx.user.id);
        const result = await svc.delete(input.contactId);
        return result.data;
      } catch (err) {
        handleGHLError(err, "Failed to delete contact");
      }
    }),

  /**
   * Search contacts with filters.
   */
  search: protectedProcedure
    .input(locationInput.extend({ filters: searchFiltersSchema.optional() }))
    .query(async ({ ctx, input }) => {
      try {
        const svc = getContactsService(input.locationId, ctx.user.id);
        const result = await svc.search(input.filters || {});
        return result.data;
      } catch (err) {
        handleGHLError(err, "Failed to search contacts");
      }
    }),

  /**
   * Bulk import contacts (up to 50,000).
   */
  bulkImport: protectedProcedure
    .input(
      locationInput.extend({
        contacts: z
          .array(bulkImportContactSchema)
          .min(1)
          .max(50_000, "Maximum 50,000 contacts per import"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const svc = getContactsService(input.locationId, ctx.user.id);
        const result = await svc.bulkImport(input.contacts);
        return result.data;
      } catch (err) {
        handleGHLError(err, "Failed to bulk import contacts");
      }
    }),

  /**
   * Bulk export contacts to CSV.
   */
  bulkExport: protectedProcedure
    .input(locationInput.extend({ filters: searchFiltersSchema.optional() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const svc = getContactsService(input.locationId, ctx.user.id);
        const result = await svc.bulkExport(input.filters || undefined);
        return result.data;
      } catch (err) {
        handleGHLError(err, "Failed to bulk export contacts");
      }
    }),

  /**
   * Add a tag to a contact.
   */
  addTag: protectedProcedure
    .input(contactIdInput.extend({ tag: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      try {
        const svc = getContactsService(input.locationId, ctx.user.id);
        const result = await svc.addTag(input.contactId, input.tag);
        return result.data;
      } catch (err) {
        handleGHLError(err, "Failed to add tag");
      }
    }),

  /**
   * Remove a tag from a contact.
   */
  removeTag: protectedProcedure
    .input(contactIdInput.extend({ tag: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      try {
        const svc = getContactsService(input.locationId, ctx.user.id);
        const result = await svc.removeTag(input.contactId, input.tag);
        return result.data;
      } catch (err) {
        handleGHLError(err, "Failed to remove tag");
      }
    }),

  /**
   * List all tags for a location.
   */
  listTags: protectedProcedure
    .input(locationInput)
    .query(async ({ ctx, input }) => {
      try {
        const svc = getContactsService(input.locationId, ctx.user.id);
        const result = await svc.listTags();
        return result.data;
      } catch (err) {
        handleGHLError(err, "Failed to list tags");
      }
    }),

  /**
   * Get custom fields for a location.
   */
  getCustomFields: protectedProcedure
    .input(locationInput)
    .query(async ({ ctx, input }) => {
      try {
        const svc = getContactsService(input.locationId, ctx.user.id);
        const result = await svc.getCustomFields();
        return result.data;
      } catch (err) {
        handleGHLError(err, "Failed to get custom fields");
      }
    }),

  /**
   * Update a custom field on a contact.
   */
  updateCustomField: protectedProcedure
    .input(
      contactIdInput.extend({
        fieldId: z.string().min(1),
        value: z.unknown(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const svc = getContactsService(input.locationId, ctx.user.id);
        const result = await svc.updateCustomField(
          input.contactId,
          input.fieldId,
          input.value
        );
        return result.data;
      } catch (err) {
        handleGHLError(err, "Failed to update custom field");
      }
    }),

  /**
   * Get activity timeline for a contact.
   */
  getActivity: protectedProcedure
    .input(contactIdInput)
    .query(async ({ ctx, input }) => {
      try {
        const svc = getContactsService(input.locationId, ctx.user.id);
        const result = await svc.getActivity(input.contactId);
        return result.data;
      } catch (err) {
        handleGHLError(err, "Failed to get contact activity");
      }
    }),

  /**
   * Merge duplicate contacts into a primary contact.
   */
  merge: protectedProcedure
    .input(
      locationInput.extend({
        primaryId: z.string().min(1),
        duplicateIds: z.array(z.string().min(1)).min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const svc = getContactsService(input.locationId, ctx.user.id);
        const result = await svc.merge(input.primaryId, input.duplicateIds);
        return result.data;
      } catch (err) {
        handleGHLError(err, "Failed to merge contacts");
      }
    }),
});
