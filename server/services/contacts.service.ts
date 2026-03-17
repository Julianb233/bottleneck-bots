/**
 * GHL Contacts Service
 *
 * Wraps GHL API v2 endpoints for contact management:
 * - Search/list contacts with filters
 * - Get single contact by ID
 * - Create new contact
 * - Update existing contact
 * - Delete contact
 *
 * Uses GHLService for auth, rate limiting, and retry.
 *
 * Linear: AI-2877
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
  source?: string;
  tags?: string[];
  dateOfBirth?: string;
  dateAdded?: string;
  dateUpdated?: string;
  assignedTo?: string;
  dnd?: boolean;
  dndSettings?: {
    Call?: { status: string; message?: string; code?: string };
    Email?: { status: string; message?: string; code?: string };
    SMS?: { status: string; message?: string; code?: string };
    WhatsApp?: { status: string; message?: string; code?: string };
    GMB?: { status: string; message?: string; code?: string };
    FB?: { status: string; message?: string; code?: string };
  };
  customFields?: Array<{ id: string; value: unknown }>;
}

export interface GHLContactSearchResult {
  contacts: GHLContact[];
  meta: {
    total: number;
    currentPage: number;
    nextPage: number | null;
    previousPage: number | null;
  };
}

export interface CreateContactInput {
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
  source?: string;
  tags?: string[];
  dateOfBirth?: string;
  assignedTo?: string;
  dnd?: boolean;
  customFields?: Array<{ id: string; field_value: string | string[] }>;
}

export interface UpdateContactInput {
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
  source?: string;
  tags?: string[];
  dateOfBirth?: string;
  assignedTo?: string;
  dnd?: boolean;
  customFields?: Array<{ id: string; field_value: string | string[] }>;
}

export interface ContactSearchParams {
  query?: string;
  email?: string;
  phone?: string;
  tags?: string[];
  source?: string;
  assignedTo?: string;
  startAfter?: string;
  startAfterId?: string;
  limit?: number;
  order?: "date_added_asc" | "date_added_desc" | "date_updated_asc" | "date_updated_desc";
}

// ========================================
// CONTACTS SERVICE
// ========================================

export class ContactsService {
  private ghl: GHLService;

  constructor(ghl: GHLService) {
    this.ghl = ghl;
  }

  // ----------------------------------------
  // Search / List
  // ----------------------------------------

  async searchContacts(
    params: ContactSearchParams
  ): Promise<GHLContactSearchResult> {
    const queryParams: Record<string, string> = {};

    if (params.query) queryParams.query = params.query;
    if (params.email) queryParams.email = params.email;
    if (params.phone) queryParams.phone = params.phone;
    if (params.source) queryParams.source = params.source;
    if (params.assignedTo) queryParams.assignedTo = params.assignedTo;
    if (params.limit) queryParams.limit = String(params.limit);
    if (params.startAfter) queryParams.startAfter = params.startAfter;
    if (params.startAfterId) queryParams.startAfterId = params.startAfterId;
    if (params.order) queryParams.order = params.order;

    const response = await this.ghl.request<GHLContactSearchResult>({
      method: "GET",
      endpoint: "/contacts/",
      params: queryParams,
    });

    return response.data;
  }

  // ----------------------------------------
  // Get by ID
  // ----------------------------------------

  async getContact(contactId: string): Promise<GHLContact> {
    const response = await this.ghl.request<{ contact: GHLContact }>({
      method: "GET",
      endpoint: `/contacts/${contactId}`,
    });
    return response.data.contact;
  }

  // ----------------------------------------
  // Create
  // ----------------------------------------

  async createContact(input: CreateContactInput): Promise<GHLContact> {
    const response = await this.ghl.request<{ contact: GHLContact }>({
      method: "POST",
      endpoint: "/contacts/",
      data: input,
    });
    return response.data.contact;
  }

  // ----------------------------------------
  // Update
  // ----------------------------------------

  async updateContact(
    contactId: string,
    input: UpdateContactInput
  ): Promise<GHLContact> {
    const response = await this.ghl.request<{ contact: GHLContact }>({
      method: "PUT",
      endpoint: `/contacts/${contactId}`,
      data: input,
    });
    return response.data.contact;
  }

  // ----------------------------------------
  // Delete
  // ----------------------------------------

  async deleteContact(contactId: string): Promise<boolean> {
    await this.ghl.request({
      method: "DELETE",
      endpoint: `/contacts/${contactId}`,
    });
    return true;
  }

  // ----------------------------------------
  // Tag operations
  // ----------------------------------------

  async addTags(contactId: string, tags: string[]): Promise<GHLContact> {
    // GHL merges tags on update — fetch current, merge, and update
    const contact = await this.getContact(contactId);
    const existingTags = contact.tags || [];
    const mergedTags = Array.from(new Set([...existingTags, ...tags]));
    return this.updateContact(contactId, { tags: mergedTags });
  }

  async removeTags(contactId: string, tags: string[]): Promise<GHLContact> {
    const contact = await this.getContact(contactId);
    const existingTags = contact.tags || [];
    const filteredTags = existingTags.filter((t) => !tags.includes(t));
    return this.updateContact(contactId, { tags: filteredTags });
  }

  // ----------------------------------------
  // Lookup helpers
  // ----------------------------------------

  async findByEmail(email: string): Promise<GHLContact | null> {
    const result = await this.searchContacts({ email, limit: 1 });
    return result.contacts[0] || null;
  }

  async findByPhone(phone: string): Promise<GHLContact | null> {
    const result = await this.searchContacts({ phone, limit: 1 });
    return result.contacts[0] || null;
  }
}

// ========================================
// FACTORY
// ========================================

export function createContactsService(
  locationId: string,
  userId: number
): ContactsService {
  const ghl = new GHLService(locationId, userId);
  return new ContactsService(ghl);
}
