/**
 * GHL Contacts tRPC Router
 * Full CRUD + bulk operations for GoHighLevel contacts (FR-007 through FR-014)
 */

import { z } from "zod";
import { router, protectedProcedure } from "../../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getGhlContactsService } from "../../services/ghlContacts.service";

// ========================================
// INPUT SCHEMAS
// ========================================

const contactInputSchema = z.object({
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
  source: z.string().optional(),
  tags: z.array(z.string()).optional(),
  customFields: z
    .array(z.object({ id: z.string(), value: z.unknown() }))
    .optional(),
  dnd: z.boolean().optional(),
  assignedTo: z.string().optional(),
});

const connectionInputSchema = z.object({
  connectionId: z.number().int(),
  locationId: z.string(),
});

// ========================================
// GHL CONTACTS ROUTER
// ========================================

export const ghlContactsRouter = router({
  /**
   * Create a new contact
   */
  create: protectedProcedure
    .input(connectionInputSchema.extend({ data: contactInputSchema }))
    .mutation(async ({ ctx, input }) => {
      const svc = getGhlContactsService();
      const result = await svc.create(
        ctx.user.id,
        input.connectionId,
        input.locationId,
        input.data
      );

      if (!result.success) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: result.error || "Failed to create contact",
        });
      }

      return result.data;
    }),

  /**
   * Get a contact by ID
   */
  get: protectedProcedure
    .input(
      z.object({
        connectionId: z.number().int(),
        contactId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const svc = getGhlContactsService();
      const result = await svc.get(
        ctx.user.id,
        input.connectionId,
        input.contactId
      );

      if (!result.success) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: result.error || "Contact not found",
        });
      }

      return result.data;
    }),

  /**
   * Update a contact
   */
  update: protectedProcedure
    .input(
      z.object({
        connectionId: z.number().int(),
        contactId: z.string(),
        data: contactInputSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const svc = getGhlContactsService();
      const result = await svc.update(
        ctx.user.id,
        input.connectionId,
        input.contactId,
        input.data
      );

      if (!result.success) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: result.error || "Failed to update contact",
        });
      }

      return result.data;
    }),

  /**
   * Delete a contact
   */
  delete: protectedProcedure
    .input(
      z.object({
        connectionId: z.number().int(),
        contactId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const svc = getGhlContactsService();
      const result = await svc.delete(
        ctx.user.id,
        input.connectionId,
        input.contactId
      );

      if (!result.success) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: result.error || "Failed to delete contact",
        });
      }

      return { success: true };
    }),

  /**
   * Search contacts
   */
  search: protectedProcedure
    .input(
      connectionInputSchema.extend({
        query: z.string().optional(),
        email: z.string().optional(),
        phone: z.string().optional(),
        tags: z.array(z.string()).optional(),
        limit: z.number().int().min(1).max(100).optional(),
        startAfterId: z.string().optional(),
        sortBy: z.string().optional(),
        sortOrder: z.enum(["asc", "desc"]).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const svc = getGhlContactsService();
      const { connectionId, locationId, ...searchParams } = input;

      const result = await svc.search(
        ctx.user.id,
        connectionId,
        locationId,
        searchParams
      );

      if (!result.success) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: result.error || "Search failed",
        });
      }

      return result.data;
    }),

  /**
   * Add a tag to a contact
   */
  addTag: protectedProcedure
    .input(
      z.object({
        connectionId: z.number().int(),
        contactId: z.string(),
        tag: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const svc = getGhlContactsService();
      const result = await svc.addTag(
        ctx.user.id,
        input.connectionId,
        input.contactId,
        input.tag
      );

      if (!result.success) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: result.error || "Failed to add tag",
        });
      }

      return result.data;
    }),

  /**
   * Remove a tag from a contact
   */
  removeTag: protectedProcedure
    .input(
      z.object({
        connectionId: z.number().int(),
        contactId: z.string(),
        tag: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const svc = getGhlContactsService();
      const result = await svc.removeTag(
        ctx.user.id,
        input.connectionId,
        input.contactId,
        input.tag
      );

      if (!result.success) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: result.error || "Failed to remove tag",
        });
      }

      return { success: true };
    }),

  /**
   * List all tags for a location
   */
  listTags: protectedProcedure
    .input(connectionInputSchema)
    .query(async ({ ctx, input }) => {
      const svc = getGhlContactsService();
      const result = await svc.listTags(
        ctx.user.id,
        input.connectionId,
        input.locationId
      );

      if (!result.success) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: result.error || "Failed to list tags",
        });
      }

      return result.data;
    }),

  /**
   * Get custom fields for a location
   */
  getCustomFields: protectedProcedure
    .input(connectionInputSchema)
    .query(async ({ ctx, input }) => {
      const svc = getGhlContactsService();
      const result = await svc.getCustomFields(
        ctx.user.id,
        input.connectionId,
        input.locationId
      );

      if (!result.success) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: result.error || "Failed to get custom fields",
        });
      }

      return result.data;
    }),

  /**
   * Update a custom field on a contact
   */
  updateCustomField: protectedProcedure
    .input(
      z.object({
        connectionId: z.number().int(),
        contactId: z.string(),
        fieldId: z.string(),
        value: z.unknown(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const svc = getGhlContactsService();
      const result = await svc.updateCustomField(
        ctx.user.id,
        input.connectionId,
        input.contactId,
        input.fieldId,
        input.value
      );

      if (!result.success) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: result.error || "Failed to update custom field",
        });
      }

      return result.data;
    }),

  /**
   * Get contact activity / notes
   */
  getActivity: protectedProcedure
    .input(
      z.object({
        connectionId: z.number().int(),
        contactId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const svc = getGhlContactsService();

      const [activityResult, notesResult] = await Promise.all([
        svc.getActivity(ctx.user.id, input.connectionId, input.contactId),
        svc.getNotes(ctx.user.id, input.connectionId, input.contactId),
      ]);

      return {
        events: activityResult.data?.events || [],
        notes: notesResult.data?.notes || [],
      };
    }),

  /**
   * Add a note to a contact
   */
  addNote: protectedProcedure
    .input(
      z.object({
        connectionId: z.number().int(),
        contactId: z.string(),
        body: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const svc = getGhlContactsService();
      const result = await svc.addNote(
        ctx.user.id,
        input.connectionId,
        input.contactId,
        input.body
      );

      if (!result.success) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: result.error || "Failed to add note",
        });
      }

      return result.data;
    }),

  /**
   * Merge duplicate contacts into a primary contact
   */
  merge: protectedProcedure
    .input(
      z.object({
        connectionId: z.number().int(),
        primaryContactId: z.string(),
        duplicateContactIds: z.array(z.string()).min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const svc = getGhlContactsService();
      const result = await svc.merge(
        ctx.user.id,
        input.connectionId,
        input.primaryContactId,
        input.duplicateContactIds
      );

      if (!result.success) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: result.error || "Failed to merge contacts",
        });
      }

      return result.data;
    }),

  /**
   * Bulk import contacts
   */
  bulkImport: protectedProcedure
    .input(
      connectionInputSchema.extend({
        contacts: z.array(contactInputSchema).min(1).max(50000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const svc = getGhlContactsService();
      const result = await svc.bulkImport(
        ctx.user.id,
        input.connectionId,
        input.locationId,
        input.contacts
      );

      return result;
    }),

  /**
   * Bulk export contacts (returns CSV string)
   */
  bulkExport: protectedProcedure
    .input(
      connectionInputSchema.extend({
        query: z.string().optional(),
        tags: z.array(z.string()).optional(),
        maxContacts: z.number().int().max(50000).optional(),
        format: z.enum(["json", "csv"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const svc = getGhlContactsService();
      const { connectionId, locationId, maxContacts, format, ...filters } =
        input;

      const result = await svc.bulkExport(
        ctx.user.id,
        connectionId,
        locationId,
        filters,
        { maxContacts }
      );

      if (!result.success) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Export failed",
        });
      }

      if (format === "csv") {
        return {
          csv: svc.contactsToCsv(result.contacts),
          total: result.total,
        };
      }

      return {
        contacts: result.contacts,
        total: result.total,
      };
    }),
});
