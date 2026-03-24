import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(400, 'validation_error', message);
  }
}

export class AuthError extends AppError {
  constructor(message = 'Authentication required.') {
    super(401, 'unauthorized', message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'You do not have permission to perform this action.') {
    super(403, 'forbidden', message);
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(404, 'not_found', `${resource} not found.`);
  }
}

export class RateLimitError extends AppError {
  public retryAfter: number;
  constructor(retryAfter: number) {
    super(429, 'rate_limit_exceeded', `Too many requests. Retry in ${retryAfter} seconds.`);
    this.retryAfter = retryAfter;
  }
}

/**
 * Global Fastify error handler.
 *
 * Maps errors to consistent HTTP responses:
 *   { error: "<code>", message: "<human readable>" }
 *
 * Stack traces are never exposed in production.
 */
export function errorHandler(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply,
): void {
  // Known application errors
  if (error instanceof AppError) {
    reply.status(error.statusCode).send({
      error: error.code,
      message: error.message,
    });
    return;
  }

  // Fastify validation errors (JSON Schema)
  if (error.validation) {
    reply.status(400).send({
      error: 'validation_error',
      message: error.message,
    });
    return;
  }

  // Rate limit errors (from @fastify/rate-limit)
  if (error.statusCode === 429) {
    reply.status(429).send({
      error: 'rate_limit_exceeded',
      message: error.message,
    });
    return;
  }

  // Log unexpected errors with request context
  request.log.error(
    {
      err: error,
      method: request.method,
      url: request.url,
      userId: request.currentUser?.id,
      apiKeyPrefix: request.apiKey?.prefix,
    },
    'Unhandled error',
  );

  // Never expose internals in production
  const isProduction = process.env.NODE_ENV === 'production';

  reply.status(error.statusCode ?? 500).send({
    error: 'internal_error',
    message: isProduction
      ? 'An unexpected error occurred. Please try again later.'
      : error.message || 'An unexpected error occurred.',
  });
}
