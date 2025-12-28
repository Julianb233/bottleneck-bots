import { createClient } from "@supabase/supabase-js";
import { generateApiKey, hashApiKey } from "./api-keys";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface ApiKey {
  id: string;
  user_id: string;
  name: string;
  key: string;
  hashed_key: string;
  last_used: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Get all API keys for a user
 */
export async function getUserApiKeys(userId: string): Promise<ApiKey[]> {
  const { data, error } = await supabase
    .from("api_keys")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Create a new API key for a user
 */
export async function createApiKey(
  userId: string,
  name: string
): Promise<ApiKey> {
  const key = generateApiKey();
  const hashedKey = hashApiKey(key);

  const { data, error } = await supabase
    .from("api_keys")
    .insert({
      user_id: userId,
      name,
      key,
      hashed_key: hashedKey,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Delete an API key
 */
export async function deleteApiKey(
  keyId: string,
  userId: string
): Promise<void> {
  const { error } = await supabase
    .from("api_keys")
    .delete()
    .eq("id", keyId)
    .eq("user_id", userId);

  if (error) throw error;
}

/**
 * Verify an API key and return the user ID
 */
export async function verifyApiKey(
  apiKey: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("api_keys")
    .select("user_id, id")
    .eq("key", apiKey)
    .single();

  if (error || !data) return null;

  // Update last_used timestamp
  await supabase
    .from("api_keys")
    .update({ last_used: new Date().toISOString() })
    .eq("id", data.id);

  return data.user_id;
}

/**
 * Verify API key using hash (more secure)
 */
export async function verifyApiKeyHash(
  apiKey: string
): Promise<string | null> {
  const hashedKey = hashApiKey(apiKey);

  const { data, error } = await supabase
    .from("api_keys")
    .select("user_id, id")
    .eq("hashed_key", hashedKey)
    .single();

  if (error || !data) return null;

  // Update last_used timestamp
  await supabase
    .from("api_keys")
    .update({ last_used: new Date().toISOString() })
    .eq("id", data.id);

  return data.user_id;
}

/**
 * Get user notification preferences
 */
export async function getUserNotificationPreferences(userId: string) {
  const { data, error } = await supabase
    .from("users")
    .select("notification_preferences")
    .eq("id", userId)
    .single();

  if (error) throw error;

  return (
    data?.notification_preferences || {
      emailOnFailure: true,
      emailOnSuccess: false,
      slackNotifications: false,
    }
  );
}

/**
 * Update user notification preferences
 */
export async function updateUserNotificationPreferences(
  userId: string,
  preferences: {
    emailOnFailure?: boolean;
    emailOnSuccess?: boolean;
    slackNotifications?: boolean;
  }
) {
  const { error } = await supabase
    .from("users")
    .update({ notification_preferences: preferences })
    .eq("id", userId);

  if (error) throw error;
}

/**
 * Create or update webhook secret for a bot
 */
export async function setWebhookSecret(
  botId: string,
  secret: string
): Promise<void> {
  const { error } = await supabase
    .from("webhook_secrets")
    .upsert({
      bot_id: botId,
      secret,
    });

  if (error) throw error;
}

/**
 * Get webhook secret for a bot
 */
export async function getWebhookSecret(
  botId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("webhook_secrets")
    .select("secret")
    .eq("bot_id", botId)
    .single();

  if (error || !data) return null;
  return data.secret;
}

/**
 * Verify webhook signature for a bot
 */
export async function verifyWebhookSignature(
  botId: string,
  payload: string,
  signature: string
): Promise<boolean> {
  const secret = await getWebhookSecret(botId);
  if (!secret) return false;

  const crypto = require("crypto");
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(`sha256=${expectedSignature}`)
  );
}
