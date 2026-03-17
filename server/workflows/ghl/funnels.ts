/**
 * GHL Funnels & Websites Automation Functions
 * Module 3: Create funnels, edit funnel pages, create forms, create websites
 */

import { Stagehand } from "@browserbasehq/stagehand";
import type { GHLAutomationContext, GHLAutomationResult, FunnelCreateInput, FunnelPageEditInput, FormCreateInput, WebsiteCreateInput } from "./types";
import { executeFunction, navigateTo, safeAct, delay, getPage } from "./helpers";

/**
 * Create a multi-page funnel in GoHighLevel.
 * Navigates to /funnels, creates a new funnel from template or scratch,
 * names it, adds pages, and publishes.
 *
 * Note: The page editor uses iframes — use page.frameLocator() for nested contexts.
 */
export async function funnelCreate(
  stagehand: Stagehand,
  ctx: GHLAutomationContext,
  input: FunnelCreateInput
): Promise<GHLAutomationResult> {
  return executeFunction("funnel_create", async () => {
    const page = getPage(stagehand);

    // Navigate to funnels
    console.log("[GHL Funnels] Navigating to funnels...");
    await navigateTo(stagehand, ctx, "/funnels");

    // Click create funnel button
    console.log("[GHL Funnels] Creating new funnel...");
    const clickedCreate = await safeAct(
      stagehand,
      'Click the "Create Funnel" or "New Funnel" or "+ Add New" button'
    );
    if (!clickedCreate) {
      throw new Error("Could not find Create Funnel button");
    }
    await delay(2000);

    // Choose template or start from scratch
    if (input.templateId) {
      console.log(`[GHL Funnels] Selecting template: ${input.templateId}`);
      await safeAct(
        stagehand,
        `Select the template with ID or name "${input.templateId}" from the template gallery`
      );
      await delay(2000);
    } else {
      console.log("[GHL Funnels] Starting from scratch...");
      await safeAct(
        stagehand,
        'Click "Start from Scratch" or "Blank" or "Create from Scratch" option'
      );
      await delay(2000);
    }

    // Name the funnel
    console.log(`[GHL Funnels] Naming funnel: ${input.name}`);
    await safeAct(
      stagehand,
      `Type "${input.name}" into the funnel name input field`
    );
    await delay(1000);

    // Confirm creation / proceed
    await safeAct(
      stagehand,
      'Click the "Create" or "Continue" or "Save" button to confirm funnel creation'
    );
    await delay(3000);

    // Add pages if specified
    if (input.pages && input.pages.length > 0) {
      console.log(`[GHL Funnels] Adding ${input.pages.length} page(s)...`);

      for (const pageConfig of input.pages) {
        console.log(`[GHL Funnels] Adding page: ${pageConfig.name}`);
        await safeAct(
          stagehand,
          'Click "Add New Step" or "Add Page" or the "+" button to add a new funnel page'
        );
        await delay(2000);

        // If a page type is specified, select it
        if (pageConfig.type) {
          await safeAct(
            stagehand,
            `Select the "${pageConfig.type}" page type or template`
          );
          await delay(1000);
        }

        // Name the page
        await safeAct(
          stagehand,
          `Type "${pageConfig.name}" as the page name or step name`
        );
        await delay(1000);

        // Confirm page addition
        await safeAct(
          stagehand,
          'Click "Save" or "Create" or "Add" to confirm the new page'
        );
        await delay(2000);
      }
    }

    // Publish the funnel
    console.log("[GHL Funnels] Publishing funnel...");
    const published = await safeAct(
      stagehand,
      'Click the "Publish" or "Save & Publish" button to publish the funnel'
    );
    await delay(2000);

    // Try to extract the funnel URL if available
    let funnelUrl: string | undefined;
    try {
      funnelUrl = page.url();
    } catch {
      // URL extraction is optional
    }

    console.log(`[GHL Funnels] Funnel "${input.name}" created successfully`);
    return {
      funnelName: input.name,
      pagesCreated: input.pages?.length ?? 0,
      published,
      funnelUrl,
    };
  });
}

/**
 * Edit a funnel page's content in GoHighLevel.
 * Navigates to the funnel, opens the page editor, and performs operations
 * such as adding elements, editing content, and removing elements.
 *
 * Handles iframe context for the page builder using page.frameLocator().
 */
export async function funnelPageEdit(
  stagehand: Stagehand,
  ctx: GHLAutomationContext,
  input: FunnelPageEditInput
): Promise<GHLAutomationResult> {
  return executeFunction("funnel_page_edit", async () => {
    const page = getPage(stagehand);

    // Navigate to funnels
    console.log(`[GHL Funnels] Navigating to funnel: ${input.funnelName}`);
    await navigateTo(stagehand, ctx, "/funnels");

    // Find and open the target funnel
    await safeAct(
      stagehand,
      `Click on the funnel named "${input.funnelName}" to open it`
    );
    await delay(3000);

    // Select the target page/step
    console.log(`[GHL Funnels] Selecting page: ${input.pageName}`);
    await safeAct(
      stagehand,
      `Click on the page or step named "${input.pageName}" in the funnel steps list`
    );
    await delay(2000);

    // Open the page editor
    await safeAct(
      stagehand,
      'Click the "Edit" or "Edit Page" button to open the page builder'
    );
    await delay(4000);

    // The page builder uses iframes — locate the editor frame
    const editorFrame = page.frameLocator('iframe[id*="editor"], iframe[class*="editor"], iframe[src*="editor"], iframe').first();

    // Process each operation
    const results: Array<{ action: string; success: boolean }> = [];

    for (const operation of input.operations) {
      console.log(`[GHL Funnels] Performing operation: ${operation.action}`);

      let success = false;

      switch (operation.action) {
        case "add_element": {
          // Add a new element to the page
          success = await safeAct(
            stagehand,
            `Add a new "${operation.elementType || "text"}" element to the page. ` +
            `Look for an "Add Element" or "+" button, select the element type "${operation.elementType || "text"}", and place it on the page`
          );
          await delay(2000);

          if (success && operation.content) {
            // Try to set content within the iframe context
            try {
              await editorFrame.locator('[contenteditable="true"]').last().fill(operation.content);
            } catch {
              // Fallback to stagehand act
              await safeAct(
                stagehand,
                `Type "${operation.content}" into the newly added element`
              );
            }
            await delay(1000);
          }

          // Apply any properties
          if (success && operation.properties) {
            for (const [key, value] of Object.entries(operation.properties)) {
              await safeAct(
                stagehand,
                `Set the "${key}" property to "${value}" in the element settings panel`
              );
              await delay(500);
            }
          }
          break;
        }

        case "edit_element": {
          // Click on the element to select it
          if (operation.elementType) {
            success = await safeAct(
              stagehand,
              `Click on the "${operation.elementType}" element on the page to select it for editing`
            );
          } else {
            success = await safeAct(
              stagehand,
              "Click on the element to select it for editing"
            );
          }
          await delay(1500);

          if (success && operation.content) {
            // Try to edit content within the iframe context
            try {
              await editorFrame.locator('[contenteditable="true"]').first().fill(operation.content);
            } catch {
              // Fallback to stagehand act
              await safeAct(
                stagehand,
                `Replace the selected element's text content with "${operation.content}"`
              );
            }
            await delay(1000);
          }

          // Apply property updates
          if (success && operation.properties) {
            for (const [key, value] of Object.entries(operation.properties)) {
              await safeAct(
                stagehand,
                `Change the "${key}" property to "${value}" in the element settings panel`
              );
              await delay(500);
            }
          }
          break;
        }

        case "remove_element": {
          // Select the element first
          if (operation.elementType) {
            success = await safeAct(
              stagehand,
              `Click on the "${operation.elementType}" element on the page to select it`
            );
          } else {
            success = await safeAct(
              stagehand,
              "Click on the element to select it"
            );
          }
          await delay(1000);

          if (success) {
            // Delete the selected element
            await safeAct(
              stagehand,
              'Click the "Delete" or trash icon button to remove the selected element'
            );
            await delay(1000);
          }
          break;
        }

        case "add_section": {
          // Add a new section/row to the page
          success = await safeAct(
            stagehand,
            `Add a new section or row to the page. Look for an "Add Section" or "Add Row" or "+" button`
          );
          await delay(2000);

          if (success && operation.content) {
            await safeAct(
              stagehand,
              `Select the "${operation.content}" section layout or template`
            );
            await delay(1500);
          }
          break;
        }
      }

      results.push({ action: operation.action, success });
    }

    // Save changes
    console.log("[GHL Funnels] Saving page changes...");
    const saved = await safeAct(
      stagehand,
      'Click the "Save" or "Update" button to save the page changes'
    );
    await delay(2000);

    console.log(`[GHL Funnels] Page "${input.pageName}" edited with ${results.length} operation(s)`);
    return {
      funnelName: input.funnelName,
      pageName: input.pageName,
      operations: results,
      saved,
    };
  });
}

/**
 * Create a custom form in GoHighLevel.
 * Navigates to the forms area, creates a new form, adds fields by type,
 * sets the submit button text, configures success message/redirect, and saves.
 */
export async function formCreate(
  stagehand: Stagehand,
  ctx: GHLAutomationContext,
  input: FormCreateInput
): Promise<GHLAutomationResult> {
  return executeFunction("form_create", async () => {
    const page = getPage(stagehand);

    // Navigate to forms - GHL forms are under Sites > Forms
    console.log("[GHL Forms] Navigating to forms...");
    await navigateTo(stagehand, ctx, "/forms");

    // Click create form button
    console.log("[GHL Forms] Creating new form...");
    const clickedCreate = await safeAct(
      stagehand,
      'Click the "Create Form" or "New Form" or "+ Add" button to create a new form'
    );
    if (!clickedCreate) {
      throw new Error("Could not find Create Form button");
    }
    await delay(2000);

    // Name the form
    console.log(`[GHL Forms] Naming form: ${input.name}`);
    await safeAct(
      stagehand,
      `Type "${input.name}" into the form name or title input field`
    );
    await delay(1000);

    // Confirm creation if there's a dialog
    await safeAct(
      stagehand,
      'Click "Create" or "Continue" or "Next" to proceed with form creation'
    );
    await delay(3000);

    // Add form fields
    console.log(`[GHL Forms] Adding ${input.fields.length} field(s)...`);
    for (const field of input.fields) {
      console.log(`[GHL Forms] Adding field: ${field.label} (${field.type})`);

      // Click add field button
      await safeAct(
        stagehand,
        'Click "Add Field" or "Add Element" or the "+" button to add a new form field'
      );
      await delay(1500);

      // Select field type
      await safeAct(
        stagehand,
        `Select the "${field.type}" field type from the field type options or dropdown`
      );
      await delay(1000);

      // Set field label
      await safeAct(
        stagehand,
        `Type "${field.label}" as the field label or name`
      );
      await delay(500);

      // Set placeholder if provided
      if (field.placeholder) {
        await safeAct(
          stagehand,
          `Type "${field.placeholder}" into the placeholder text input`
        );
        await delay(500);
      }

      // Set required if true
      if (field.required) {
        await safeAct(
          stagehand,
          'Toggle or check the "Required" switch or checkbox to make this field required'
        );
        await delay(500);
      }

      // Add options for dropdown/radio/checkbox fields
      if (field.options && field.options.length > 0) {
        console.log(`[GHL Forms] Adding ${field.options.length} option(s) for ${field.label}`);
        for (const option of field.options) {
          await safeAct(
            stagehand,
            `Add "${option}" as an option. Click "Add Option" if needed and type the option value`
          );
          await delay(500);
        }
      }

      // Confirm/save the field
      await safeAct(
        stagehand,
        'Click "Save" or "Done" or "Add" to confirm the field, or click outside to close the field editor'
      );
      await delay(1000);
    }

    // Set submit button text
    if (input.submitButtonText) {
      console.log(`[GHL Forms] Setting submit button text: ${input.submitButtonText}`);
      await safeAct(
        stagehand,
        `Click on the submit button to select it, then change its text to "${input.submitButtonText}"`
      );
      await delay(1000);
    }

    // Configure success message
    if (input.successMessage) {
      console.log("[GHL Forms] Setting success message...");
      await safeAct(
        stagehand,
        'Click on "Settings" or "Form Settings" or the gear icon to open form settings'
      );
      await delay(1500);

      await safeAct(
        stagehand,
        `Type "${input.successMessage}" into the success message or thank you message field`
      );
      await delay(1000);
    }

    // Configure redirect URL
    if (input.redirectUrl) {
      console.log(`[GHL Forms] Setting redirect URL: ${input.redirectUrl}`);
      await safeAct(
        stagehand,
        'Select "Redirect to URL" or "Custom URL" option for the form submission action'
      );
      await delay(1000);

      await safeAct(
        stagehand,
        `Type "${input.redirectUrl}" into the redirect URL input field`
      );
      await delay(1000);
    }

    // Configure notification email
    if (input.notifyEmail) {
      console.log(`[GHL Forms] Setting notification email: ${input.notifyEmail}`);
      await safeAct(
        stagehand,
        `Type "${input.notifyEmail}" into the notification email or "Send notifications to" field`
      );
      await delay(1000);
    }

    // Close settings if opened
    if (input.successMessage || input.redirectUrl || input.notifyEmail) {
      await safeAct(
        stagehand,
        'Click "Save" or "Done" or close the settings panel'
      );
      await delay(1000);
    }

    // Save the form
    console.log("[GHL Forms] Saving form...");
    const saved = await safeAct(
      stagehand,
      'Click the "Save" or "Save Form" button to save the form'
    );
    await delay(2000);

    console.log(`[GHL Forms] Form "${input.name}" created with ${input.fields.length} field(s)`);
    return {
      formName: input.name,
      fieldsCreated: input.fields.length,
      submitButtonText: input.submitButtonText,
      hasSuccessMessage: !!input.successMessage,
      hasRedirect: !!input.redirectUrl,
      saved,
    };
  });
}

/**
 * Create a full website in GoHighLevel.
 * Navigates to /sites, creates a new website from template or scratch,
 * names it, adds pages if specified, and publishes.
 */
export async function websiteCreate(
  stagehand: Stagehand,
  ctx: GHLAutomationContext,
  input: WebsiteCreateInput
): Promise<GHLAutomationResult> {
  return executeFunction("website_create", async () => {
    const page = getPage(stagehand);

    // Navigate to sites/websites
    console.log("[GHL Websites] Navigating to websites...");
    await navigateTo(stagehand, ctx, "/sites");

    // Click create website button
    console.log("[GHL Websites] Creating new website...");
    const clickedCreate = await safeAct(
      stagehand,
      'Click the "Create Website" or "New Website" or "+ New" button to create a new website'
    );
    if (!clickedCreate) {
      throw new Error("Could not find Create Website button");
    }
    await delay(2000);

    // Choose template or start from scratch
    if (input.templateId) {
      console.log(`[GHL Websites] Selecting template: ${input.templateId}`);
      await safeAct(
        stagehand,
        `Select the template with ID or name "${input.templateId}" from the template gallery`
      );
      await delay(2000);
    } else {
      console.log("[GHL Websites] Starting from scratch...");
      await safeAct(
        stagehand,
        'Click "Start from Scratch" or "Blank" or "Create from Scratch" option'
      );
      await delay(2000);
    }

    // Name the website
    console.log(`[GHL Websites] Naming website: ${input.name}`);
    await safeAct(
      stagehand,
      `Type "${input.name}" into the website name input field`
    );
    await delay(1000);

    // Confirm creation
    await safeAct(
      stagehand,
      'Click the "Create" or "Continue" or "Save" button to confirm website creation'
    );
    await delay(3000);

    // Add additional pages if specified
    if (input.pages && input.pages.length > 0) {
      console.log(`[GHL Websites] Adding ${input.pages.length} page(s)...`);

      for (const pageName of input.pages) {
        console.log(`[GHL Websites] Adding page: ${pageName}`);
        await safeAct(
          stagehand,
          'Click "Add Page" or "New Page" or the "+" button to add a new website page'
        );
        await delay(2000);

        // Name the page
        await safeAct(
          stagehand,
          `Type "${pageName}" as the page name or title`
        );
        await delay(1000);

        // Confirm page creation
        await safeAct(
          stagehand,
          'Click "Create" or "Save" or "Add" to confirm the new page'
        );
        await delay(2000);
      }
    }

    // Set custom domain if provided
    if (input.customDomain) {
      console.log(`[GHL Websites] Setting custom domain: ${input.customDomain}`);
      await safeAct(
        stagehand,
        'Click on "Settings" or the gear icon to open website settings'
      );
      await delay(2000);

      await safeAct(
        stagehand,
        `Type "${input.customDomain}" into the custom domain or domain name input field`
      );
      await delay(1000);

      await safeAct(
        stagehand,
        'Click "Save" or "Connect Domain" to save the custom domain'
      );
      await delay(2000);
    }

    // Publish the website
    console.log("[GHL Websites] Publishing website...");
    const published = await safeAct(
      stagehand,
      'Click the "Publish" or "Save & Publish" button to publish the website'
    );
    await delay(2000);

    // Try to extract the website URL
    let websiteUrl: string | undefined;
    try {
      websiteUrl = page.url();
    } catch {
      // URL extraction is optional
    }

    console.log(`[GHL Websites] Website "${input.name}" created successfully`);
    return {
      websiteName: input.name,
      pagesCreated: input.pages?.length ?? 0,
      customDomain: input.customDomain,
      published,
      websiteUrl,
    };
  });
}
