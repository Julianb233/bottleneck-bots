/**
 * GHL Contacts Service
 *
 * CRUD + search operations for GoHighLevel contacts via the GHL REST API v2.
 * Uses the core GHLService for authenticated requests with rate-limiting & retry.
 *
 * Endpoints consumed:
 *   GET    /contacts/{contactId}
 *   GET    /contacts/                  (search / list)
 *   POST   /contacts/
 *   PUT    /contacts/{contactId}
 *   DELETE /contacts/{contactId}
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
  timezone?: string;
  dnd?: boolean;
  tags?: string[];
  source?: string;
  customFields?: Array<{ id: string; value: unknown }>;
  dateOfBirth?: string;
  dateAdded?: string;
  dateUpdated?: string;
}

export interface GHLContactCreateInput {
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
  customFields?: Array<{ id: string; field_value: unknown }>;
}

export interface GHLContactUpdateInput extends Partial<GHLContactCreateInput> {}

export interface GHLContactSearchParams {
  query?: string;
  email?: string;
  phone?: string;
  limit?: number;
  startAfterId?: string;
  startAfter?: number;
}

export interface GHLContactListResponse {
  contacts: GHLContact[];
  meta: {
    total?: number;
    count?: number;
    currentPage?: number;
    nextPage?: string | null;
    nextPageUrl?: string | null;
    startAfterId?: string | null;
    startAfter?: number | null;
  };
}

// ========================================
// SERVICE
// ========================================

export class GHLContactsService {
  private ghl: GHLService;
  private locationId: string;

  constructor(ghl: GHLService, locationId: string) {
    this.ghl = ghl;
    this.locationId = locationId;
  }

  /**
   * Get a single contact by ID.
   */
  async getContact(contactId: string): Promise<GHLContact> {
    const res = await this.ghl.request<{ contact: GHLContact }>({
      method: "GET",
      endpoint: `/contacts/${contactId}`,
    });
    return res.data.contact;
  }

  /**
   * Search / list contacts for the location.
   */
  async searchContacts(
    params: GHLContactSearchParams = {}
  ): Promise<GHLContactListResponse> {
    const queryParams: Record<string, string> = {
      locationId: this.locationId,
    };

    if (params.query) queryParams.query = params.query;
    if (params.email) queryParams.email = params.email;
    if (params.phone) queryParams.phone = params.phone;
    if (params.limit) queryParams.limit = String(params.limit);
    if (params.startAfterId) queryParams.startAfterId = params.startAfterId;
    if (params.startAfter) queryParams.startAfter = String(params.startAfter);

    const res = await this.ghl.request<GHLContactListResponse>({
      method: "GET",
      endpoint: "/contacts/",
      params: queryParams,
    });

    return {
      contacts: res.data.contacts ?? [],
      meta: res.data.meta ?? {},
    };
  }

  /**
   * Create a new contact.
   */
  async createContact(input: GHLContactCreateInput): Promise<GHLContact> {
    const res = await this.ghl.request<{ contact: GHLContact }>({
      method: "POST",
      endpoint: "/contacts/",
      data: {
        ...input,
        locationId: this.locationId,
      },
    });
    return res.data.contact;
  }

  /**
   * Update an existing contact.
   */
  async updateContact(
    contactId: string,
    input: GHLContactUpdateInput
  ): Promise<GHLContact> {
    const res = await this.ghl.request<{ contact: GHLContact }>({
      method: "PUT",
      endpoint: `/contacts/${contactId}`,
      data: input,
    });
    return res.data.contact;
  }

  /**
   * Delete a contact.
   */
  async deleteContact(contactId: string): Promise<{ success: boolean }> {
    await this.ghl.request<{ succeded: boolean }>({
      method: "DELETE",
      endpoint: `/contacts/${contactId}`,
    });
    return { success: true };
  }
}

// ========================================
// FACTORY
// ========================================

/**
 * Create a GHL contacts service for a location + user.
 */
export function createGHLContactsService(
  locationId: string,
  userId: number
): GHLContactsService {
  const ghl = new GHLService(locationId, userId);
  return new GHLContactsService(ghl, locationId);
}
