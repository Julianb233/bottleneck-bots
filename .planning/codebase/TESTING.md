# Testing Patterns

**Analysis Date:** 2026-01-16

## Test Framework

**Runner:**
- Vitest 4.0.15 - Unit and integration tests
- Config: `vitest.config.ts` in project root

**Assertion Library:**
- Vitest built-in expect
- Matchers: toBe, toEqual, toThrow, toMatchObject, toHaveBeenCalled

**Run Commands:**
```bash
npm test                              # Run all tests
npm test -- --watch                   # Watch mode
npm test -- path/to/file.test.ts     # Single file
npm run test:coverage                 # Coverage report
npm run test:e2e                      # Playwright E2E tests
npm run test:e2e:smoke               # E2E smoke tests
npm run test:e2e:ui                  # E2E with UI
npm run test:load                    # k6 load tests
npm run test:load:stress             # Stress tests
npm run test:load:spike              # Spike tests
```

## Test File Organization

**Location:**
- Co-located tests: `*.test.ts` alongside source files
- Test directories: `__tests__/` subdirectory within feature directories
- Integration tests: `*.integration.test.ts` suffix

**Naming:**
- Unit tests: `module-name.test.ts`
- Integration tests: `feature.integration.test.ts`
- E2E tests: Located in `tests/e2e/`

**Structure:**
```
client/src/
  components/
    notifications/
      NotificationCenter.tsx
      __tests__/
        NotificationCenter.test.tsx
  lib/
    __tests__/
      notificationSounds.test.ts

server/
  api/routers/
    webhooks.ts
    webhooks.test.ts
  services/
    workflowExecution.service.ts
    workflowExecution.test.ts

tests/
  e2e/
    smoke/
    prelaunch/
    utils/
  load/
    api-load.test.js
    api-stress.test.js
    api-spike.test.js
```

## Test Structure

**Suite Organization:**
```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('ModuleName', () => {
  let mockCtx: any;

  beforeEach(() => {
    mockCtx = createMockContext({ id: 1 });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('functionName', () => {
    it('should handle success case', () => {
      // arrange
      const input = createTestInput();

      // act
      const result = functionName(input);

      // assert
      expect(result).toEqual(expectedOutput);
    });

    it('should throw on invalid input', () => {
      expect(() => functionName(null)).toThrow('Invalid input');
    });
  });
});
```

**Patterns:**
- Use beforeEach for per-test setup
- Use afterEach to restore mocks: `vi.restoreAllMocks()`
- Arrange/Act/Assert pattern
- One assertion focus per test
- Clear mocks between tests: `vi.clearAllMocks()`

## Mocking

**Framework:**
- Vitest built-in mocking (vi)
- Module mocking via vi.mock() at top of test file

**Patterns:**
```typescript
import { vi } from 'vitest';
import { externalFunction } from './external';

// Mock module
vi.mock('./external', () => ({
  externalFunction: vi.fn()
}));

// Mock in test
const mockFn = vi.mocked(externalFunction);
mockFn.mockReturnValue('mocked result');

expect(mockFn).toHaveBeenCalledWith('expected arg');
```

**Global Mocks (vitest.setup.ts):**
- `ioredis`: Complete mock Redis implementation
- `localStorage`: Mock with all CRUD methods
- `window.matchMedia`: Media query mock
- `ResizeObserver`: DOM API mock

**What to Mock:**
- External APIs and services
- File system operations
- Database connections
- Redis/cache
- Time/dates (`vi.useFakeTimers()`)

**What NOT to Mock:**
- Pure functions
- Simple utilities
- Internal business logic

## Fixtures and Factories

**Test Data:**
```typescript
// Factory pattern
function createMockUserWebhook(overrides?: Partial<UserWebhook>): UserWebhook {
  return {
    id: 1,
    userId: 1,
    webhookToken: "test-token-uuid",
    createdAt: new Date(),
    ...overrides,
  };
}

// Mock context factory
function createMockContext(user?: { id: number }) {
  return {
    user,
    req: {},
    res: {},
  };
}
```

**Location:**
- Factory functions: Define in test file or `tests/fixtures/`
- Shared fixtures: `tests/fixtures/`
- Test helpers: `client/src/__tests__/helpers/`

## Coverage

**Requirements:**
- No enforced coverage target
- Coverage tracked for awareness
- Focus on critical paths

**Configuration:**
- Vitest built-in coverage
- Excludes: `*.test.ts`, config files

**View Coverage:**
```bash
npm run test:coverage
open coverage/index.html
```

## Test Types

**Unit Tests:**
- Test single function/class in isolation
- Mock all external dependencies
- Fast: each test <100ms
- Location: Co-located `*.test.ts` files
- Count: 50+ test files

**Integration Tests:**
- Test multiple modules together
- Mock external services only
- Examples: `workflows.integration.test.ts`, `taskDistributor.integration.test.ts`

**E2E Tests:**
- Framework: Playwright 1.57.0
- Config: `playwright.config.ts`
- Location: `tests/e2e/`
- Subdirectories: `smoke/`, `prelaunch/`, `utils/`
- Example: `tests/auth-e2e-test.ts`

**Load Tests:**
- Framework: k6
- Location: `tests/load/`
- Files: `api-load.test.js`, `api-smoke.test.js`, `api-stress.test.js`, `api-spike.test.js`
- Config: `tests/load/k6.config.js`

## Common Patterns

**Async Testing:**
```typescript
it('should handle async operation', async () => {
  const result = await asyncFunction();
  expect(result).toBe('expected');
});
```

**Error Testing:**
```typescript
it('should throw on invalid input', () => {
  expect(() => functionCall()).toThrow('error message');
});

// Async error
it('should reject on failure', async () => {
  await expect(asyncCall()).rejects.toThrow('error message');
});
```

**React Component Testing:**
```typescript
import { render } from '@testing-library/react';
import { screen, waitFor } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';

describe('NotificationCenter', () => {
  it('renders notification bell icon', () => {
    render(
      <NotificationProvider>
        <NotificationCenter />
      </NotificationProvider>
    );
    expect(screen.getByLabelText(/notifications/i)).toBeInTheDocument();
  });
});
```

**Spies:**
```typescript
const spy = vi.spyOn(object, 'method');
// ... call code
expect(spy).toHaveBeenCalled();
expect(spy).toHaveBeenCalledWith('arg');
```

**Snapshot Testing:**
- Not actively used in this codebase
- Prefer explicit assertions for clarity

## Environment Configuration

**Test Environment:**
- Server tests: Node environment
- Client tests: jsdom environment
- Separation via `environmentMatchGlobs` in vitest config

**Setup File (vitest.setup.ts):**
- Mocks Redis globally
- Sets test environment variables
- Mocks browser APIs (localStorage, matchMedia, ResizeObserver)
- Configures testing-library

---

*Testing analysis: 2026-01-16*
*Update when test patterns change*
