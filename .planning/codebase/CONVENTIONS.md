# Coding Conventions

**Analysis Date:** 2026-01-16

## Naming Patterns

**Files:**
- kebab-case for general files: `email-password.ts`, `user-service.ts`
- camelCase for service files: `apiKeyValidation.service.ts`, `agentOrchestrator.service.ts`
- PascalCase for React components: `NotificationCenter.tsx`, `SystemStatus.tsx`
- `*.service.ts` for service implementations
- `*.test.ts` or `*.spec.ts` for test files
- `index.ts` for barrel exports

**Functions:**
- camelCase for all functions: `loginWithEmailPassword()`, `createPasswordResetToken()`
- No special prefix for async functions
- `handle*` for event handlers: `handleClick`, `handleSubmit`

**Variables:**
- camelCase for variables: `currentUser`, `isLoading`
- UPPER_SNAKE_CASE for constants: `BCRYPT_ROUNDS = 10`, `PASSWORD_RESET_TOKEN_EXPIRY_HOURS = 24`
- `_` prefix for private/internal directories: `_core/`

**Types:**
- PascalCase for interfaces, no I prefix: `User`, `AgentState`, `CurrentExecution`
- PascalCase for type aliases: `AgentStatus`, `LLMResponse`
- `{ComponentName}Props` for React props: `NotificationCenterProps`
- Inferred types from Drizzle: `InsertUser`, `SelectUser`

## Code Style

**Formatting:**
- Prettier with `.prettierrc`
- Print width: 80 characters
- Tab width: 2 spaces
- Semicolons: required (`semi: true`)
- Quotes: double quotes (`singleQuote: false`, `jsxSingleQuote: false`)
- Bracket spacing: enabled
- Arrow function parens: omitted (`arrowParens: "avoid"`)
- Line endings: LF (`endOfLine: "lf"`)

**Linting:**
- ESLint with `.eslintrc.json`
- TypeScript support via `@typescript-eslint/parser`
- React: `plugin:react/recommended`, `plugin:react-hooks/recommended`
- Rules:
  - `react/react-in-jsx-scope: "off"` (React 19)
  - `@typescript-eslint/no-explicit-any: "warn"` (discouraged but allowed)
  - `no-console: "warn"` (discouraged but allowed)
  - `prefer-const: "warn"`
- Max warnings: 100 (enforced in CI)

## Import Organization

**Order:**
1. External packages (react, express, etc.)
2. Internal modules (@server/, @shared/)
3. Relative imports (., ..)
4. Type imports (import type {})

**Grouping:**
- Blank lines between groups
- Alphabetical within each group

**Path Aliases:**
- `@/` → client source
- `@server/` → server source
- `@shared/` → shared package
- `@/components/`, `@/hooks/`, `@/stores/` (client-specific)

## Error Handling

**Patterns:**
- Throw errors, catch at boundaries (route handlers, top-level)
- Extend Error class for custom errors
- Async functions use try/catch
- Log error with context before throwing

**Error Types:**
- Defined in `server/lib/errorTypes.ts`
- Classification and recovery strategies
- Throw on invalid input, missing dependencies
- Include cause: `new Error('Failed to X', { cause: originalError })`

## Logging

**Framework:**
- Pino logger instance from `server/lib/logger.ts`
- Levels: debug, info, warn, error

**Patterns:**
- Structured logging with context: `logger.info({ userId, action }, 'User action')`
- Log at service boundaries, not in utilities
- Log state transitions, external API calls, errors
- Note: Many console.log statements exist (tech debt - should migrate to Pino)

## Comments

**When to Comment:**
- Explain "why", not "what"
- Document business rules and edge cases
- Security-related comments: `// SECURITY: ...`
- Avoid obvious comments

**JSDoc/TSDoc:**
- Required for public API functions
- Use @param, @returns, @throws tags
- Example:
```typescript
/**
 * Register a new user with email and password
 * Automatically hashes the password and creates an email verification token
 */
export async function registerUser(data: UserRegistration) { ... }
```

**Section Headers:**
- Divider pattern: `// ========================================`
- Followed by section name
- Used to organize code into logical sections
- Example sections: `// Configuration`, `// User Registration`, `// Login`

**TODO Comments:**
- Format: `// TODO: description`
- Link to issue if exists: `// TODO: Fix X (issue #123)`

## Function Design

**Size:**
- Keep under 50 lines when practical
- Extract helpers for complex logic
- Note: Some large files exist (agentOrchestrator: 2,024 lines)

**Parameters:**
- Max 3-4 parameters
- Use options object for more: `function create(options: CreateOptions)`
- Destructure in parameter list

**Return Values:**
- Explicit return statements
- Return early for guard clauses
- Use typed return values

## Module Design

**Exports:**
- Named exports preferred
- Default exports for React components
- Export from index.ts for public API

**Service Exports:**
- Factory functions: `export function getServiceName(): ServiceName`
- Singletons: `export const serviceName = new ServiceName()`
- Classes: `export class ServiceName`

**Routers:**
- Pattern: `export const featureRouter = router({...})`
- Composition in `server/routers.ts`

## TypeScript Patterns

**Strict Mode:**
- `strict: true` in all tsconfigs
- Explicit type annotations preferred

**Type Imports:**
- Use `import type` for type-only imports
- Export types from `shared/types.ts`

**Zod Schemas:**
- Define inline in routers for input validation
- Separate files in `server/api/schemas/` for complex schemas

---

*Convention analysis: 2026-01-16*
*Update when patterns change*
