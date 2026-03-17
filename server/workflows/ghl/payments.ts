/**
 * GHL Payments & Commerce Automation
 * Functions for products, order forms, and Stripe connection
 */

import { Stagehand } from "@browserbasehq/stagehand";
import { z } from "zod";
import type {
  GHLAutomationContext,
  GHLAutomationResult,
  ProductCreateInput,
  OrderFormCreateInput,
  StripeConnectInput,
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
 * Create a product for sale.
 * Navigates to /payments, creates a new product, sets
 * name/description/price/type, configures recurring or
 * payment plan options, and saves.
 */
export async function productCreate(
  stagehand: Stagehand,
  ctx: GHLAutomationContext,
  input: ProductCreateInput,
): Promise<GHLAutomationResult> {
  return executeFunction("product_create", async () => {
    // Navigate to payments
    await navigateTo(stagehand, ctx, "/payments", {
      waitForSelector: '[data-testid="payments"]',
    });

    // Click to create a new product
    console.log(`[GHL Payments] Creating product: ${input.name}`);
    await safeAct(stagehand, "Click the Products tab or section");
    await delay(1000);
    await safeAct(stagehand, "Click the Create Product or Add Product button");
    await delay(1500);
    await waitForPageLoad(stagehand);

    // Set product name
    await safeAct(stagehand, `Type "${input.name}" into the product name field`);
    await delay(500);

    // Set description if provided
    if (input.description) {
      await safeAct(
        stagehand,
        `Type "${input.description}" into the product description field`,
      );
      await delay(500);
    }

    // Set price
    console.log(`[GHL Payments] Setting price: ${input.price}`);
    await fillField(
      stagehand,
      'input[name="price"], input[placeholder*="price" i]',
      String(input.price),
      `Type "${input.price}" into the price field`,
    );
    await delay(500);

    // Set price type
    const priceTypeLabel =
      input.priceType === "one_time" ? "One Time" :
      input.priceType === "subscription" ? "Subscription" :
      "Payment Plan";
    console.log(`[GHL Payments] Setting price type: ${priceTypeLabel}`);
    await safeAct(stagehand, `Select "${priceTypeLabel}" as the pricing type`);
    await delay(500);

    // Configure recurring interval for subscriptions
    if (input.priceType === "subscription" && input.recurringInterval) {
      const intervalLabel =
        input.recurringInterval === "monthly" ? "Monthly" :
        input.recurringInterval === "yearly" ? "Yearly" :
        "Weekly";
      console.log(`[GHL Payments] Setting recurring interval: ${intervalLabel}`);
      await safeAct(stagehand, `Select "${intervalLabel}" as the recurring interval`);
      await delay(500);
    }

    // Configure payment plan installments
    if (input.priceType === "payment_plan" && input.paymentPlanInstallments) {
      console.log(`[GHL Payments] Setting installments: ${input.paymentPlanInstallments}`);
      await safeAct(
        stagehand,
        `Set the number of installments to ${input.paymentPlanInstallments}`,
      );
      await delay(500);
    }

    // Set product image if provided
    if (input.imageUrl) {
      console.log("[GHL Payments] Adding product image...");
      await safeAct(
        stagehand,
        `Click the Add Image or Upload Image button and set the image URL to ${input.imageUrl}`,
      );
      await delay(1000);
    }

    // Save the product
    await safeAct(stagehand, "Click the Save or Create button to save the product");
    await delay(2000);

    // Verify creation
    const result = await safeExtract(
      stagehand,
      "Check if the product was created successfully",
      z.object({
        created: z.boolean(),
        productName: z.string().optional(),
        productId: z.string().optional(),
      }),
    );

    console.log("[GHL Payments] Product creation result:", result);
    return {
      productCreated: result?.created ?? true,
      name: input.name,
      price: input.price,
      priceType: input.priceType,
    };
  });
}

/**
 * Create an order/checkout form.
 * Navigates to order forms, creates a new form, links a product,
 * adds fields, configures bumps, sets redirect URL, and saves.
 */
export async function orderFormCreate(
  stagehand: Stagehand,
  ctx: GHLAutomationContext,
  input: OrderFormCreateInput,
): Promise<GHLAutomationResult> {
  return executeFunction("order_form_create", async () => {
    // Navigate to payments/order forms
    await navigateTo(stagehand, ctx, "/payments", {
      waitForSelector: '[data-testid="payments"]',
    });

    // Go to order forms section
    await safeAct(stagehand, "Click on the Order Forms tab or section");
    await delay(1000);

    // Create new order form
    console.log(`[GHL Payments] Creating order form: ${input.name}`);
    await safeAct(stagehand, "Click the Create Order Form or New Order Form button");
    await delay(1500);
    await waitForPageLoad(stagehand);

    // Set form name
    await safeAct(stagehand, `Type "${input.name}" into the order form name field`);
    await delay(500);

    // Link product
    console.log(`[GHL Payments] Linking product: ${input.productName}`);
    await safeAct(
      stagehand,
      `Select or search for the product "${input.productName}" and link it to this order form`,
    );
    await delay(1000);

    // Add form fields if provided
    if (input.fields && input.fields.length > 0) {
      console.log(`[GHL Payments] Adding ${input.fields.length} form fields...`);
      for (const field of input.fields) {
        await safeAct(stagehand, "Click the Add Field button");
        await delay(500);
        await safeAct(stagehand, `Set the field label to "${field.label}" and type to "${field.type}"`);
        await delay(300);
        if (field.required) {
          await safeAct(stagehand, "Mark this field as required");
          await delay(200);
        }
      }
    }

    // Configure order bumps if provided
    if (input.bumps && input.bumps.length > 0) {
      console.log(`[GHL Payments] Adding ${input.bumps.length} order bumps...`);
      for (const bump of input.bumps) {
        await safeAct(stagehand, "Click the Add Bump or Order Bump button");
        await delay(500);
        await safeAct(stagehand, `Type "${bump.name}" into the bump name field`);
        await delay(300);
        await safeAct(stagehand, `Set the bump price to ${bump.price}`);
        await delay(300);
        if (bump.description) {
          await safeAct(
            stagehand,
            `Type "${bump.description}" into the bump description field`,
          );
          await delay(300);
        }
      }
    }

    // Set success redirect URL if provided
    if (input.successRedirectUrl) {
      console.log("[GHL Payments] Setting redirect URL...");
      await fillField(
        stagehand,
        'input[name="redirectUrl"], input[placeholder*="redirect" i]',
        input.successRedirectUrl,
        `Type "${input.successRedirectUrl}" into the success redirect URL field`,
      );
      await delay(500);
    }

    // Save the order form
    await safeAct(stagehand, "Click the Save or Create button to save the order form");
    await delay(2000);

    // Verify creation
    const result = await safeExtract(
      stagehand,
      "Check if the order form was created successfully",
      z.object({
        created: z.boolean(),
        formName: z.string().optional(),
      }),
    );

    console.log("[GHL Payments] Order form creation result:", result);
    return {
      orderFormCreated: result?.created ?? true,
      name: input.name,
      linkedProduct: input.productName,
      bumpsCount: input.bumps?.length ?? 0,
    };
  });
}

/**
 * Connect Stripe payment processor.
 * Navigates to payment settings, clicks Connect Stripe,
 * and handles the OAuth redirect flow.
 */
export async function stripeConnect(
  stagehand: Stagehand,
  ctx: GHLAutomationContext,
  input: StripeConnectInput,
): Promise<GHLAutomationResult> {
  return executeFunction("stripe_connect", async () => {
    const page = getPage(stagehand);

    // Navigate to payment settings
    await navigateTo(stagehand, ctx, "/payments/settings", {
      waitForSelector: '[data-testid="payment-settings"]',
    });
    await waitForPageLoad(stagehand);

    // Look for Stripe integration section
    console.log("[GHL Payments] Looking for Stripe connection...");
    await safeAct(stagehand, "Click on the Integrations or Payment Integrations section");
    await delay(1000);

    // Check if Stripe is already connected
    const connectionStatus = await safeExtract(
      stagehand,
      "Check if Stripe is already connected by looking for a connected status or Stripe account ID",
      z.object({
        isConnected: z.boolean(),
        accountId: z.string().optional(),
      }),
    );

    if (connectionStatus?.isConnected) {
      console.log("[GHL Payments] Stripe is already connected");
      return {
        stripeConnected: true,
        alreadyConnected: true,
        accountId: connectionStatus.accountId,
      };
    }

    // Click Connect Stripe
    console.log("[GHL Payments] Initiating Stripe connection...");
    await safeAct(stagehand, "Click the Connect Stripe or Connect with Stripe button");
    await delay(3000);

    // Handle Stripe OAuth redirect
    // The page may redirect to Stripe's OAuth flow
    const currentUrl = page.url();
    if (currentUrl.includes("stripe.com")) {
      console.log("[GHL Payments] Redirected to Stripe OAuth - awaiting user authorization");
      // In a real flow, the user would authenticate with Stripe
      // The automation waits for the redirect back to GHL
      await waitForPageLoad(stagehand, 15000);
    }

    // Check if redirect back happened
    if (input.redirectAfterConnect) {
      await delay(3000);
      await waitForPageLoad(stagehand);
    }

    // Verify connection
    const result = await safeExtract(
      stagehand,
      "Check if Stripe was connected successfully by looking for a success message or connected status",
      z.object({
        connected: z.boolean(),
        accountId: z.string().optional(),
      }),
    );

    console.log("[GHL Payments] Stripe connection result:", result);
    return {
      stripeConnected: result?.connected ?? false,
      accountId: result?.accountId,
    };
  });
}
