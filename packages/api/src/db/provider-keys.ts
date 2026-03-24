/**
 * Provider API key management — encrypted at rest with AES-256-GCM.
 */

import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { eq, and } from 'drizzle-orm';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { workspaces } from './schema.js';
import { db } from './index.js';

// ─── Schema ─────────────────────────────────────────────────────────────────

export const providerKeys = pgTable(
  'provider_keys',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    provider: varchar('provider', { length: 32 }).notNull(), // 'anthropic' | 'openai' | 'google'
    apiKeyEncrypted: text('api_key_encrypted').notNull(), // base64(iv:authTag:ciphertext)
    label: varchar('label', { length: 255 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('provider_keys_workspace_id_idx').on(table.workspaceId),
    index('provider_keys_workspace_provider_idx').on(table.workspaceId, table.provider),
  ],
);

// ─── Encryption ─────────────────────────────────────────────────────────────

/**
 * Get the 32-byte encryption key from environment.
 * Must be a 64-char hex string (256 bits).
 */
function getEncryptionKey(): Buffer {
  const hex = process.env.PROVIDER_KEY_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error(
      'PROVIDER_KEY_ENCRYPTION_KEY must be a 64-character hex string (256 bits). ' +
        'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
    );
  }
  return Buffer.from(hex, 'hex');
}

export function encryptApiKey(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(12); // 96-bit IV for GCM
  const cipher = createCipheriv('aes-256-gcm', key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  const authTag = cipher.getAuthTag();

  // Store as iv:authTag:ciphertext (all base64)
  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
}

export function decryptApiKey(encrypted: string): string {
  const key = getEncryptionKey();
  const parts = encrypted.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted key format');
  }

  const iv = Buffer.from(parts[0]!, 'base64');
  const authTag = Buffer.from(parts[1]!, 'base64');
  const ciphertext = parts[2]!;

  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = decipher.update(ciphertext, 'base64', 'utf8') + decipher.final('utf8');

  return decrypted;
}

// ─── CRUD ───────────────────────────────────────────────────────────────────

export type ProviderName = 'anthropic' | 'openai' | 'google';

export async function createProviderKey(
  workspaceId: string,
  provider: ProviderName,
  apiKey: string,
  label?: string,
): Promise<{ id: string }> {
  const encrypted = encryptApiKey(apiKey);
  const [row] = await db
    .insert(providerKeys)
    .values({
      workspaceId,
      provider,
      apiKeyEncrypted: encrypted,
      label,
    })
    .returning({ id: providerKeys.id });

  return row!;
}

export async function getProviderKey(
  workspaceId: string,
  provider: ProviderName,
): Promise<string | null> {
  const [row] = await db
    .select({ apiKeyEncrypted: providerKeys.apiKeyEncrypted })
    .from(providerKeys)
    .where(
      and(
        eq(providerKeys.workspaceId, workspaceId),
        eq(providerKeys.provider, provider),
      ),
    )
    .orderBy(providerKeys.createdAt)
    .limit(1);

  if (!row) return null;
  return decryptApiKey(row.apiKeyEncrypted);
}

export async function listProviderKeys(workspaceId: string): Promise<
  Array<{ id: string; provider: string; label: string | null; createdAt: Date }>
> {
  return db
    .select({
      id: providerKeys.id,
      provider: providerKeys.provider,
      label: providerKeys.label,
      createdAt: providerKeys.createdAt,
    })
    .from(providerKeys)
    .where(eq(providerKeys.workspaceId, workspaceId))
    .orderBy(providerKeys.createdAt);
}

export async function deleteProviderKey(id: string, workspaceId: string): Promise<boolean> {
  const result = await db
    .delete(providerKeys)
    .where(
      and(eq(providerKeys.id, id), eq(providerKeys.workspaceId, workspaceId)),
    )
    .returning({ id: providerKeys.id });

  return result.length > 0;
}
