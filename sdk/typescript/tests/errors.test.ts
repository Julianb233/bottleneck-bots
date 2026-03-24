import { describe, test, expect } from 'vitest';
import { OrgoError, AuthenticationError, RateLimitError, throwForStatus } from '../src/errors.js';

describe('errors', () => {
  test('OrgoError has correct properties', () => {
    const err = new OrgoError('test', 500, 'code');
    expect(err.message).toBe('test');
    expect(err.statusCode).toBe(500);
    expect(err.errorCode).toBe('code');
  });

  test('RateLimitError has retryAfter', () => {
    const err = new RateLimitError('slow', 30);
    expect(err.retryAfter).toBe(30);
    expect(err.statusCode).toBe(429);
  });

  test('throwForStatus maps 401', () => {
    expect(() => throwForStatus(401, { message: 'bad key' })).toThrow(AuthenticationError);
  });

  test('throwForStatus is noop for 200', () => {
    throwForStatus(200, {});
  });
});
