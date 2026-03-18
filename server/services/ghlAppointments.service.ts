/**
 * GHL Appointments Service
 *
 * CRUD operations for GoHighLevel calendar appointments:
 * - Create appointment
 * - Get appointment by ID
 * - Update appointment
 * - Delete (cancel) appointment
 * - Check calendar availability
 *
 * Uses the GHL core service (ghl.service.ts) for authenticated API calls.
 *
 * Linear: AI-2870
 */

import { GHLService, GHLError, type GHLApiResponse } from "./ghl.service";

// ========================================
// TYPES
// ========================================

export interface GHLAppointment {
  id: string;
  calendarId: string;
  locationId: string;
  contactId: string;
  title?: string;
  status: string;
  startTime: string;
  endTime: string;
  appointmentStatus?: string;
  assignedUserId?: string;
  notes?: string;
  address?: string;
  [key: string]: unknown;
}

export interface CreateAppointmentData {
  calendarId: string;
  contactId: string;
  startTime: string; // ISO 8601
  endTime: string;   // ISO 8601
  title?: string;
  appointmentStatus?: string;
  assignedUserId?: string;
  notes?: string;
  address?: string;
  toNotify?: boolean;
  [key: string]: unknown;
}

export interface UpdateAppointmentData {
  calendarId?: string;
  contactId?: string;
  startTime?: string;
  endTime?: string;
  title?: string;
  appointmentStatus?: string;
  assignedUserId?: string;
  notes?: string;
  address?: string;
  toNotify?: boolean;
  [key: string]: unknown;
}

export interface CalendarSlot {
  startTime: string;
  endTime: string;
}

export interface AvailabilityResponse {
  available: boolean;
  slots: CalendarSlot[];
  [key: string]: unknown;
}

// ========================================
// APPOINTMENTS SERVICE
// ========================================

export class GHLAppointmentsService {
  private ghl: GHLService;
  private locationId: string;

  constructor(locationId: string, userId: number) {
    this.locationId = locationId;
    this.ghl = new GHLService(locationId, userId);
  }

  // ----------------------------------------
  // CRUD Operations
  // ----------------------------------------

  /**
   * Create a new appointment in GHL.
   *
   * POST /calendars/events/appointments
   */
  async create(data: CreateAppointmentData): Promise<GHLAppointment> {
    const response = await this.ghl.request<{ appointment: GHLAppointment }>({
      method: "POST",
      endpoint: "/calendars/events/appointments",
      data: {
        ...data,
        locationId: this.locationId,
      },
    });

    console.log(
      `[GHL Appointments] Created appointment ${response.data.appointment?.id} for location ${this.locationId}`
    );

    return response.data.appointment;
  }

  /**
   * Get an appointment by ID.
   *
   * GET /calendars/events/appointments/:appointmentId
   */
  async get(appointmentId: string): Promise<GHLAppointment> {
    const response = await this.ghl.request<{ appointment: GHLAppointment }>({
      method: "GET",
      endpoint: `/calendars/events/appointments/${appointmentId}`,
    });

    return response.data.appointment;
  }

  /**
   * Update an existing appointment.
   *
   * PUT /calendars/events/appointments/:appointmentId
   */
  async update(
    appointmentId: string,
    data: UpdateAppointmentData
  ): Promise<GHLAppointment> {
    const response = await this.ghl.request<{ appointment: GHLAppointment }>({
      method: "PUT",
      endpoint: `/calendars/events/appointments/${appointmentId}`,
      data: {
        ...data,
        locationId: this.locationId,
      },
    });

    console.log(
      `[GHL Appointments] Updated appointment ${appointmentId} for location ${this.locationId}`
    );

    return response.data.appointment;
  }

  /**
   * Delete (cancel) an appointment.
   *
   * DELETE /calendars/events/appointments/:appointmentId
   */
  async delete(appointmentId: string): Promise<{ success: boolean }> {
    await this.ghl.request<void>({
      method: "DELETE",
      endpoint: `/calendars/events/appointments/${appointmentId}`,
    });

    console.log(
      `[GHL Appointments] Deleted appointment ${appointmentId} for location ${this.locationId}`
    );

    return { success: true };
  }

  /**
   * Check calendar availability for a specific date.
   *
   * GET /calendars/:calendarId/free-slots?startDate=...&endDate=...
   */
  async getAvailability(
    calendarId: string,
    date: string,
    endDate?: string
  ): Promise<AvailabilityResponse> {
    // Default end date to same day if not provided
    const start = date;
    const end = endDate || date;

    const response = await this.ghl.request<AvailabilityResponse>({
      method: "GET",
      endpoint: `/calendars/${calendarId}/free-slots`,
      params: {
        startDate: start,
        endDate: end,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
    });

    const rawSlots = response.data.slots || (response.data as any)?.["_dates_"] || [];
    const normalizedSlots = Array.isArray(rawSlots) ? rawSlots : [];
    const isAvailable = normalizedSlots.length > 0;

    // Spread response data first, then override with normalized values
    const { slots: _s, available: _a, ...rest } = response.data;
    return {
      ...rest,
      available: isAvailable,
      slots: normalizedSlots,
    };
  }
}

// ========================================
// FACTORY
// ========================================

/**
 * Create a GHL Appointments service for a given location and user.
 */
export function createGHLAppointmentsService(
  locationId: string,
  userId: number
): GHLAppointmentsService {
  return new GHLAppointmentsService(locationId, userId);
}
