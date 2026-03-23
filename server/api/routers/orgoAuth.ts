/**
 * Orgo Auth Router
 *
 * Orgo-style user registration, email/password login, JWT token issuance/refresh.
 * Modeled after orgo-clone/packages/api/src/routes/auth.ts but adapted to BB's
 * tRPC + drizzle + jose stack.
 *
 * Endpoints:
 *   orgoAuth.register    — Create a new user account (email + password)
 *   orgoAuth.login       — Authenticate with email/password, receive JWT tokens
 *   orgoAuth.refresh     — Exchange a refresh token for new access + refresh tokens
 *   orgoAuth.me          — Get current user info from JWT (protected)
 *   orgoAuth.createApiKey — Generate an Orgo-style API key (sk_live_...)
 *   orgoAuth.listApiKeys  — List user's API keys
 *   orgoAuth.revokeApiKey — Revoke an API key
 *
 * Linear: AI-5246
 */

import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../../db";
import { users } from "../../../drizzle/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { SignJWT, jwtVerify } from "jose";
import { ENV } from "../../_core/env";

// ========================================
// JWT Configuration
// ========================================

const ACCESS_TOKEN_EXPIRY_SECONDS = 900; // 15 minutes
const REFRESH_TOKEN_EXPIRY_SECONDS = 604800; // 7 days
const BCRYPT_ROUNDS = 10;

function getJwtSecret(): Uint8Array {
  const secret = ENV.cookieSecret || "dev-secret-change-me";
  return new TextEncoder().encode(secret);
}

// ========================================
// Token Types
// ========================================

interface AccessTokenPayload extends Record<string, unknown> {
  user_id: number;
  email: string;
  type: "access";
}

interface RefreshTokenPayload extends Record<string, unknown> {
  user_id: number;
  type: "refresh";
}

// ========================================
// Token Helpers
// ========================================

async function signAccessToken(userId: number, email: string): Promise<string> {
  const secret = getJwtSecret();
  return new SignJWT({ user_id: userId, email, type: "access" } satisfies AccessTokenPayload)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_EXPIRY_SECONDS}s`)
    .sign(secret);
}

async function signRefreshToken(userId: number): Promise<string> {
  const secret = getJwtSecret();
  return new SignJWT({ user_id: userId, type: "refresh" } satisfies RefreshTokenPayload)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime(`${REFRESH_TOKEN_EXPIRY_SECONDS}s`)
    .sign(secret);
}

async function verifyToken<T extends Record<string, unknown>>(token: string): Promise<T> {
  const secret = getJwtSecret();
  const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });
  return payload as unknown as T;
}

// ========================================
// API Key Helpers (Orgo-style sk_live_...)
// ========================================

const API_KEY_PREFIX = "sk_live_";
const KEY_HEX_LENGTH = 64; // 32 bytes = 64 hex chars
const PREFIX_LENGTH = 8;

function generateOrgoApiKey(): { key: string; prefix: string; hash: string } {
  const hex = crypto.randomBytes(32).toString("hex");
  const key = `${API_KEY_PREFIX}${hex}`;
  const prefix = hex.slice(0, PREFIX_LENGTH);
  const hash = crypto.createHash("sha256").update(key).digest("hex");
  return { key, prefix, hash };
}

// ========================================
// Validation
// ========================================

const registerSchema = z.object({
  email: z.string().email().max(320),
  name: z.string().min(1).max(255),
  password: z.string().min(8).max(128),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const refreshSchema = z.object({
  refresh_token: z.string().min(1),
});

const createApiKeySchema = z.object({
  name: z.string().min(1).max(255),
});

// ========================================
// Router
// ========================================

export const orgoAuthRouter = router({
  /**
   * POST-style register — create a new user account.
   * Returns the created user (no tokens — call login after).
   */
  register: publicProcedure
    .input(registerSchema)
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      const email = input.email.toLowerCase().trim();

      // Check if user already exists
      const [existing] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "A user with this email already exists.",
        });
      }

      const hashedPassword = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

      const [user] = await db
        .insert(users)
        .values({
          email,
          name: input.name,
          password: hashedPassword,
          loginMethod: "email",
        })
        .returning({
          id: users.id,
          email: users.email,
          name: users.name,
          role: users.role,
          createdAt: users.createdAt,
        });

      return { user };
    }),

  /**
   * POST-style login — authenticate with email + password, receive JWT tokens.
   */
  login: publicProcedure
    .input(loginSchema)
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      const email = input.email.toLowerCase().trim();

      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (!user) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid email or password." });
      }

      if (user.suspendedAt) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Account suspended." });
      }

      if (!user.password) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid email or password.",
        });
      }

      const validPassword = await bcrypt.compare(input.password, user.password);
      if (!validPassword) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid email or password." });
      }

      // Update last signed in
      await db
        .update(users)
        .set({ lastSignedIn: new Date() })
        .where(eq(users.id, user.id));

      const accessToken = await signAccessToken(user.id, user.email);
      const refreshToken = await signRefreshToken(user.id);

      return {
        access_token: accessToken,
        refresh_token: refreshToken,
        token_type: "Bearer" as const,
        expires_in: ACCESS_TOKEN_EXPIRY_SECONDS,
      };
    }),

  /**
   * POST-style refresh — exchange a refresh token for new access + refresh tokens.
   */
  refresh: publicProcedure
    .input(refreshSchema)
    .mutation(async ({ input }) => {
      let payload: RefreshTokenPayload;
      try {
        payload = await verifyToken<RefreshTokenPayload>(input.refresh_token);
      } catch {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid or expired refresh token." });
      }

      if (payload.type !== "refresh") {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid token type." });
      }

      const db = await getDb();
      if (!db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      const [user] = await db
        .select({ id: users.id, email: users.email })
        .from(users)
        .where(eq(users.id, payload.user_id))
        .limit(1);

      if (!user) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "User no longer exists." });
      }

      const accessToken = await signAccessToken(user.id, user.email);
      const refreshToken = await signRefreshToken(user.id);

      return {
        access_token: accessToken,
        refresh_token: refreshToken,
        token_type: "Bearer" as const,
        expires_in: ACCESS_TOKEN_EXPIRY_SECONDS,
      };
    }),

  /**
   * GET-style me — return current user from JWT token.
   * Requires a valid access token (protectedProcedure uses session cookie;
   * this endpoint verifies an Orgo-style Bearer JWT from the input instead).
   */
  me: publicProcedure
    .input(z.object({ access_token: z.string().min(1) }))
    .query(async ({ input }) => {
      let payload: AccessTokenPayload;
      try {
        payload = await verifyToken<AccessTokenPayload>(input.access_token);
      } catch {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid or expired access token." });
      }

      if (payload.type !== "access") {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid token type." });
      }

      const db = await getDb();
      if (!db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      const [user] = await db
        .select({
          id: users.id,
          email: users.email,
          name: users.name,
          role: users.role,
          createdAt: users.createdAt,
        })
        .from(users)
        .where(eq(users.id, payload.user_id))
        .limit(1);

      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found." });
      }

      return { user };
    }),

  /**
   * Create an Orgo-style API key (sk_live_...).
   * Requires a valid access token.
   */
  createApiKey: publicProcedure
    .input(z.object({
      access_token: z.string().min(1),
      name: z.string().min(1).max(255),
    }))
    .mutation(async ({ input }) => {
      let payload: AccessTokenPayload;
      try {
        payload = await verifyToken<AccessTokenPayload>(input.access_token);
      } catch {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Valid JWT access token required." });
      }

      if (payload.type !== "access") {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid token type." });
      }

      const { key, prefix, hash } = generateOrgoApiKey();

      // Store in a format compatible with the existing apiKeys table
      // We'll use the BB apiKeys table since it already exists
      const db = await getDb();
      if (!db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      // Import the BB apiKeys table
      const { apiKeys } = await import("../../../drizzle/schema");

      const [record] = await db
        .insert(apiKeys)
        .values({
          userId: payload.user_id,
          name: input.name,
          keyHash: hash,
          keyPrefix: `sk_${prefix}`,
          scopes: ["*"],
          isActive: true,
          rateLimitPerMinute: 60,
          rateLimitPerHour: 1000,
          rateLimitPerDay: 10000,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning({
          id: apiKeys.id,
          name: apiKeys.name,
          keyPrefix: apiKeys.keyPrefix,
          createdAt: apiKeys.createdAt,
        });

      return {
        api_key: key,
        id: record.id,
        name: record.name,
        prefix: `${API_KEY_PREFIX}${prefix}...`,
        created_at: record.createdAt,
      };
    }),

  /**
   * List all API keys for the authenticated user.
   */
  listApiKeys: publicProcedure
    .input(z.object({ access_token: z.string().min(1) }))
    .query(async ({ input }) => {
      let payload: AccessTokenPayload;
      try {
        payload = await verifyToken<AccessTokenPayload>(input.access_token);
      } catch {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Valid JWT access token required." });
      }

      const db = await getDb();
      if (!db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      const { apiKeys } = await import("../../../drizzle/schema");

      const keys = await db
        .select({
          id: apiKeys.id,
          name: apiKeys.name,
          keyPrefix: apiKeys.keyPrefix,
          lastUsedAt: apiKeys.lastUsedAt,
          createdAt: apiKeys.createdAt,
          isActive: apiKeys.isActive,
        })
        .from(apiKeys)
        .where(eq(apiKeys.userId, payload.user_id));

      return {
        api_keys: keys.map((k) => ({
          ...k,
          prefix: `${k.keyPrefix}...`,
        })),
      };
    }),

  /**
   * Revoke an API key.
   */
  revokeApiKey: publicProcedure
    .input(z.object({
      access_token: z.string().min(1),
      key_id: z.number().int(),
    }))
    .mutation(async ({ input }) => {
      let payload: AccessTokenPayload;
      try {
        payload = await verifyToken<AccessTokenPayload>(input.access_token);
      } catch {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Valid JWT access token required." });
      }

      const db = await getDb();
      if (!db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }

      const { apiKeys } = await import("../../../drizzle/schema");
      const { and } = await import("drizzle-orm");

      const [key] = await db
        .select({ id: apiKeys.id, userId: apiKeys.userId })
        .from(apiKeys)
        .where(
          and(
            eq(apiKeys.id, input.key_id),
            eq(apiKeys.userId, payload.user_id),
            eq(apiKeys.isActive, true),
          )
        )
        .limit(1);

      if (!key) {
        throw new TRPCError({ code: "NOT_FOUND", message: "API key not found." });
      }

      await db
        .update(apiKeys)
        .set({ isActive: false, revokedAt: new Date(), updatedAt: new Date() })
        .where(eq(apiKeys.id, input.key_id));

      return { success: true };
    }),
});
