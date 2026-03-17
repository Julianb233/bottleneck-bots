/**
 * GHL Contact Management Service (FR-007 through FR-014)
 *
 * Full CRUD + bulk operations for GoHighLevel contacts.
 * Built on top of ghl.service.ts base HTTP client.
 *
 * Functions:
 * - contacts.create / get / update / delete
 * - contacts.search (with filters)
 * - contacts.bulkImport / bulkExport
 * - contacts.addTag / removeTag / listTags
 * - contacts.getCustomFields / updateCustomField
 * - contacts.getActivity
 * - contacts.merge
 */

import { getGhlService, type GhlApiResponse } from "./ghl.service";

// ========================================
// TYPES
// ========================================

export interface GhlContact {
  id: string;
  locationId: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  email?: string;
  phone?: string;
  companyName?: string;
  address1?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  website?: string;
  timezone?: string;
  source?: string;
  tags?: string[];
  customFields?: GhlCustomFieldValue[];
  dateOfBirth?: string;
  dnd?: boolean;
  dndSettings?: Record<string, unknown>;
  assignedTo?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface GhlContactCreateInput {
  firstName?: string;
  lastName?: string;
  name?: string;
  email?: string;
  phone?: string;
  companyName?: string;
  address1?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  website?: string;
  timezone?: string;
  source?: string;
  tags?: string[];
  customFields?: GhlCustomFieldValue[];
  dnd?: boolean;
  assignedTo?: string;
}

export interface GhlContactUpdateInput extends Partial<GhlContactCreateInput> {}

export interface GhlContactSearchParams {
  query?: string;
  email?: string;
  phone?: string;
  tags?: string[];
  dateAdded?: { startDate?: string; endDate?: string };
  limit?: number;
  startAfter?: string;
  startAfterId?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface GhlCustomField {
  id: string;
  name: string;
  fieldKey: string;
  dataType: string;
  placeholder?: string;
  position?: number;
  isMultipleFile?: boolean;
  options?: string[];
}

export interface GhlCustomFieldValue {
  id: string;
  value: unknown;
}

export interface GhlTag {
  id?: string;
  name: string;
  locationId?: string;
}

export interface GhlContactActivity {
  id: string;
  contactId: string;
  type: string;
  timestamp: string;
  body?: string;
  user?: { id: string; name: string };
  [key: string]: unknown;
}

export interface GhlBulkImportResult {
  success: boolean;
  totalProcessed: number;
  created: number;
  updated: number;
  failed: number;
  errors?: Array<{ index: number; error: string }>;
}

export interface GhlContactSearchResult {
  contacts: GhlContact[];
  meta?: {
    total?: number;
    startAfter?: string;
    startAfterId?: string;
  };
}

// ========================================
// CONTACT MANAGEMENT SERVICE
// ========================================

export class GhlContactsService {
  private ghl = getGhlService();

  // ----------------------------------------
  // CRUD Operations
  // ----------------------------------------

  /**
   * Create a new contact (FR-007)
   */
  async create(
    userId: number,
    connectionId: number,
    locationId: string,
    data: GhlContactCreateInput
  ): Promise<GhlApiResponse<{ contact: GhlContact }>> {
    return this.ghl.apiRequest(userId, connectionId, "POST", "/contacts/", {
      body: {
        ...data,
        locationId,
      },
    });
  }

  /**
   * Get a contact by ID (FR-008)
   */
  async get(
    userId: number,
    connectionId: number,
    contactId: string
  ): Promise<GhlApiResponse<{ contact: GhlContact }>> {
    return this.ghl.apiRequest(
      userId,
      connectionId,
      "GET",
      `/contacts/${contactId}`
    );
  }

  /**
   * Update a contact (FR-009)
   */
  async update(
    userId: number,
    connectionId: number,
    contactId: string,
    data: GhlContactUpdateInput
  ): Promise<GhlApiResponse<{ contact: GhlContact }>> {
    return this.ghl.apiRequest(
      userId,
      connectionId,
      "PUT",
      `/contacts/${contactId}`,
      {
        body: data as Record<string, unknown>,
      }
    );
  }

  /**
   * Delete a contact (FR-010)
   */
  async delete(
    userId: number,
    connectionId: number,
    contactId: string
  ): Promise<GhlApiResponse<{ succeded: boolean }>> {
    return this.ghl.apiRequest(
      userId,
      connectionId,
      "DELETE",
      `/contacts/${contactId}`
    );
  }

  // ----------------------------------------
  // Search
  // ----------------------------------------

  /**
   * Search contacts with filters (FR-011)
   */
  async search(
    userId: number,
    connectionId: number,
    locationId: string,
    params: GhlContactSearchParams = {}
  ): Promise<GhlApiResponse<GhlContactSearchResult>> {
    const query: Record<string, string> = {
      locationId,
    };

    if (params.query) query.query = params.query;
    if (params.email) query.email = params.email;
    if (params.phone) query.phone = params.phone;
    if (params.limit) query.limit = String(params.limit);
    if (params.startAfter) query.startAfter = params.startAfter;
    if (params.startAfterId) query.startAfterId = params.startAfterId;
    if (params.sortBy) query.sortBy = params.sortBy;
    if (params.sortOrder) query.sortOrder = params.sortOrder;

    return this.ghl.apiRequest(userId, connectionId, "GET", "/contacts/", {
      query,
    });
  }

  // ----------------------------------------
  // Tags (FR-012)
  // ----------------------------------------

  /**
   * Add a tag to a contact
   */
  async addTag(
    userId: number,
    connectionId: number,
    contactId: string,
    tag: string
  ): Promise<GhlApiResponse<{ tags: string[] }>> {
    return this.ghl.apiRequest(
      userId,
      connectionId,
      "POST",
      `/contacts/${contactId}/tags`,
      {
        body: { tags: [tag] },
      }
    );
  }

  /**
   * Remove a tag from a contact
   */
  async removeTag(
    userId: number,
    connectionId: number,
    contactId: string,
    tag: string
  ): Promise<GhlApiResponse> {
    return this.ghl.apiRequest(
      userId,
      connectionId,
      "DELETE",
      `/contacts/${contactId}/tags`,
      {
        body: { tags: [tag] },
      }
    );
  }

  /**
   * List all tags for a location
   */
  async listTags(
    userId: number,
    connectionId: number,
    locationId: string
  ): Promise<GhlApiResponse<{ tags: GhlTag[] }>> {
    return this.ghl.apiRequest(userId, connectionId, "GET", "/locations/tags", {
      query: { locationId },
    });
  }

  // ----------------------------------------
  // Custom Fields (FR-013)
  // ----------------------------------------

  /**
   * Get all custom fields for a location
   */
  async getCustomFields(
    userId: number,
    connectionId: number,
    locationId: string
  ): Promise<GhlApiResponse<{ customFields: GhlCustomField[] }>> {
    return this.ghl.apiRequest(
      userId,
      connectionId,
      "GET",
      `/locations/${locationId}/customFields`
    );
  }

  /**
   * Update a custom field value on a contact
   */
  async updateCustomField(
    userId: number,
    connectionId: number,
    contactId: string,
    fieldId: string,
    value: unknown
  ): Promise<GhlApiResponse<{ contact: GhlContact }>> {
    return this.ghl.apiRequest(
      userId,
      connectionId,
      "PUT",
      `/contacts/${contactId}`,
      {
        body: {
          customFields: [{ id: fieldId, value }],
        },
      }
    );
  }

  // ----------------------------------------
  // Activity Timeline (FR-013)
  // ----------------------------------------

  /**
   * Get activity timeline for a contact
   */
  async getActivity(
    userId: number,
    connectionId: number,
    contactId: string
  ): Promise<GhlApiResponse<{ events: GhlContactActivity[] }>> {
    return this.ghl.apiRequest(
      userId,
      connectionId,
      "GET",
      `/contacts/${contactId}/tasks`
    );
  }

  /**
   * Get notes for a contact
   */
  async getNotes(
    userId: number,
    connectionId: number,
    contactId: string
  ): Promise<GhlApiResponse<{ notes: Array<{ id: string; body: string; createdAt: string }> }>> {
    return this.ghl.apiRequest(
      userId,
      connectionId,
      "GET",
      `/contacts/${contactId}/notes`
    );
  }

  /**
   * Add a note to a contact
   */
  async addNote(
    userId: number,
    connectionId: number,
    contactId: string,
    body: string
  ): Promise<GhlApiResponse<{ note: { id: string; body: string } }>> {
    return this.ghl.apiRequest(
      userId,
      connectionId,
      "POST",
      `/contacts/${contactId}/notes`,
      {
        body: { body },
      }
    );
  }

  // ----------------------------------------
  // Merge Duplicates (FR-014)
  // ----------------------------------------

  /**
   * Merge duplicate contacts into a primary contact
   * The primary contact survives; duplicate contacts are merged in.
   */
  async merge(
    userId: number,
    connectionId: number,
    primaryContactId: string,
    duplicateContactIds: string[]
  ): Promise<GhlApiResponse<{ contact: GhlContact }>> {
    // GHL doesn't have a direct merge endpoint.
    // We implement merge by:
    // 1. Getting all contacts
    // 2. Combining their data onto the primary
    // 3. Deleting the duplicates

    const primaryResult = await this.get(userId, connectionId, primaryContactId);
    if (!primaryResult.success || !primaryResult.data) {
      return { success: false, error: "Primary contact not found" };
    }

    const primary = primaryResult.data.contact;
    const mergedTags = new Set(primary.tags || []);
    const mergedCustomFields = new Map(
      (primary.customFields || []).map((cf) => [cf.id, cf.value])
    );
    const notes: string[] = [];

    // Gather data from duplicates
    for (const dupId of duplicateContactIds) {
      const dupResult = await this.get(userId, connectionId, dupId);
      if (!dupResult.success || !dupResult.data) continue;

      const dup = dupResult.data.contact;

      // Merge tags
      (dup.tags || []).forEach((tag) => mergedTags.add(tag));

      // Merge custom fields (keep existing, add new)
      (dup.customFields || []).forEach((cf) => {
        if (!mergedCustomFields.has(cf.id)) {
          mergedCustomFields.set(cf.id, cf.value);
        }
      });

      // Collect notes about the merge
      notes.push(
        `Merged from contact ${dup.name || dup.email || dupId} (${dupId})`
      );
    }

    // Update primary with merged data
    const updateData: GhlContactUpdateInput = {
      tags: Array.from(mergedTags),
      customFields: Array.from(mergedCustomFields).map(([id, value]) => ({
        id,
        value,
      })),
    };

    const updateResult = await this.update(
      userId,
      connectionId,
      primaryContactId,
      updateData
    );

    // Add merge notes
    for (const note of notes) {
      await this.addNote(userId, connectionId, primaryContactId, note);
    }

    // Delete duplicates
    for (const dupId of duplicateContactIds) {
      await this.delete(userId, connectionId, dupId);
    }

    return updateResult;
  }

  // ----------------------------------------
  // Bulk Operations (FR-014)
  // ----------------------------------------

  /**
   * Bulk import contacts (up to 50K)
   * Processes in batches of 100 to respect rate limits
   */
  async bulkImport(
    userId: number,
    connectionId: number,
    locationId: string,
    contacts: GhlContactCreateInput[],
    options?: {
      batchSize?: number;
      onProgress?: (processed: number, total: number) => void;
    }
  ): Promise<GhlBulkImportResult> {
    const batchSize = options?.batchSize || 100;
    let created = 0;
    let updated = 0;
    let failed = 0;
    const errors: Array<{ index: number; error: string }> = [];

    for (let i = 0; i < contacts.length; i += batchSize) {
      const batch = contacts.slice(i, i + batchSize);

      for (let j = 0; j < batch.length; j++) {
        const contact = batch[j];
        const index = i + j;

        try {
          // Try to find existing contact by email or phone
          let existingId: string | undefined;

          if (contact.email) {
            const searchResult = await this.search(
              userId,
              connectionId,
              locationId,
              { email: contact.email, limit: 1 }
            );
            if (
              searchResult.success &&
              searchResult.data?.contacts?.length
            ) {
              existingId = searchResult.data.contacts[0].id;
            }
          }

          if (existingId) {
            // Update existing
            const result = await this.update(
              userId,
              connectionId,
              existingId,
              contact
            );
            if (result.success) {
              updated++;
            } else {
              failed++;
              errors.push({ index, error: result.error || "Update failed" });
            }
          } else {
            // Create new
            const result = await this.create(
              userId,
              connectionId,
              locationId,
              contact
            );
            if (result.success) {
              created++;
            } else {
              failed++;
              errors.push({ index, error: result.error || "Create failed" });
            }
          }
        } catch (err) {
          failed++;
          errors.push({
            index,
            error: err instanceof Error ? err.message : "Unknown error",
          });
        }
      }

      // Report progress
      const processed = Math.min(i + batchSize, contacts.length);
      options?.onProgress?.(processed, contacts.length);
    }

    return {
      success: failed === 0,
      totalProcessed: contacts.length,
      created,
      updated,
      failed,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Bulk export contacts to a flat array
   * Paginates through all contacts for the location
   */
  async bulkExport(
    userId: number,
    connectionId: number,
    locationId: string,
    filters?: GhlContactSearchParams,
    options?: {
      maxContacts?: number;
      onProgress?: (fetched: number) => void;
    }
  ): Promise<{
    success: boolean;
    contacts: GhlContact[];
    total: number;
  }> {
    const maxContacts = options?.maxContacts || 50000;
    const allContacts: GhlContact[] = [];
    let startAfterId: string | undefined;
    const pageSize = 100;

    while (allContacts.length < maxContacts) {
      const searchParams: GhlContactSearchParams = {
        ...filters,
        limit: pageSize,
      };

      if (startAfterId) {
        searchParams.startAfterId = startAfterId;
      }

      const result = await this.search(
        userId,
        connectionId,
        locationId,
        searchParams
      );

      if (!result.success || !result.data?.contacts?.length) {
        break;
      }

      allContacts.push(...result.data.contacts);
      options?.onProgress?.(allContacts.length);

      // Get the last contact ID for pagination
      const lastContact =
        result.data.contacts[result.data.contacts.length - 1];
      if (!lastContact?.id || result.data.contacts.length < pageSize) {
        break; // No more pages
      }

      startAfterId = lastContact.id;
    }

    return {
      success: true,
      contacts: allContacts,
      total: allContacts.length,
    };
  }

  /**
   * Convert contacts to CSV format
   */
  contactsToCsv(contacts: GhlContact[]): string {
    if (contacts.length === 0) return "";

    const headers = [
      "id",
      "firstName",
      "lastName",
      "email",
      "phone",
      "companyName",
      "address1",
      "city",
      "state",
      "postalCode",
      "country",
      "website",
      "source",
      "tags",
      "createdAt",
    ];

    const rows = contacts.map((c) =>
      headers
        .map((h) => {
          const val = c[h as keyof GhlContact];
          if (Array.isArray(val)) return `"${val.join(", ")}"`;
          if (val === undefined || val === null) return "";
          return `"${String(val).replace(/"/g, '""')}"`;
        })
        .join(",")
    );

    return [headers.join(","), ...rows].join("\n");
  }
}

// ========================================
// SINGLETON
// ========================================

let contactsServiceInstance: GhlContactsService | null = null;

export function getGhlContactsService(): GhlContactsService {
  if (!contactsServiceInstance) {
    contactsServiceInstance = new GhlContactsService();
  }
  return contactsServiceInstance;
}
