import crypto from 'node:crypto';
import argon2 from 'argon2';

const API_KEY_PREFIX = 'sk_live_';
const KEY_HEX_LENGTH = 64; // 32 bytes = 64 hex chars
const PREFIX_LENGTH = 8; // first 8 hex chars used for DB lookup
const FULL_KEY_LENGTH = API_KEY_PREFIX.length + KEY_HEX_LENGTH; // "sk_live_" + 64 hex = 72 chars

export interface GeneratedApiKey {
  /** Full key to return to user once — e.g. sk_live_abcdef01... */
  key: string;
  /** First 8 hex chars after sk_live_ — stored in DB for lookup */
  prefix: string;
  /** Argon2id hash of the full key — stored in DB for verification */
  hash: string;
}

/**
 * Generate a new API key with prefix and argon2id hash.
 * The full key is returned only once and must not be stored in plaintext.
 */
export async function generateApiKey(): Promise<GeneratedApiKey> {
  const hex = crypto.randomBytes(32).toString('hex'); // 64 hex chars
  const key = `${API_KEY_PREFIX}${hex}`;
  const prefix = hex.slice(0, PREFIX_LENGTH);
  const hash = await argon2.hash(key, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });

  return { key, prefix, hash };
}

/**
 * Verify a full API key against a stored argon2id hash.
 */
export async function verifyApiKey(key: string, hash: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, key);
  } catch {
    return false;
  }
}

/**
 * Parse an API key string and extract the prefix.
 * Returns null if the key format is invalid.
 */
export function parseApiKey(key: string): { prefix: string } | null {
  if (!key.startsWith(API_KEY_PREFIX)) {
    return null;
  }

  if (key.length !== FULL_KEY_LENGTH) {
    return null;
  }

  const hex = key.slice(API_KEY_PREFIX.length);
  // Validate hex characters
  if (!/^[0-9a-f]+$/.test(hex)) {
    return null;
  }

  return { prefix: hex.slice(0, PREFIX_LENGTH) };
}
