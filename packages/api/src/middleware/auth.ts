import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '../db/index.js';
import { apiKeys, users } from '../db/schema.js';
import { parseApiKey, verifyApiKey } from '../lib/api-keys.js';

/** Routes that do not require authentication. */
const PUBLIC_ROUTES: Array<{ method: string; path: string }> = [
  { method: 'GET', path: '/health' },
  { method: 'POST', path: '/api/v1/auth/register' },
  { method: 'POST', path: '/api/v1/auth/login' },
  { method: 'POST', path: '/api/v1/auth/refresh' },
];

/** Route prefixes that do not require authentication. */
const PUBLIC_PREFIXES: Array<{ method: string; prefix: string }> = [
  { method: 'POST', prefix: '/api/v1/invites/' },
  { method: 'GET', prefix: '/api/v1/auth/api-keys' },
  { method: 'POST', prefix: '/api/v1/auth/api-keys' },
  { method: 'DELETE', prefix: '/api/v1/auth/api-keys' },
  { method: 'GET', prefix: '/docs' },
  { method: 'GET', prefix: '/openapi.json' },
];

function isPublicRoute(method: string, url: string): boolean {
  const path = url.split('?')[0]!;
  const upperMethod = method.toUpperCase();

  if (PUBLIC_ROUTES.some((r) => r.method === upperMethod && path === r.path)) {
    return true;
  }

  if (PUBLIC_PREFIXES.some((r) => r.method === upperMethod && path.startsWith(r.prefix))) {
    return true;
  }

  return false;
}

declare module 'fastify' {
  interface FastifyRequest {
    apiKey?: {
      id: string;
      prefix: string;
      userId: string;
    };
    currentUser?: {
      id: string;
      email: string;
      name: string;
      plan: 'free' | 'pro' | 'team';
    };
  }
}

/**
 * Register the API key authentication preHandler hook.
 *
 * For non-public routes, extracts Bearer token from Authorization header,
 * looks up the key by prefix, verifies the hash, and attaches user + apiKey
 * to the request.
 */
export async function authMiddleware(app: FastifyInstance): Promise<void> {
  app.addHook(
    'preHandler',
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (isPublicRoute(request.method, request.url)) {
        return;
      }

      const authHeader = request.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return reply.status(401).send({
          error: 'unauthorized',
          message: 'Missing or invalid Authorization header. Use: Bearer sk_live_...',
        });
      }

      const token = authHeader.slice(7);
      const parsed = parseApiKey(token);
      if (!parsed) {
        return reply.status(401).send({
          error: 'unauthorized',
          message: 'Invalid API key format.',
        });
      }

      // Look up non-revoked keys matching this prefix
      const candidates = await db
        .select()
        .from(apiKeys)
        .where(
          and(eq(apiKeys.keyPrefix, parsed.prefix), isNull(apiKeys.revokedAt)),
        );

      if (candidates.length === 0) {
        return reply.status(401).send({
          error: 'unauthorized',
          message: 'Invalid API key.',
        });
      }

      // Verify hash against each candidate (usually just one)
      let matchedKey: (typeof candidates)[0] | null = null;
      for (const candidate of candidates) {
        const valid = await verifyApiKey(token, candidate.keyHash);
        if (valid) {
          matchedKey = candidate;
          break;
        }
      }

      if (!matchedKey) {
        return reply.status(401).send({
          error: 'unauthorized',
          message: 'Invalid API key.',
        });
      }

      // Update last_used_at (fire-and-forget)
      db.update(apiKeys)
        .set({ lastUsedAt: new Date() })
        .where(eq(apiKeys.id, matchedKey.id))
        .execute()
        .catch((err) => request.log.error(err, 'Failed to update last_used_at'));

      // Fetch the user
      const [user] = await db
        .select({
          id: users.id,
          email: users.email,
          name: users.name,
          plan: users.plan,
        })
        .from(users)
        .where(eq(users.id, matchedKey.userId))
        .limit(1);

      if (!user) {
        return reply.status(401).send({
          error: 'unauthorized',
          message: 'User associated with this API key no longer exists.',
        });
      }

      request.apiKey = {
        id: matchedKey.id,
        prefix: matchedKey.keyPrefix,
        userId: matchedKey.userId,
      };
      request.currentUser = user;
    },
  );
}
