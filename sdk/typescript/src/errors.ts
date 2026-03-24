export class OrgoError extends Error {
  statusCode: number;
  errorCode: string;
  rawResponse: unknown;

  constructor(message: string, statusCode = 0, errorCode = '', rawResponse: unknown = null) {
    super(message);
    this.name = 'OrgoError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.rawResponse = rawResponse;
  }
}

export class AuthenticationError extends OrgoError {
  constructor(message: string, raw?: unknown) {
    super(message, 401, 'unauthorized', raw);
    this.name = 'AuthenticationError';
  }
}

export class NotFoundError extends OrgoError {
  constructor(message: string, raw?: unknown) {
    super(message, 404, 'not_found', raw);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends OrgoError {
  constructor(message: string, raw?: unknown) {
    super(message, 409, 'conflict', raw);
    this.name = 'ConflictError';
  }
}

export class RateLimitError extends OrgoError {
  retryAfter: number;

  constructor(message: string, retryAfter = 0, raw?: unknown) {
    super(message, 429, 'rate_limit_exceeded', raw);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

export class ValidationError extends OrgoError {
  constructor(message: string, raw?: unknown) {
    super(message, 400, 'validation_error', raw);
    this.name = 'ValidationError';
  }
}

export class ServerError extends OrgoError {
  constructor(message: string, raw?: unknown) {
    super(message, 500, 'internal_error', raw);
    this.name = 'ServerError';
  }
}

const STATUS_MAP: Record<number, new (msg: string, raw?: unknown) => OrgoError> = {
  400: ValidationError,
  401: AuthenticationError,
  404: NotFoundError,
  409: ConflictError,
  500: ServerError,
};

export function throwForStatus(status: number, body: Record<string, unknown>): never | void {
  if (status < 400) return;

  const message = (body.message as string) || `HTTP ${status}`;
  const ErrorClass = STATUS_MAP[status];

  if (status === 429) {
    throw new RateLimitError(message, (body.retryAfter ?? body.retry_after ?? 0) as number, body);
  }

  if (ErrorClass) {
    throw new ErrorClass(message, body);
  }

  throw new OrgoError(message, status, (body.error as string) || '', body);
}
