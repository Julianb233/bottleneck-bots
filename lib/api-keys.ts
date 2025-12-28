import crypto from "crypto";

/**
 * Generate a secure API key
 * Format: bb_live_[32 random characters]
 */
export function generateApiKey(): string {
  const prefix = "bb_live_";
  const randomBytes = crypto.randomBytes(24);
  const key = randomBytes.toString("base64url"); // URL-safe base64
  return `${prefix}${key}`;
}

/**
 * Hash an API key for secure storage
 * Uses SHA-256 with salt for one-way hashing
 */
export function hashApiKey(apiKey: string): string {
  const salt = process.env.API_KEY_SALT || "bottleneck-bots-salt";
  return crypto
    .createHash("sha256")
    .update(apiKey + salt)
    .digest("hex");
}

/**
 * Validate an API key format
 * Checks if the key matches the expected format
 */
export function validateApiKeyFormat(apiKey: string): boolean {
  const regex = /^bb_live_[A-Za-z0-9_-]{32}$/;
  return regex.test(apiKey);
}

/**
 * Compare an API key with its hash
 */
export function verifyApiKey(apiKey: string, hashedKey: string): boolean {
  return hashApiKey(apiKey) === hashedKey;
}

/**
 * Mask an API key for display
 * Shows first 8 and last 4 characters
 */
export function maskApiKey(apiKey: string): string {
  if (apiKey.length < 12) {
    return "***";
  }
  return `${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 4)}`;
}

/**
 * Extract user ID from API key (if encoded)
 * This is a placeholder for future implementation
 */
export function extractUserIdFromKey(apiKey: string): string | null {
  // Future: encode user ID in the key for faster lookups
  return null;
}

/**
 * Generate a webhook secret for bot authentication
 * Similar to API key but with different prefix
 */
export function generateWebhookSecret(): string {
  const prefix = "bb_whsec_";
  const randomBytes = crypto.randomBytes(32);
  const secret = randomBytes.toString("base64url");
  return `${prefix}${secret}`;
}

/**
 * Validate webhook signature
 * Used for verifying webhook requests
 */
export function validateWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

/**
 * Generate a signature for webhook payload
 */
export function generateWebhookSignature(
  payload: string,
  secret: string
): string {
  return crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");
}

/**
 * Rate limiting key generator
 * Creates a consistent key for rate limiting based on API key or IP
 */
export function generateRateLimitKey(
  identifier: string,
  window: "minute" | "hour" | "day" = "minute"
): string {
  const timestamp = Date.now();
  const windowSize =
    window === "minute" ? 60000 : window === "hour" ? 3600000 : 86400000;
  const windowStart = Math.floor(timestamp / windowSize) * windowSize;
  return `ratelimit:${identifier}:${windowStart}`;
}

/**
 * Generate API key metadata
 * Additional information about the key
 */
export interface ApiKeyMetadata {
  version: string;
  createdAt: number;
  permissions: string[];
  rateLimit: number;
}

export function generateApiKeyMetadata(
  permissions: string[] = ["read", "write"],
  rateLimit: number = 100
): ApiKeyMetadata {
  return {
    version: "1.0",
    createdAt: Date.now(),
    permissions,
    rateLimit,
  };
}

/**
 * Encode metadata into API key (future feature)
 */
export function encodeMetadata(metadata: ApiKeyMetadata): string {
  return Buffer.from(JSON.stringify(metadata)).toString("base64url");
}

/**
 * Decode metadata from API key (future feature)
 */
export function decodeMetadata(encoded: string): ApiKeyMetadata | null {
  try {
    const decoded = Buffer.from(encoded, "base64url").toString("utf-8");
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}
