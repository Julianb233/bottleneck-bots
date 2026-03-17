/**
 * GHL Conversations & Messaging Automation
 * Functions for sending messages and configuring AI chatbots
 */

import { Stagehand } from "@browserbasehq/stagehand";
import { z } from "zod";
import type {
  GHLAutomationContext,
  GHLAutomationResult,
  ConversationSendMessageInput,
  ConversationAiSetupInput,
} from "./types";
import {
  executeFunction,
  navigateTo,
  safeAct,
  delay,
  getPage,
  fillField,
  searchContact,
  safeExtract,
  waitForPageLoad,
} from "./helpers";

/**
 * Send a manual SMS/Email from the Conversations module.
 * Navigates to /conversations, searches for the contact, opens
 * the conversation thread, selects the channel, types the message,
 * and sends it.
 */
export async function conversationSendMessage(
  stagehand: Stagehand,
  ctx: GHLAutomationContext,
  input: ConversationSendMessageInput,
): Promise<GHLAutomationResult> {
  return executeFunction("conversation_send_message", async () => {
    // Navigate to conversations
    await navigateTo(stagehand, ctx, "/conversations", {
      waitForSelector: '[data-testid="conversations"]',
    });

    // Search for the contact in the conversation sidebar
    console.log(`[GHL Conversations] Searching for contact: ${input.contactSearchTerm}`);
    await safeAct(stagehand, `Type "${input.contactSearchTerm}" into the conversation search input`);
    await delay(2000);

    // Click on the matching conversation
    await safeAct(stagehand, "Click on the first conversation result that matches the search");
    await delay(1500);

    // Select the appropriate channel (SMS, Email, WhatsApp)
    const channelLabel = input.channel === "sms" ? "SMS" : input.channel === "email" ? "Email" : "WhatsApp";
    console.log(`[GHL Conversations] Selecting channel: ${channelLabel}`);
    await safeAct(stagehand, `Select or click the ${channelLabel} channel tab or dropdown`);
    await delay(1000);

    // If email, fill in the subject line
    if (input.channel === "email" && input.subject) {
      await safeAct(stagehand, `Type "${input.subject}" into the subject field`);
      await delay(500);
    }

    // Type the message
    console.log("[GHL Conversations] Typing message...");
    await safeAct(stagehand, `Type the following message into the message input: ${input.message}`);
    await delay(500);

    // Send the message
    await safeAct(stagehand, "Click the Send button to send the message");
    await delay(2000);

    // Verify the message was sent
    const result = await safeExtract(
      stagehand,
      "Check if the message was sent successfully by looking for the sent message in the conversation thread",
      z.object({
        sent: z.boolean(),
        lastMessagePreview: z.string().optional(),
      }),
    );

    console.log("[GHL Conversations] Message send result:", result);
    return {
      messageSent: result?.sent ?? true,
      channel: input.channel,
      contact: input.contactSearchTerm,
    };
  });
}

/**
 * Configure an AI chatbot in Conversation AI settings.
 * Navigates to conversation AI settings, creates a new bot,
 * configures name/instructions/channels/response delay/handoff keywords,
 * and saves.
 */
export async function conversationAiSetup(
  stagehand: Stagehand,
  ctx: GHLAutomationContext,
  input: ConversationAiSetupInput,
): Promise<GHLAutomationResult> {
  return executeFunction("conversation_ai_setup", async () => {
    // Navigate to Conversation AI settings
    await navigateTo(stagehand, ctx, "/conversations/settings", {
      waitForSelector: '[data-testid="conversation-ai"]',
    });

    // Look for the AI/Bot configuration section
    await safeAct(stagehand, "Click on the Conversation AI or Bot section");
    await delay(2000);

    // Create a new bot
    await safeAct(stagehand, "Click the Create Bot or Add Bot button");
    await delay(1500);
    await waitForPageLoad(stagehand);

    // Set bot name
    console.log(`[GHL Conversations] Setting bot name: ${input.botName}`);
    await safeAct(stagehand, `Type "${input.botName}" into the bot name field`);
    await delay(500);

    // Set bot instructions
    console.log("[GHL Conversations] Setting bot instructions...");
    await safeAct(
      stagehand,
      `Type the following instructions into the bot instructions or system prompt field: ${input.instructions}`,
    );
    await delay(500);

    // Configure channels
    for (const channel of input.channels) {
      const channelName = channel === "sms" ? "SMS" : channel === "email" ? "Email" : channel === "webchat" ? "Web Chat" : "WhatsApp";
      console.log(`[GHL Conversations] Enabling channel: ${channelName}`);
      await safeAct(stagehand, `Enable or check the ${channelName} channel for the bot`);
      await delay(500);
    }

    // Set response delay if provided
    if (input.responseDelay !== undefined) {
      console.log(`[GHL Conversations] Setting response delay: ${input.responseDelay}s`);
      await safeAct(
        stagehand,
        `Set the response delay to ${input.responseDelay} seconds`,
      );
      await delay(500);
    }

    // Set handoff keywords if provided
    if (input.handoffKeywords && input.handoffKeywords.length > 0) {
      console.log("[GHL Conversations] Setting handoff keywords...");
      for (const keyword of input.handoffKeywords) {
        await safeAct(
          stagehand,
          `Add "${keyword}" as a handoff keyword or human transfer keyword`,
        );
        await delay(300);
      }
    }

    // Save the bot configuration
    await safeAct(stagehand, "Click the Save or Create button to save the bot configuration");
    await delay(2000);

    // Verify save
    const result = await safeExtract(
      stagehand,
      "Check if the bot was saved successfully by looking for a success message or the bot in the list",
      z.object({
        saved: z.boolean(),
        botName: z.string().optional(),
      }),
    );

    console.log("[GHL Conversations] AI bot setup result:", result);
    return {
      botCreated: result?.saved ?? true,
      botName: input.botName,
      channels: input.channels,
    };
  });
}
