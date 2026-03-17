/**
 * GHL Calendar & Appointments Automation Functions
 * Module 6: Create calendars, appointment types, book/reschedule/cancel appointments
 */

import { Stagehand } from "@browserbasehq/stagehand";
import { z } from "zod";
import type {
  GHLAutomationContext,
  GHLAutomationResult,
  CalendarCreateInput,
  AppointmentTypeCreateInput,
  AppointmentBookInput,
  AppointmentRescheduleInput,
  AppointmentCancelInput,
} from "./types";
import {
  executeFunction,
  navigateTo,
  safeAct,
  delay,
  getPage,
  searchContact,
  fillField,
} from "./helpers";

// ========================================
// Day names for iterating availability
// ========================================

const WEEKDAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

// ========================================
// 1. CALENDAR CREATE
// ========================================

/**
 * Create an appointment calendar in GHL.
 * Navigates to /calendars, clicks Create Calendar, configures name, description,
 * availability hours, buffer/notice/range, assigns users, and saves.
 */
export async function calendarCreate(
  stagehand: Stagehand,
  ctx: GHLAutomationContext,
  input: CalendarCreateInput
): Promise<GHLAutomationResult> {
  return executeFunction("calendar_create", async () => {
    // Navigate to calendars page
    await navigateTo(stagehand, ctx, "/calendars", {
      waitForSelector: '[data-testid="calendar-list"], .calendar-list, .calendars-container',
    });

    // Click Create Calendar button
    const clickedCreate = await safeAct(
      stagehand,
      'Click the "Create Calendar" or "New Calendar" or "+ Add Calendar" button'
    );
    if (!clickedCreate) {
      throw new Error("Could not find Create Calendar button");
    }
    await delay(2000);

    // Set calendar name
    const namedOk = await safeAct(
      stagehand,
      `Type "${input.name}" into the calendar name input field`
    );
    if (!namedOk) {
      // Fallback to Playwright fill
      await fillField(
        stagehand,
        'input[name="name"], input[placeholder*="Calendar Name" i], input[placeholder*="name" i]',
        input.name,
        `Clear the calendar name field and type "${input.name}"`
      );
    }

    // Set description if provided
    if (input.description) {
      await safeAct(
        stagehand,
        `Type "${input.description}" into the description or details field`
      );
    }

    // Configure availability by day
    if (input.availability) {
      for (const day of WEEKDAYS) {
        const config = input.availability[day];
        if (!config) continue;

        if (config.enabled) {
          // Enable the day if not already enabled
          await safeAct(
            stagehand,
            `Make sure ${day} is enabled/toggled on in the availability settings`
          );

          // Set start time
          if (config.startTime) {
            await safeAct(
              stagehand,
              `Set the start time for ${day} to ${config.startTime}`
            );
          }

          // Set end time
          if (config.endTime) {
            await safeAct(
              stagehand,
              `Set the end time for ${day} to ${config.endTime}`
            );
          }
        } else {
          // Disable the day
          await safeAct(
            stagehand,
            `Disable or toggle off ${day} in the availability settings`
          );
        }
      }
    }

    // Set buffer time
    if (input.bufferTime !== undefined) {
      await safeAct(
        stagehand,
        `Set the buffer time or meeting interval to ${input.bufferTime} minutes`
      );
    }

    // Set minimum notice
    if (input.minimumNotice !== undefined) {
      await safeAct(
        stagehand,
        `Set the minimum scheduling notice to ${input.minimumNotice} hours`
      );
    }

    // Set date range
    if (input.dateRange !== undefined) {
      await safeAct(
        stagehand,
        `Set the date range or scheduling window to ${input.dateRange} days into the future`
      );
    }

    // Assign users
    if (input.assignedUsers && input.assignedUsers.length > 0) {
      for (const user of input.assignedUsers) {
        await safeAct(
          stagehand,
          `Add or assign user "${user}" to this calendar`
        );
        await delay(500);
      }
    }

    // Save the calendar
    const saved = await safeAct(
      stagehand,
      'Click the "Save" or "Create" or "Save Calendar" button to save the calendar'
    );
    if (!saved) {
      throw new Error("Could not save calendar");
    }
    await delay(2000);

    console.log(`[GHL calendar_create] Calendar "${input.name}" created`);
    return { calendarName: input.name };
  });
}

// ========================================
// 2. APPOINTMENT TYPE CREATE
// ========================================

/**
 * Create an appointment type/service in GHL.
 * Navigates to calendar settings, adds a new appointment type with name, duration,
 * description, color, meeting location, reminder settings, form fields, and saves.
 */
export async function appointmentTypeCreate(
  stagehand: Stagehand,
  ctx: GHLAutomationContext,
  input: AppointmentTypeCreateInput
): Promise<GHLAutomationResult> {
  return executeFunction("appointment_type_create", async () => {
    // Navigate to calendars page
    await navigateTo(stagehand, ctx, "/calendars", {
      waitForSelector: '[data-testid="calendar-list"], .calendar-list, .calendars-container',
    });

    // If a specific calendar was specified, open its settings
    if (input.calendarName) {
      const foundCalendar = await safeAct(
        stagehand,
        `Click on the calendar named "${input.calendarName}" or its settings/edit icon`
      );
      if (!foundCalendar) {
        throw new Error(`Could not find calendar "${input.calendarName}"`);
      }
      await delay(2000);
    }

    // Click add appointment type
    const clickedAdd = await safeAct(
      stagehand,
      'Click "Add Appointment Type" or "New Service" or "Add Service" or "+ New" button'
    );
    if (!clickedAdd) {
      throw new Error("Could not find Add Appointment Type button");
    }
    await delay(2000);

    // Set appointment type name
    await safeAct(
      stagehand,
      `Type "${input.name}" into the appointment type name or title field`
    );

    // Set duration
    await safeAct(
      stagehand,
      `Set the duration to ${input.duration} minutes`
    );

    // Set description if provided
    if (input.description) {
      await safeAct(
        stagehand,
        `Type "${input.description}" into the description field`
      );
    }

    // Set color if provided
    if (input.color) {
      await safeAct(
        stagehand,
        `Select or set the color to "${input.color}" for this appointment type`
      );
    }

    // Configure meeting location
    if (input.meetingLocation) {
      const locationLabels: Record<string, string> = {
        zoom: "Zoom",
        google_meet: "Google Meet",
        phone: "Phone",
        in_person: "In Person",
        custom: "Custom",
      };
      const locationLabel = locationLabels[input.meetingLocation] || input.meetingLocation;

      await safeAct(
        stagehand,
        `Select "${locationLabel}" as the meeting location type`
      );
      await delay(500);

      // If custom, set the URL
      if (input.meetingLocation === "custom" && input.customLocationUrl) {
        await safeAct(
          stagehand,
          `Type "${input.customLocationUrl}" into the custom meeting URL or location field`
        );
      }
    }

    // Set confirmation message
    if (input.confirmationMessage) {
      await safeAct(
        stagehand,
        `Type "${input.confirmationMessage}" into the confirmation message or thank you message field`
      );
    }

    // Add form fields
    if (input.formFields && input.formFields.length > 0) {
      for (const field of input.formFields) {
        await safeAct(
          stagehand,
          'Click "Add Field" or "Add Form Field" or "+ Add" to add a new form field'
        );
        await delay(1000);

        await safeAct(
          stagehand,
          `Set the field label to "${field.label}" and type to "${field.type}"`
        );

        if (field.required) {
          await safeAct(
            stagehand,
            `Mark the "${field.label}" field as required`
          );
        }
        await delay(500);
      }
    }

    // Save the appointment type
    const saved = await safeAct(
      stagehand,
      'Click the "Save" or "Create" or "Done" button to save the appointment type'
    );
    if (!saved) {
      throw new Error("Could not save appointment type");
    }
    await delay(2000);

    console.log(`[GHL appointment_type_create] Appointment type "${input.name}" created`);
    return { appointmentTypeName: input.name, duration: input.duration };
  });
}

// ========================================
// 3. APPOINTMENT BOOK
// ========================================

/**
 * Manually book an appointment in GHL.
 * Searches for a contact, selects calendar/type, picks date and time,
 * adds notes, and confirms the booking.
 */
export async function appointmentBook(
  stagehand: Stagehand,
  ctx: GHLAutomationContext,
  input: AppointmentBookInput
): Promise<GHLAutomationResult> {
  return executeFunction("appointment_book", async () => {
    // Navigate to calendars page
    await navigateTo(stagehand, ctx, "/calendars", {
      waitForSelector: '[data-testid="calendar-list"], .calendar-list, .calendars-container',
    });

    // Click to book a new appointment
    const clickedBook = await safeAct(
      stagehand,
      'Click "Book Appointment" or "New Appointment" or "+" button to create a new appointment'
    );
    if (!clickedBook) {
      // Try the appointment view's add button
      await safeAct(
        stagehand,
        'Click on a time slot or the "Add" button to start booking an appointment'
      );
    }
    await delay(2000);

    // Search for and select the contact
    const contactFound = await safeAct(
      stagehand,
      `Search for contact "${input.contactSearchTerm}" in the contact search field and select them from the results`
    );
    if (!contactFound) {
      // Fallback: use the searchContact helper then navigate back
      const found = await searchContact(stagehand, ctx, input.contactSearchTerm);
      if (!found) {
        throw new Error(`Contact "${input.contactSearchTerm}" not found`);
      }
      // Navigate back to calendars to continue booking
      await navigateTo(stagehand, ctx, "/calendars");
      await safeAct(
        stagehand,
        'Click "Book Appointment" or "New Appointment" button'
      );
      await delay(1000);
      await safeAct(
        stagehand,
        `Select contact "${input.contactSearchTerm}" from the contact field`
      );
    }
    await delay(1000);

    // Select calendar if specified
    if (input.calendarName) {
      await safeAct(
        stagehand,
        `Select the calendar "${input.calendarName}" from the calendar dropdown or list`
      );
      await delay(500);
    }

    // Select appointment type if specified
    if (input.appointmentType) {
      await safeAct(
        stagehand,
        `Select the appointment type "${input.appointmentType}" from the appointment type dropdown or list`
      );
      await delay(500);
    }

    // Select the date
    await safeAct(
      stagehand,
      `Select the date ${input.date} on the date picker or calendar`
    );
    await delay(1000);

    // Select the time
    await safeAct(
      stagehand,
      `Select the time ${input.time} from the available time slots or time picker`
    );
    await delay(500);

    // Add notes if provided
    if (input.notes) {
      await safeAct(
        stagehand,
        `Type "${input.notes}" into the notes or additional information field`
      );
    }

    // Confirm the booking
    const confirmed = await safeAct(
      stagehand,
      'Click the "Book" or "Confirm" or "Save Appointment" or "Schedule" button to confirm the booking'
    );
    if (!confirmed) {
      throw new Error("Could not confirm appointment booking");
    }
    await delay(2000);

    console.log(
      `[GHL appointment_book] Appointment booked for "${input.contactSearchTerm}" on ${input.date} at ${input.time}`
    );
    return {
      contact: input.contactSearchTerm,
      date: input.date,
      time: input.time,
      calendar: input.calendarName,
      appointmentType: input.appointmentType,
    };
  });
}

// ========================================
// 4. APPOINTMENT RESCHEDULE
// ========================================

/**
 * Reschedule an existing appointment in GHL.
 * Finds the appointment by contact, changes the date/time,
 * adds a reason, and saves.
 */
export async function appointmentReschedule(
  stagehand: Stagehand,
  ctx: GHLAutomationContext,
  input: AppointmentRescheduleInput
): Promise<GHLAutomationResult> {
  return executeFunction("appointment_reschedule", async () => {
    // Navigate to calendars page
    await navigateTo(stagehand, ctx, "/calendars", {
      waitForSelector: '[data-testid="calendar-list"], .calendar-list, .calendars-container',
    });

    // If original date provided, navigate to that date first
    if (input.originalDate) {
      await safeAct(
        stagehand,
        `Navigate to the date ${input.originalDate} on the calendar view`
      );
      await delay(1000);
    }

    // Find the appointment by contact name
    const foundAppt = await safeAct(
      stagehand,
      `Find and click on the appointment for contact "${input.contactSearchTerm}" on the calendar`
    );
    if (!foundAppt) {
      // Try searching through the appointment list view
      await safeAct(
        stagehand,
        'Switch to list view or search for appointments'
      );
      await delay(1000);

      const searchedAppt = await safeAct(
        stagehand,
        `Search for "${input.contactSearchTerm}" in the appointments search or filter and click on their appointment`
      );
      if (!searchedAppt) {
        throw new Error(
          `Could not find appointment for "${input.contactSearchTerm}"`
        );
      }
    }
    await delay(2000);

    // Click reschedule
    const clickedReschedule = await safeAct(
      stagehand,
      'Click "Reschedule" or "Edit" or "Change Time" button on the appointment details'
    );
    if (!clickedReschedule) {
      throw new Error("Could not find reschedule option");
    }
    await delay(2000);

    // Set new date
    await safeAct(
      stagehand,
      `Select the new date ${input.newDate} on the date picker or calendar`
    );
    await delay(1000);

    // Set new time
    await safeAct(
      stagehand,
      `Select the new time ${input.newTime} from the available time slots or time picker`
    );
    await delay(500);

    // Add reason if provided
    if (input.reason) {
      await safeAct(
        stagehand,
        `Type "${input.reason}" into the reason or notes field for rescheduling`
      );
    }

    // Save the rescheduled appointment
    const saved = await safeAct(
      stagehand,
      'Click the "Save" or "Confirm" or "Update" or "Reschedule" button to save the rescheduled appointment'
    );
    if (!saved) {
      throw new Error("Could not save rescheduled appointment");
    }
    await delay(2000);

    console.log(
      `[GHL appointment_reschedule] Appointment for "${input.contactSearchTerm}" rescheduled to ${input.newDate} at ${input.newTime}`
    );
    return {
      contact: input.contactSearchTerm,
      newDate: input.newDate,
      newTime: input.newTime,
      reason: input.reason,
    };
  });
}

// ========================================
// 5. APPOINTMENT CANCEL
// ========================================

/**
 * Cancel an appointment in GHL.
 * Finds the appointment by contact, clicks cancel, adds a reason,
 * optionally notifies the contact, and confirms cancellation.
 */
export async function appointmentCancel(
  stagehand: Stagehand,
  ctx: GHLAutomationContext,
  input: AppointmentCancelInput
): Promise<GHLAutomationResult> {
  return executeFunction("appointment_cancel", async () => {
    // Navigate to calendars page
    await navigateTo(stagehand, ctx, "/calendars", {
      waitForSelector: '[data-testid="calendar-list"], .calendar-list, .calendars-container',
    });

    // If appointment date provided, navigate to that date
    if (input.appointmentDate) {
      await safeAct(
        stagehand,
        `Navigate to the date ${input.appointmentDate} on the calendar view`
      );
      await delay(1000);
    }

    // Find the appointment by contact name
    const foundAppt = await safeAct(
      stagehand,
      `Find and click on the appointment for contact "${input.contactSearchTerm}" on the calendar`
    );
    if (!foundAppt) {
      // Try searching through the appointment list view
      await safeAct(
        stagehand,
        'Switch to list view or search for appointments'
      );
      await delay(1000);

      const searchedAppt = await safeAct(
        stagehand,
        `Search for "${input.contactSearchTerm}" in the appointments search or filter and click on their appointment`
      );
      if (!searchedAppt) {
        throw new Error(
          `Could not find appointment for "${input.contactSearchTerm}"`
        );
      }
    }
    await delay(2000);

    // Click cancel
    const clickedCancel = await safeAct(
      stagehand,
      'Click "Cancel" or "Cancel Appointment" or "Delete" button on the appointment details'
    );
    if (!clickedCancel) {
      throw new Error("Could not find cancel option");
    }
    await delay(1500);

    // Add cancellation reason if provided
    if (input.reason) {
      await safeAct(
        stagehand,
        `Type "${input.reason}" into the cancellation reason or notes field`
      );
    }

    // Handle notify contact toggle
    if (input.notifyContact !== undefined) {
      if (input.notifyContact) {
        await safeAct(
          stagehand,
          "Make sure the notify contact checkbox or toggle is enabled/checked"
        );
      } else {
        await safeAct(
          stagehand,
          "Uncheck or disable the notify contact checkbox or toggle"
        );
      }
    }

    // Confirm the cancellation
    const confirmed = await safeAct(
      stagehand,
      'Click the "Confirm" or "Yes, Cancel" or "Cancel Appointment" or "OK" button to confirm the cancellation'
    );
    if (!confirmed) {
      throw new Error("Could not confirm appointment cancellation");
    }
    await delay(2000);

    console.log(
      `[GHL appointment_cancel] Appointment for "${input.contactSearchTerm}" cancelled`
    );
    return {
      contact: input.contactSearchTerm,
      cancelled: true,
      reason: input.reason,
      contactNotified: input.notifyContact,
    };
  });
}
