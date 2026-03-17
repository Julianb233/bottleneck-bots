/**
 * GHL Contacts & CRM Automation Functions
 * Module 1: 7 functions for contact management in GoHighLevel
 */

import { Stagehand } from "@browserbasehq/stagehand";
import type {
  GHLAutomationContext,
  GHLAutomationResult,
  ContactCreateInput,
  ContactImportInput,
  ContactEditInput,
  ContactTagInput,
  ContactDeleteInput,
  CustomFieldCreateInput,
  SmartListCreateInput,
} from "./types";
import {
  getPage,
  delay,
  navigateTo,
  executeFunction,
  safeAct,
  fillField,
  handleDuplicateModal,
  searchContact,
  openFirstContact,
  confirmDialog,
} from "./helpers";

// ========================================
// 1. contactCreate
// ========================================

/**
 * Create a new contact with basic info.
 * Navigates to contacts, clicks Add Contact, fills form fields, and saves.
 * Handles duplicate contact modal if it appears.
 */
export async function contactCreate(
  stagehand: Stagehand,
  ctx: GHLAutomationContext,
  input: ContactCreateInput
): Promise<GHLAutomationResult> {
  return executeFunction("contact_create", async () => {
    // Navigate to contacts page
    await navigateTo(stagehand, ctx, "/contacts");

    // Click Add Contact button
    await safeAct(stagehand, "Click the 'Add Contact' or 'Add New Contact' button");
    await delay(1500);

    // Fill basic contact fields
    if (input.firstName) {
      await safeAct(stagehand, `Type "${input.firstName}" into the First Name field`);
    }
    if (input.lastName) {
      await safeAct(stagehand, `Type "${input.lastName}" into the Last Name field`);
    }
    if (input.email) {
      await safeAct(stagehand, `Type "${input.email}" into the Email field`);
    }
    if (input.phone) {
      // Use fillField for phone to avoid formatting issues with type()
      const filled = await fillField(
        stagehand,
        'input[name="phone"], input[placeholder*="Phone"], input[data-testid="phone"]',
        input.phone,
        `Type "${input.phone}" into the Phone field`
      );
      if (!filled) {
        await safeAct(stagehand, `Type "${input.phone}" into the Phone field`);
      }
    }
    if (input.companyName) {
      await safeAct(stagehand, `Type "${input.companyName}" into the Company Name field`);
    }

    // Fill address fields if provided
    if (input.address) {
      if (input.address.street) {
        await safeAct(stagehand, `Type "${input.address.street}" into the Street Address or Address Line 1 field`);
      }
      if (input.address.city) {
        await safeAct(stagehand, `Type "${input.address.city}" into the City field`);
      }
      if (input.address.state) {
        await safeAct(stagehand, `Type "${input.address.state}" into the State field`);
      }
      if (input.address.zip) {
        await safeAct(stagehand, `Type "${input.address.zip}" into the Postal Code or Zip Code field`);
      }
      if (input.address.country) {
        await safeAct(stagehand, `Select or type "${input.address.country}" in the Country field`);
      }
    }

    // Add tags if provided
    if (input.tags && input.tags.length > 0) {
      for (const tag of input.tags) {
        await safeAct(stagehand, `Click on the Tags field, type "${tag}", and press Enter to add the tag`);
        await delay(500);
      }
    }

    // Set source if provided
    if (input.source) {
      await safeAct(stagehand, `Select or type "${input.source}" in the Source field`);
    }

    // Set assigned user if provided
    if (input.assignedUser) {
      await safeAct(stagehand, `Select "${input.assignedUser}" from the Assigned User or Owner dropdown`);
    }

    // Set contact type if provided
    if (input.contactType) {
      await safeAct(stagehand, `Select "${input.contactType}" from the Contact Type dropdown`);
    }

    // Fill custom fields if provided
    if (input.customFields) {
      for (const [fieldName, value] of Object.entries(input.customFields)) {
        await safeAct(stagehand, `Find the custom field labeled "${fieldName}" and type "${value}" into it`);
        await delay(300);
      }
    }

    // Save the contact
    await safeAct(stagehand, "Click the Save or Create Contact button");
    await delay(2000);

    // Handle duplicate contact modal if it appears
    await handleDuplicateModal(stagehand);

    return {
      contactName: [input.firstName, input.lastName].filter(Boolean).join(" "),
      email: input.email,
      phone: input.phone,
    };
  });
}

// ========================================
// 2. contactImportCsv
// ========================================

/**
 * Import contacts from a CSV file.
 * Navigates to contacts, clicks Import, uploads the file, maps columns, and confirms.
 */
export async function contactImportCsv(
  stagehand: Stagehand,
  ctx: GHLAutomationContext,
  input: ContactImportInput
): Promise<GHLAutomationResult> {
  return executeFunction("contact_import_csv", async () => {
    const page = getPage(stagehand);

    // Navigate to contacts page
    await navigateTo(stagehand, ctx, "/contacts");

    // Click Import button
    await safeAct(stagehand, "Click the Import or Import Contacts button");
    await delay(1500);

    // Upload CSV file using file chooser
    const fileChooserPromise = page.waitForEvent("filechooser", { timeout: 10000 });
    await safeAct(stagehand, "Click the file upload area or 'Choose File' button to upload a CSV");
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(input.csvFilePath);
    await delay(2000);

    // Map columns if mapping provided
    if (input.columnMapping) {
      for (const [csvColumn, ghlField] of Object.entries(input.columnMapping)) {
        await safeAct(
          stagehand,
          `For the CSV column "${csvColumn}", select "${ghlField}" from the mapping dropdown`
        );
        await delay(500);
      }
    }

    // Apply tags to imported contacts
    if (input.tags && input.tags.length > 0) {
      for (const tag of input.tags) {
        await safeAct(stagehand, `Add the tag "${tag}" to the import by typing it in the tags field and pressing Enter`);
        await delay(500);
      }
    }

    // Confirm and start import
    await safeAct(stagehand, "Click the 'Import' or 'Start Import' or 'Confirm' button to begin the import");
    await delay(3000);

    return {
      csvFile: input.csvFilePath,
      tagsApplied: input.tags,
    };
  });
}

// ========================================
// 3. contactEdit
// ========================================

/**
 * Edit an existing contact.
 * Searches for the contact, opens their profile, edits fields, and saves.
 */
export async function contactEdit(
  stagehand: Stagehand,
  ctx: GHLAutomationContext,
  input: ContactEditInput
): Promise<GHLAutomationResult> {
  return executeFunction("contact_edit", async () => {
    // Search for the contact
    const found = await searchContact(stagehand, ctx, input.searchTerm);
    if (!found) {
      throw new Error(`Contact not found: ${input.searchTerm}`);
    }

    // Open the contact profile
    await openFirstContact(stagehand);
    await delay(1500);

    const updates = input.updates;

    // Edit basic fields
    if (updates.firstName !== undefined) {
      await safeAct(stagehand, `Clear the First Name field and type "${updates.firstName}"`);
    }
    if (updates.lastName !== undefined) {
      await safeAct(stagehand, `Clear the Last Name field and type "${updates.lastName}"`);
    }
    if (updates.email !== undefined) {
      await safeAct(stagehand, `Clear the Email field and type "${updates.email}"`);
    }
    if (updates.phone !== undefined) {
      // Use fillField for phone to avoid formatting issues
      const filled = await fillField(
        stagehand,
        'input[name="phone"], input[placeholder*="Phone"], input[data-testid="phone"]',
        updates.phone,
        `Clear the Phone field and type "${updates.phone}"`
      );
      if (!filled) {
        await safeAct(stagehand, `Clear the Phone field and type "${updates.phone}"`);
      }
    }
    if (updates.companyName !== undefined) {
      await safeAct(stagehand, `Clear the Company Name field and type "${updates.companyName}"`);
    }

    // Edit address fields
    if (updates.address) {
      if (updates.address.street !== undefined) {
        await safeAct(stagehand, `Clear the Street Address field and type "${updates.address.street}"`);
      }
      if (updates.address.city !== undefined) {
        await safeAct(stagehand, `Clear the City field and type "${updates.address.city}"`);
      }
      if (updates.address.state !== undefined) {
        await safeAct(stagehand, `Clear the State field and type "${updates.address.state}"`);
      }
      if (updates.address.zip !== undefined) {
        await safeAct(stagehand, `Clear the Postal Code field and type "${updates.address.zip}"`);
      }
      if (updates.address.country !== undefined) {
        await safeAct(stagehand, `Select or type "${updates.address.country}" in the Country field`);
      }
    }

    // Update tags
    if (updates.tags && updates.tags.length > 0) {
      for (const tag of updates.tags) {
        await safeAct(stagehand, `Add the tag "${tag}" by clicking the tags area, typing "${tag}", and pressing Enter`);
        await delay(500);
      }
    }

    // Update source
    if (updates.source !== undefined) {
      await safeAct(stagehand, `Select or type "${updates.source}" in the Source field`);
    }

    // Update assigned user
    if (updates.assignedUser !== undefined) {
      await safeAct(stagehand, `Select "${updates.assignedUser}" from the Assigned User or Owner dropdown`);
    }

    // Fill custom fields
    if (updates.customFields) {
      for (const [fieldName, value] of Object.entries(updates.customFields)) {
        await safeAct(stagehand, `Find the custom field labeled "${fieldName}", clear it, and type "${value}"`);
        await delay(300);
      }
    }

    // Save the changes
    await safeAct(stagehand, "Click the Save button to save contact changes");
    await delay(2000);

    return {
      searchTerm: input.searchTerm,
      fieldsUpdated: Object.keys(updates).filter(
        k => updates[k as keyof typeof updates] !== undefined
      ),
    };
  });
}

// ========================================
// 4. contactAddTags
// ========================================

/**
 * Add or remove tags on an existing contact.
 * Searches for the contact, opens their profile, adds and/or removes tags.
 */
export async function contactAddTags(
  stagehand: Stagehand,
  ctx: GHLAutomationContext,
  input: ContactTagInput
): Promise<GHLAutomationResult> {
  return executeFunction("contact_add_tags", async () => {
    // Search for the contact
    const found = await searchContact(stagehand, ctx, input.searchTerm);
    if (!found) {
      throw new Error(`Contact not found: ${input.searchTerm}`);
    }

    // Open the contact profile
    await openFirstContact(stagehand);
    await delay(1500);

    const tagsAdded: string[] = [];
    const tagsRemoved: string[] = [];

    // Add tags
    if (input.tagsToAdd && input.tagsToAdd.length > 0) {
      for (const tag of input.tagsToAdd) {
        const success = await safeAct(
          stagehand,
          `Click on the Tags field or area, type "${tag}", and press Enter to add the tag`
        );
        if (success) {
          tagsAdded.push(tag);
        }
        await delay(500);
      }
    }

    // Remove tags
    if (input.tagsToRemove && input.tagsToRemove.length > 0) {
      for (const tag of input.tagsToRemove) {
        const success = await safeAct(
          stagehand,
          `Find the tag "${tag}" and click its remove or X button to delete it`
        );
        if (success) {
          tagsRemoved.push(tag);
        }
        await delay(500);
      }
    }

    // Save changes if needed
    await safeAct(stagehand, "Click the Save button if visible to save tag changes");
    await delay(1000);

    return {
      searchTerm: input.searchTerm,
      tagsAdded,
      tagsRemoved,
    };
  });
}

// ========================================
// 5. contactDelete
// ========================================

/**
 * Delete a contact from GHL.
 * Searches for the contact, opens their profile, clicks More Actions, deletes, and confirms.
 */
export async function contactDelete(
  stagehand: Stagehand,
  ctx: GHLAutomationContext,
  input: ContactDeleteInput
): Promise<GHLAutomationResult> {
  return executeFunction("contact_delete", async () => {
    if (!input.confirmDeletion) {
      throw new Error("Deletion not confirmed. Set confirmDeletion to true.");
    }

    // Search for the contact
    const found = await searchContact(stagehand, ctx, input.searchTerm);
    if (!found) {
      throw new Error(`Contact not found: ${input.searchTerm}`);
    }

    // Open the contact profile
    await openFirstContact(stagehand);
    await delay(1500);

    // Click More Actions / three-dot menu
    await safeAct(stagehand, "Click the More Actions button, three-dot menu, or kebab menu on the contact profile");
    await delay(1000);

    // Click Delete
    await safeAct(stagehand, "Click the Delete or Delete Contact option from the menu");
    await delay(1000);

    // Confirm the deletion dialog
    await confirmDialog(stagehand);
    await delay(2000);

    return {
      searchTerm: input.searchTerm,
      deleted: true,
    };
  });
}

// ========================================
// 6. customFieldCreate
// ========================================

/**
 * Create a custom field in GHL.
 * Navigates to Settings > Custom Fields, adds a new field, configures type and options, and saves.
 */
export async function customFieldCreate(
  stagehand: Stagehand,
  ctx: GHLAutomationContext,
  input: CustomFieldCreateInput
): Promise<GHLAutomationResult> {
  return executeFunction("custom_field_create", async () => {
    // Navigate to Settings > Custom Fields
    await navigateTo(stagehand, ctx, "/settings/custom_fields");
    await delay(1500);

    // Click Add Field button
    await safeAct(stagehand, "Click the 'Add Field' or 'Add Custom Field' or 'Create Field' button");
    await delay(1500);

    // Enter field name
    await safeAct(stagehand, `Type "${input.name}" into the Field Name or Label input`);
    await delay(500);

    // Select field type
    await safeAct(stagehand, `Select "${input.fieldType}" from the Field Type dropdown or options`);
    await delay(500);

    // Add options for dropdown/checkbox fields
    if (input.options && input.options.length > 0 && (input.fieldType === "dropdown" || input.fieldType === "checkbox")) {
      for (const option of input.options) {
        await safeAct(
          stagehand,
          `Type "${option}" into the option input field and press Enter or click Add to add it as an option`
        );
        await delay(300);
      }
    }

    // Select group if provided
    if (input.group) {
      await safeAct(stagehand, `Select or type "${input.group}" in the Group or Folder field`);
      await delay(500);
    }

    // Save the custom field
    await safeAct(stagehand, "Click the Save or Create button to save the custom field");
    await delay(2000);

    return {
      fieldName: input.name,
      fieldType: input.fieldType,
      options: input.options,
      group: input.group,
    };
  });
}

// ========================================
// 7. smartListCreate
// ========================================

/**
 * Create a smart list (saved contact filter/view) in GHL.
 * Navigates to Contacts > Smart Lists, creates a new list, adds filters, and saves.
 */
export async function smartListCreate(
  stagehand: Stagehand,
  ctx: GHLAutomationContext,
  input: SmartListCreateInput
): Promise<GHLAutomationResult> {
  return executeFunction("smart_list_create", async () => {
    // Navigate to contacts page
    await navigateTo(stagehand, ctx, "/contacts/smart_list");
    await delay(1500);

    // Click create new smart list
    await safeAct(stagehand, "Click the 'Create Smart List' or 'New Smart List' or 'Add Smart List' button");
    await delay(1500);

    // Enter the smart list name
    await safeAct(stagehand, `Type "${input.name}" into the Smart List Name or Name input field`);
    await delay(500);

    // Add filters
    for (let i = 0; i < input.filters.length; i++) {
      const filter = input.filters[i];

      // Add a new filter row (skip for the first if already present)
      if (i > 0) {
        await safeAct(stagehand, "Click the 'Add Filter' or '+' button to add another filter condition");
        await delay(500);
      }

      // Select the field to filter on
      await safeAct(
        stagehand,
        `Select "${filter.field}" from the filter field dropdown for filter row ${i + 1}`
      );
      await delay(500);

      // Select the operator
      const operatorLabels: Record<string, string> = {
        is: "is",
        is_not: "is not",
        contains: "contains",
        not_contains: "does not contain",
        greater_than: "greater than",
        less_than: "less than",
      };
      const operatorLabel = operatorLabels[filter.operator] || filter.operator;
      await safeAct(
        stagehand,
        `Select "${operatorLabel}" from the operator or condition dropdown for filter row ${i + 1}`
      );
      await delay(500);

      // Enter the filter value
      await safeAct(
        stagehand,
        `Type "${filter.value}" into the value field for filter row ${i + 1}`
      );
      await delay(300);
    }

    // Save the smart list
    await safeAct(stagehand, "Click the Save or Create button to save the smart list");
    await delay(2000);

    return {
      listName: input.name,
      filterCount: input.filters.length,
      filters: input.filters,
    };
  });
}
