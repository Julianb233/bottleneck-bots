import type { FastifyInstance, FastifyRequest } from 'fastify';
import fastifyJwt from '@fastify/jwt';
import { config } from '../config.js';

export interface AccessTokenPayload {
  user_id: string;
  email: string;
}

export interface RefreshTokenPayload {
  user_id: string;
  type: 'refresh';
}

const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';

/**
 * Register the @fastify/jwt plugin on the Fastify instance.
 */
export async function registerJwt(app: FastifyInstance): Promise<void> {
  await app.register(fastifyJwt, {
    secret: config.jwtSecret,
  });
}

/**
 * Sign an access token (15 min expiry).
 */
export function signAccessToken(
  app: FastifyInstance,
  payload: AccessTokenPayload,
): string {
  return app.jwt.sign(payload, { expiresIn: ACCESS_TOKEN_EXPIRY });
}

/**
 * Sign a refresh token (7 day expiry).
 */
export function signRefreshToken(
  app: FastifyInstance,
  payload: RefreshTokenPayload,
): string {
  return app.jwt.sign(payload, { expiresIn: REFRESH_TOKEN_EXPIRY });
}

/**
 * Verify and decode a JWT token from the request.
 * Throws if the token is invalid or expired.
 */
export async function verifyToken<T extends Record<string, unknown>>(
  request: FastifyRequest,
): Promise<T> {
  await request.jwtVerify();
  return request.user as T;
}
