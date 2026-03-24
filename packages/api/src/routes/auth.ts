import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { and, eq, isNull } from 'drizzle-orm';
import argon2 from 'argon2';
import { db } from '../db/index.js';
import { apiKeys, users } from '../db/schema.js';
import { generateApiKey } from '../lib/api-keys.js';
import {
  signAccessToken,
  signRefreshToken,
  type AccessTokenPayload,
  type RefreshTokenPayload,
} from '../lib/jwt.js';
import { AuthError, NotFoundError, ValidationError } from '../middleware/error-handler.js';
import { RATE_LIMITS } from '../middleware/rate-limit.js';

// ---------------------------------------------------------------------------
// Request body types
// ---------------------------------------------------------------------------

interface RegisterBody {
  email: string;
  name: string;
  password: string;
}

interface LoginBody {
  email: string;
  password: string;
}

interface CreateApiKeyBody {
  name: string;
}

interface RefreshBody {
  refresh_token: string;
}

// ---------------------------------------------------------------------------
// Route plugin
// ---------------------------------------------------------------------------

export async function authRoutes(app: FastifyInstance): Promise<void> {
  /**
   * POST /auth/register
   * Create a new user account.
   */
  app.post<{ Body: RegisterBody }>(
    '/register',
    {
      config: { rateLimit: RATE_LIMITS.auth },
      schema: {
        body: {
          type: 'object',
          required: ['email', 'name', 'password'],
          properties: {
            email: { type: 'string', format: 'email' },
            name: { type: 'string', minLength: 1, maxLength: 255 },
            password: { type: 'string', minLength: 8, maxLength: 128 },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: RegisterBody }>, reply: FastifyReply) => {
      const { email, name, password } = request.body;

      // Check if user already exists
      const [existing] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, email.toLowerCase()))
        .limit(1);

      if (existing) {
        throw new ValidationError('A user with this email already exists.');
      }

      const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

      const [user] = await db
        .insert(users)
        .values({
          email: email.toLowerCase(),
          name,
          passwordHash,
        })
        .returning({
          id: users.id,
          email: users.email,
          name: users.name,
          plan: users.plan,
          createdAt: users.createdAt,
        });

      return reply.status(201).send({ user });
    },
  );

  /**
   * POST /auth/login
   * Authenticate with email + password, receive JWT tokens.
   */
  app.post<{ Body: LoginBody }>(
    '/login',
    {
      config: { rateLimit: RATE_LIMITS.auth },
      schema: {
        body: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string' },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: LoginBody }>, reply: FastifyReply) => {
      const { email, password } = request.body;

      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, email.toLowerCase()))
        .limit(1);

      if (!user) {
        throw new AuthError('Invalid email or password.');
      }

      const validPassword = await argon2.verify(user.passwordHash, password);
      if (!validPassword) {
        throw new AuthError('Invalid email or password.');
      }

      const accessToken = signAccessToken(app, {
        user_id: user.id,
        email: user.email,
      });

      const refreshToken = signRefreshToken(app, {
        user_id: user.id,
        type: 'refresh',
      });

      return reply.send({
        access_token: accessToken,
        refresh_token: refreshToken,
        token_type: 'Bearer',
        expires_in: 900, // 15 minutes in seconds
      });
    },
  );

  /**
   * POST /auth/refresh
   * Exchange a refresh token for new access + refresh tokens.
   */
  app.post<{ Body: RefreshBody }>(
    '/refresh',
    {
      config: { rateLimit: RATE_LIMITS.auth },
      schema: {
        body: {
          type: 'object',
          required: ['refresh_token'],
          properties: {
            refresh_token: { type: 'string' },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: RefreshBody }>, reply: FastifyReply) => {
      const { refresh_token } = request.body;

      let payload: RefreshTokenPayload;
      try {
        payload = app.jwt.verify<RefreshTokenPayload>(refresh_token);
      } catch {
        throw new AuthError('Invalid or expired refresh token.');
      }

      if (payload.type !== 'refresh') {
        throw new AuthError('Invalid token type.');
      }

      const [user] = await db
        .select({ id: users.id, email: users.email })
        .from(users)
        .where(eq(users.id, payload.user_id))
        .limit(1);

      if (!user) {
        throw new AuthError('User no longer exists.');
      }

      const accessToken = signAccessToken(app, {
        user_id: user.id,
        email: user.email,
      });

      const newRefreshToken = signRefreshToken(app, {
        user_id: user.id,
        type: 'refresh',
      });

      return reply.send({
        access_token: accessToken,
        refresh_token: newRefreshToken,
        token_type: 'Bearer',
        expires_in: 900,
      });
    },
  );

  /**
   * POST /auth/api-keys
   * Generate a new API key for the authenticated user (JWT auth).
   * The full key is returned only in this response.
   */
  app.post<{ Body: CreateApiKeyBody }>(
    '/api-keys',
    {
      schema: {
        body: {
          type: 'object',
          required: ['name'],
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 255 },
          },
        },
      },
      preHandler: async (request: FastifyRequest, _reply: FastifyReply) => {
        try {
          await request.jwtVerify();
        } catch {
          throw new AuthError('Valid JWT access token required.');
        }
      },
    },
    async (
      request: FastifyRequest<{ Body: CreateApiKeyBody }>,
      reply: FastifyReply,
    ) => {
      const tokenPayload = request.user as AccessTokenPayload;
      const { name } = request.body;

      const { key, prefix, hash } = await generateApiKey();

      const [record] = await db
        .insert(apiKeys)
        .values({
          userId: tokenPayload.user_id,
          keyPrefix: prefix,
          keyHash: hash,
          name,
        })
        .returning({
          id: apiKeys.id,
          name: apiKeys.name,
          keyPrefix: apiKeys.keyPrefix,
          createdAt: apiKeys.createdAt,
        });

      if (!record) {
        return reply.status(500).send({ error: 'Failed to create API key' });
      }

      return reply.status(201).send({
        api_key: key,
        id: record.id,
        name: record.name,
        prefix: `sk_live_${record.keyPrefix}...`,
        created_at: record.createdAt,
      });
    },
  );

  /**
   * GET /auth/api-keys
   * List all API keys for the authenticated user (JWT auth).
   */
  app.get(
    '/api-keys',
    {
      preHandler: async (request: FastifyRequest, _reply: FastifyReply) => {
        try {
          await request.jwtVerify();
        } catch {
          throw new AuthError('Valid JWT access token required.');
        }
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const tokenPayload = request.user as AccessTokenPayload;

      const keys = await db
        .select({
          id: apiKeys.id,
          name: apiKeys.name,
          keyPrefix: apiKeys.keyPrefix,
          lastUsedAt: apiKeys.lastUsedAt,
          createdAt: apiKeys.createdAt,
          revokedAt: apiKeys.revokedAt,
        })
        .from(apiKeys)
        .where(eq(apiKeys.userId, tokenPayload.user_id));

      return reply.send({
        api_keys: keys.map((k) => ({
          ...k,
          prefix: `sk_live_${k.keyPrefix}...`,
        })),
      });
    },
  );

  /**
   * DELETE /auth/api-keys/:id
   * Revoke an API key by setting revoked_at.
   */
  app.delete<{ Params: { id: string } }>(
    '/api-keys/:id',
    {
      preHandler: async (request: FastifyRequest, _reply: FastifyReply) => {
        try {
          await request.jwtVerify();
        } catch {
          throw new AuthError('Valid JWT access token required.');
        }
      },
    },
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply,
    ) => {
      const tokenPayload = request.user as AccessTokenPayload;
      const { id } = request.params;

      const [key] = await db
        .select({ id: apiKeys.id, userId: apiKeys.userId })
        .from(apiKeys)
        .where(
          and(
            eq(apiKeys.id, id),
            eq(apiKeys.userId, tokenPayload.user_id),
            isNull(apiKeys.revokedAt),
          ),
        )
        .limit(1);

      if (!key) {
        throw new NotFoundError('API key');
      }

      await db
        .update(apiKeys)
        .set({ revokedAt: new Date() })
        .where(eq(apiKeys.id, id));

      return reply.status(204).send();
    },
  );
}
