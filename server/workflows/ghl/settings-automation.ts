/**
 * GHL Settings & Configuration Automation
 * Functions for sub-accounts, users, integrations, and custom domains
 */

import { Stagehand } from "@browserbasehq/stagehand";
import { z } from "zod";
import type {
  GHLAutomationContext,
  GHLAutomationResult,
  SubaccountCreateInput,
  UserCreateInput,
  IntegrationSetupInput,
  CustomDomainSetupInput,
} from "./types";
import {
  executeFunction,
  navigateTo,
  safeAct,
  delay,
  getPage,
  fillField,
  safeExtract,
  waitForPageLoad,
} from "./helpers";

/**
 * Create a new sub-account.
 * Navigates to agency settings, creates a sub-account,
 * fills business info, optionally applies a snapshot, and saves.
 */
export async function subaccountCreate(
  stagehand: Stagehand,
  ctx: GHLAutomationContext,
  input: SubaccountCreateInput,
): Promise<GHLAutomationResult> {
  return executeFunction("subaccount_create", async () => {
    // Navigate to agency settings / sub-accounts
    await navigateTo(stagehand, ctx, "/settings/sub-accounts", {
      waitForSelector: '[data-testid="sub-accounts"]',
    });
    await waitForPageLoad(stagehand);

    // Click to create a new sub-account
    console.log(`[GHL Settings] Creating sub-account: ${input.businessName}`);
    await safeAct(stagehand, "Click the Create Sub-Account or Add Sub-Account button");
    await delay(1500);
    await waitForPageLoad(stagehand);

    // Fill business name
    await safeAct(stagehand, `Type "${input.businessName}" into the business name field`);
    await delay(500);

    // Fill address if provided
    if (input.address) {
      await safeAct(stagehand, `Type "${input.address}" into the business address field`);
      await delay(500);
    }

    // Fill phone if provided
    if (input.phone) {
      await fillField(
        stagehand,
        'input[name="phone"], input[type="tel"]',
        input.phone,
        `Type "${input.phone}" into the phone number field`,
      );
      await delay(500);
    }

    // Fill email if provided
    if (input.email) {
      await fillField(
        stagehand,
        'input[name="email"], input[type="email"]',
        input.email,
        `Type "${input.email}" into the email field`,
      );
      await delay(500);
    }

    // Set industry if provided
    if (input.industry) {
      console.log(`[GHL Settings] Setting industry: ${input.industry}`);
      await safeAct(stagehand, `Select or type "${input.industry}" in the industry field`);
      await delay(500);
    }

    // Set timezone if provided
    if (input.timezone) {
      console.log(`[GHL Settings] Setting timezone: ${input.timezone}`);
      await safeAct(stagehand, `Select "${input.timezone}" in the timezone dropdown`);
      await delay(500);
    }

    // Apply snapshot if provided
    if (input.snapshotId) {
      console.log(`[GHL Settings] Applying snapshot: ${input.snapshotId}`);
      await safeAct(
        stagehand,
        `Select or search for the snapshot "${input.snapshotId}" and apply it`,
      );
      await delay(1000);
    }

    // Save the sub-account
    await safeAct(stagehand, "Click the Save or Create button to create the sub-account");
    await delay(3000);

    // Verify creation
    const result = await safeExtract(
      stagehand,
      "Check if the sub-account was created successfully",
      z.object({
        created: z.boolean(),
        accountName: z.string().optional(),
        accountId: z.string().optional(),
      }),
    );

    console.log("[GHL Settings] Sub-account creation result:", result);
    return {
      subaccountCreated: result?.created ?? true,
      businessName: input.businessName,
      accountId: result?.accountId,
    };
  });
}

/**
 * Add a user to a sub-account.
 * Navigates to settings > team, adds a user, fills
 * name/email/role, sets permissions, and sends the invite.
 */
export async function userCreate(
  stagehand: Stagehand,
  ctx: GHLAutomationContext,
  input: UserCreateInput,
): Promise<GHLAutomationResult> {
  return executeFunction("user_create", async () => {
    // Navigate to team settings
    await navigateTo(stagehand, ctx, "/settings/team", {
      waitForSelector: '[data-testid="team-settings"]',
    });
    await waitForPageLoad(stagehand);

    // Click add user
    console.log(`[GHL Settings] Adding user: ${input.firstName} ${input.lastName}`);
    await safeAct(stagehand, "Click the Add User, Invite User, or Add Team Member button");
    await delay(1500);
    await waitForPageLoad(stagehand);

    // Fill first name
    await fillField(
      stagehand,
      'input[name="firstName"], input[placeholder*="first" i]',
      input.firstName,
      `Type "${input.firstName}" into the first name field`,
    );
    await delay(500);

    // Fill last name
    await fillField(
      stagehand,
      'input[name="lastName"], input[placeholder*="last" i]',
      input.lastName,
      `Type "${input.lastName}" into the last name field`,
    );
    await delay(500);

    // Fill email
    await fillField(
      stagehand,
      'input[name="email"], input[type="email"]',
      input.email,
      `Type "${input.email}" into the email field`,
    );
    await delay(500);

    // Set role
    const roleLabel = input.role === "admin" ? "Admin" : "User";
    console.log(`[GHL Settings] Setting role: ${roleLabel}`);
    await safeAct(stagehand, `Select "${roleLabel}" as the user role`);
    await delay(500);

    // Set permissions if provided
    if (input.permissions && input.permissions.length > 0) {
      console.log(`[GHL Settings] Setting ${input.permissions.length} permissions...`);
      for (const permission of input.permissions) {
        await safeAct(stagehand, `Enable or check the "${permission}" permission`);
        await delay(300);
      }
    }

    // Send the invite
    await safeAct(stagehand, "Click the Send Invite or Save button to add the user");
    await delay(2000);

    // Verify the user was added
    const result = await safeExtract(
      stagehand,
      "Check if the user invite was sent successfully",
      z.object({
        invited: z.boolean(),
        userName: z.string().optional(),
      }),
    );

    console.log("[GHL Settings] User invite result:", result);
    return {
      userInvited: result?.invited ?? true,
      name: `${input.firstName} ${input.lastName}`,
      email: input.email,
      role: input.role,
    };
  });
}

/**
 * Connect a third-party integration.
 * Navigates to settings > integrations, finds the integration type,
 * and follows the OAuth or configuration flow.
 */
export async function integrationSetup(
  stagehand: Stagehand,
  ctx: GHLAutomationContext,
  input: IntegrationSetupInput,
): Promise<GHLAutomationResult> {
  return executeFunction("integration_setup", async () => {
    const page = getPage(stagehand);

    // Navigate to integrations settings
    await navigateTo(stagehand, ctx, "/settings/integrations", {
      waitForSelector: '[data-testid="integrations"]',
    });
    await waitForPageLoad(stagehand);

    // Map integration type to display name
    const integrationName =
      input.integrationType === "zapier" ? "Zapier" :
      input.integrationType === "google_calendar" ? "Google Calendar" :
      input.integrationType === "google_business" ? "Google Business" :
      input.integrationType === "facebook" ? "Facebook" :
      input.integrationType === "stripe" ? "Stripe" :
      input.integrationType === "twilio" ? "Twilio" :
      input.integrationType === "mailgun" ? "Mailgun" :
      "Webhook";

    console.log(`[GHL Settings] Setting up integration: ${integrationName}`);

    // Find and click on the integration
    await safeAct(
      stagehand,
      `Find and click on the "${integrationName}" integration card or button`,
    );
    await delay(2000);
    await waitForPageLoad(stagehand);

    // Handle configuration based on type
    if (input.integrationType === "webhook") {
      // Webhook setup with config values
      if (input.config) {
        for (const [key, value] of Object.entries(input.config)) {
          await safeAct(
            stagehand,
            `Set the "${key}" field to "${value}"`,
          );
          await delay(500);
        }
      }
      await safeAct(stagehand, "Click Save or Create to save the webhook configuration");
      await delay(2000);
    } else {
      // OAuth-based integrations
      console.log(`[GHL Settings] Starting OAuth flow for ${integrationName}...`);
      await safeAct(stagehand, `Click the Connect or Authorize button for ${integrationName}`);
      await delay(3000);

      // Check if redirected to OAuth provider
      const currentUrl = page.url();
      const isOAuthRedirect =
        currentUrl.includes("accounts.google.com") ||
        currentUrl.includes("facebook.com") ||
        currentUrl.includes("stripe.com") ||
        currentUrl.includes("zapier.com");

      if (isOAuthRedirect) {
        console.log("[GHL Settings] Redirected to OAuth provider - awaiting user authorization");
        await waitForPageLoad(stagehand, 15000);
      }

      // Apply any additional config after connection
      if (input.config) {
        for (const [key, value] of Object.entries(input.config)) {
          await safeAct(
            stagehand,
            `Set the "${key}" configuration to "${value}"`,
          );
          await delay(500);
        }
        await safeAct(stagehand, "Click Save to save integration settings");
        await delay(1500);
      }
    }

    // Verify connection
    const result = await safeExtract(
      stagehand,
      "Check if the integration was connected or configured successfully",
      z.object({
        connected: z.boolean(),
        integrationName: z.string().optional(),
        status: z.string().optional(),
      }),
    );

    console.log("[GHL Settings] Integration setup result:", result);
    return {
      integrationConnected: result?.connected ?? false,
      integrationType: input.integrationType,
      integrationName,
    };
  });
}

/**
 * Connect a custom domain.
 * Navigates to settings > domains, adds the domain,
 * configures DNS records, and links to funnel/website/calendar.
 */
export async function customDomainSetup(
  stagehand: Stagehand,
  ctx: GHLAutomationContext,
  input: CustomDomainSetupInput,
): Promise<GHLAutomationResult> {
  return executeFunction("custom_domain_setup", async () => {
    // Navigate to domain settings
    await navigateTo(stagehand, ctx, "/settings/domains", {
      waitForSelector: '[data-testid="domain-settings"]',
    });
    await waitForPageLoad(stagehand);

    // Add a new domain
    console.log(`[GHL Settings] Adding custom domain: ${input.domain}`);
    await safeAct(stagehand, "Click the Add Domain or New Domain button");
    await delay(1500);

    // Enter the domain name
    await fillField(
      stagehand,
      'input[name="domain"], input[placeholder*="domain" i]',
      input.domain,
      `Type "${input.domain}" into the domain name field`,
    );
    await delay(500);

    // Submit the domain
    await safeAct(stagehand, "Click the Add or Next button to add the domain");
    await delay(2000);

    // Extract DNS configuration instructions
    const dnsInfo = await safeExtract(
      stagehand,
      "Extract the DNS configuration instructions including any CNAME or A records that need to be set up",
      z.object({
        recordType: z.string().optional(),
        recordName: z.string().optional(),
        recordValue: z.string().optional(),
        instructions: z.string().optional(),
      }),
    );

    console.log("[GHL Settings] DNS configuration:", dnsInfo);

    // Link to the target (funnel, website, or calendar)
    const targetLabel =
      input.targetType === "funnel" ? "Funnel" :
      input.targetType === "website" ? "Website" :
      "Calendar";

    console.log(`[GHL Settings] Linking domain to ${targetLabel}: ${input.targetName}`);
    await safeAct(
      stagehand,
      `Select "${targetLabel}" as the domain target type`,
    );
    await delay(500);
    await safeAct(
      stagehand,
      `Select or search for "${input.targetName}" as the target ${targetLabel.toLowerCase()}`,
    );
    await delay(500);

    // Save the domain configuration
    await safeAct(stagehand, "Click the Save or Finish button to save domain configuration");
    await delay(2000);

    // Verify setup
    const result = await safeExtract(
      stagehand,
      "Check if the custom domain was added and configured successfully",
      z.object({
        added: z.boolean(),
        domain: z.string().optional(),
        status: z.string().optional(),
      }),
    );

    console.log("[GHL Settings] Domain setup result:", result);
    return {
      domainAdded: result?.added ?? true,
      domain: input.domain,
      targetType: input.targetType,
      targetName: input.targetName,
      dnsConfig: dnsInfo,
    };
  });
}
