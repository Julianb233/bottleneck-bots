/**
 * GHL Contacts Service
 *
 * Full CRUD + bulk operations for GoHighLevel contacts:
 * - Create, Get, Update, Delete contacts
 * - Search with filters
 * - Bulk import (up to 50K) and export (CSV)
 * - Tag management (add, remove, list)
 * - Custom field operations
 * - Activity timeline
 * - Contact merging
 *
 * All methods use the GHLService's rate-limited, authenticated HTTP client.
 *
 * Linear: AI-2870
 */

import { GHLService, type GHLApiResponse } from "./ghl.service";

// ========================================
// TYPES
// ========================================

export interface GHLContact {
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
  dnd?: boolean;
  tags?: string[];
  source?: string;
  customFields?: Array<{ id: string; key?: string; value: unknown }>;
  dateAdded?: string;
  dateUpdated?: string;
  assignedTo?: string;
}

export interface GHLContactCreateData {
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
  dnd?: boolean;
  tags?: string[];
  source?: string;
  customFields?: Array<{ id: string; key?: string; field_value: unknown }>;
  assignedTo?: string;
}

export interface GHLContactUpdateData extends Partial<GHLContactCreateData> {}

export interface GHLContactSearchFilters {
  query?: string;
  email?: string;
  phone?: string;
  tags?: string[];
  startAfter?: string;
  startBefore?: string;
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface GHLContactSearchResult {
  contacts: GHLContact[];
  total: number;
  count: number;
}

export interface GHLBulkImportContact {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  companyName?: string;
  tags?: string[];
  source?: string;
  customFields?: Array<{ id: string; field_value: unknown }>;
  [key: string]: unknown;
}

export interface GHLBulkImportResult {
  uploadId?: string;
  status: string;
  totalRecords: number;
  createdRecords?: number;
  updatedRecords?: number;
  failedRecords?: number;
}

export interface GHLBulkExportResult {
  exportId?: string;
  status: string;
  url?: string;
}

export interface GHLTag {
  id: string;
  name: string;
  locationId: string;
}

export interface GHLCustomField {
  id: string;
  name: string;
  fieldKey: string;
  dataType: string;
  position?: number;
  placeholder?: string;
  isRequired?: boolean;
}

export interface GHLContactActivity {
  id: string;
  contactId: string;
  type: string;
  body?: string;
  title?: string;
  dueDate?: string;
  completed?: boolean;
  assignedTo?: string;
  dateAdded?: string;
}

// ========================================
// CONTACTS SERVICE CLASS
// ========================================

export class GHLContactsService {
  private ghl: GHLService;
  private locationId: string;

  constructor(ghl: GHLService, locationId: string) {
    this.ghl = ghl;
    this.locationId = locationId;
  }

  // ----------------------------------------
  // CRUD Operations
  // ----------------------------------------

  /**
   * Create a new contact in GHL.
   */
  async create(
    data: GHLContactCreateData
  ): Promise<GHLApiResponse<{ contact: GHLContact }>> {
    return this.ghl.request<{ contact: GHLContact }>({
      method: "POST",
      endpoint: "/contacts/",
      data: {
        ...data,
        locationId: this.locationId,
      },
    });
  }

  /**
   * Get a contact by ID.
   */
  async get(
    contactId: string
  ): Promise<GHLApiResponse<{ contact: GHLContact }>> {
    return this.ghl.request<{ contact: GHLContact }>({
      method: "GET",
      endpoint: `/contacts/${contactId}`,
    });
  }

  /**
   * Update an existing contact.
   */
  async update(
    contactId: string,
    data: GHLContactUpdateData
  ): Promise<GHLApiResponse<{ contact: GHLContact }>> {
    return this.ghl.request<{ contact: GHLContact }>({
      method: "PUT",
      endpoint: `/contacts/${contactId}`,
      data,
    });
  }

  /**
   * Delete a contact by ID.
   */
  async delete(
    contactId: string
  ): Promise<GHLApiResponse<{ succeded: boolean }>> {
    return this.ghl.request<{ succeded: boolean }>({
      method: "DELETE",
      endpoint: `/contacts/${contactId}`,
    });
  }

  // ----------------------------------------
  // Search
  // ----------------------------------------

  /**
   * Search contacts with query and filters.
   */
  async search(
    filters: GHLContactSearchFilters = {}
  ): Promise<GHLApiResponse<GHLContactSearchResult>> {
    const params: Record<string, string> = {
      locationId: this.locationId,
    };

    if (filters.query) params.query = filters.query;
    if (filters.email) params.email = filters.email;
    if (filters.phone) params.phone = filters.phone;
    if (filters.limit) params.limit = String(filters.limit);
    if (filters.offset) params.offset = String(filters.offset);
    if (filters.sortBy) params.sortBy = filters.sortBy;
    if (filters.sortOrder) params.sortOrder = filters.sortOrder;
    if (filters.startAfter) params.startAfter = filters.startAfter;
    if (filters.startBefore) params.startBefore = filters.startBefore;

    return this.ghl.request<GHLContactSearchResult>({
      method: "GET",
      endpoint: "/contacts/search",
      params,
    });
  }

  // ----------------------------------------
  // Bulk Operations
  // ----------------------------------------

  /**
   * Bulk import contacts (up to 50,000 per batch).
   */
  async bulkImport(
    contacts: GHLBulkImportContact[]
  ): Promise<GHLApiResponse<GHLBulkImportResult>> {
    if (contacts.length > 50_000) {
      throw new Error(
        `Bulk import supports up to 50,000 contacts per batch. Got ${contacts.length}.`
      );
    }

    return this.ghl.request<GHLBulkImportResult>({
      method: "POST",
      endpoint: "/contacts/bulk/import",
      data: {
        locationId: this.locationId,
        contacts,
      },
    });
  }

  /**
   * Bulk export contacts to CSV.
   */
  async bulkExport(
    filters?: GHLContactSearchFilters
  ): Promise<GHLApiResponse<GHLBulkExportResult>> {
    return this.ghl.request<GHLBulkExportResult>({
      method: "POST",
      endpoint: "/contacts/bulk/export",
      data: {
        locationId: this.locationId,
        ...(filters || {}),
      },
    });
  }

  // ----------------------------------------
  // Tag Management
  // ----------------------------------------

  /**
   * Add a tag to a contact.
   */
  async addTag(
    contactId: string,
    tag: string
  ): Promise<GHLApiResponse<{ tags: string[] }>> {
    return this.ghl.request<{ tags: string[] }>({
      method: "POST",
      endpoint: `/contacts/${contactId}/tags`,
      data: { tags: [tag] },
    });
  }

  /**
   * Remove a tag from a contact.
   */
  async removeTag(
    contactId: string,
    tag: string
  ): Promise<GHLApiResponse<{ tags: string[] }>> {
    return this.ghl.request<{ tags: string[] }>({
      method: "DELETE",
      endpoint: `/contacts/${contactId}/tags`,
      data: { tags: [tag] },
    });
  }

  /**
   * List all tags for a location.
   */
  async listTags(): Promise<GHLApiResponse<{ tags: GHLTag[] }>> {
    return this.ghl.request<{ tags: GHLTag[] }>({
      method: "GET",
      endpoint: "/locations/tags",
      params: { locationId: this.locationId },
    });
  }

  // ----------------------------------------
  // Custom Fields
  // ----------------------------------------

  /**
   * Get all custom fields for a location.
   */
  async getCustomFields(): Promise<
    GHLApiResponse<{ customFields: GHLCustomField[] }>
  > {
    return this.ghl.request<{ customFields: GHLCustomField[] }>({
      method: "GET",
      endpoint: "/locations/customFields",
      params: { locationId: this.locationId },
    });
  }

  /**
   * Update a custom field value on a contact.
   */
  async updateCustomField(
    contactId: string,
    fieldId: string,
    value: unknown
  ): Promise<GHLApiResponse<{ contact: GHLContact }>> {
    return this.ghl.request<{ contact: GHLContact }>({
      method: "PUT",
      endpoint: `/contacts/${contactId}`,
      data: {
        customFields: [{ id: fieldId, field_value: value }],
      },
    });
  }

  // ----------------------------------------
  // Activity
  // ----------------------------------------

  /**
   * Get activity timeline (tasks) for a contact.
   */
  async getActivity(
    contactId: string
  ): Promise<GHLApiResponse<{ tasks: GHLContactActivity[] }>> {
    return this.ghl.request<{ tasks: GHLContactActivity[] }>({
      method: "GET",
      endpoint: `/contacts/${contactId}/tasks`,
    });
  }

  // ----------------------------------------
  // Merge
  // ----------------------------------------

  /**
   * Merge duplicate contacts into a primary contact.
   * The primary contact absorbs data from duplicates, which are then deleted.
   */
  async merge(
    primaryId: string,
    duplicateIds: string[]
  ): Promise<GHLApiResponse<{ contact: GHLContact }>> {
    return this.ghl.request<{ contact: GHLContact }>({
      method: "POST",
      endpoint: `/contacts/${primaryId}/merge`,
      data: {
        contactIds: duplicateIds,
        locationId: this.locationId,
      },
    });
  }
}

// ========================================
// FACTORY
// ========================================

/**
 * Create a GHL Contacts service instance.
 * Uses an existing GHLService for authenticated, rate-limited requests.
 */
export function createGHLContactsService(
  ghl: GHLService,
  locationId: string
): GHLContactsService {
  return new GHLContactsService(ghl, locationId);
}
