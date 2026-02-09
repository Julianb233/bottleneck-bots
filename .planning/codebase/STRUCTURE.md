# Codebase Structure

**Analysis Date:** 2026-01-16

## Directory Layout

```
Bottleneck-Bots/
├── api/                          # Vercel serverless handler
├── client/                       # React frontend application
│   ├── src/
│   │   ├── components/          # UI and feature components
│   │   ├── pages/               # Page-level components
│   │   ├── hooks/               # Custom React hooks
│   │   ├── stores/              # Zustand state stores
│   │   ├── lib/                 # Utilities (trpc, sse-client)
│   │   ├── contexts/            # React contexts
│   │   ├── services/            # Client-side services
│   │   └── types/               # TypeScript types
│   └── public/                  # Static assets
├── server/                       # Backend application
│   ├── _core/                   # Core infrastructure
│   ├── api/                     # API routes and handlers
│   ├── services/                # Business logic (100+ services)
│   ├── providers/               # LLM provider implementations
│   ├── workers/                 # Background job workers
│   ├── lib/                     # Shared utilities
│   ├── mcp/                     # Model Context Protocol
│   └── prompts/                 # LLM system prompts
├── drizzle/                      # Database schemas & migrations
├── shared/                       # Code shared between client/server
├── tests/                        # Test suites (e2e, load, unit)
├── scripts/                      # Build and deployment scripts
├── docs/                         # Documentation
├── n8n-workflows/               # n8n workflow definitions
├── helm/                         # Kubernetes Helm charts
└── gitops/                       # GitOps configurations
```

## Directory Purposes

**api/**
- Purpose: Vercel serverless function entry point
- Contains: `index.ts` - Express app wrapper for Vercel deployment
- Key files: `index.ts`

**client/src/**
- Purpose: React frontend application
- Contains: Components, pages, hooks, stores, utilities
- Key files: `App.tsx`, `main.tsx`
- Subdirectories:
  - `components/` - 30+ component directories (UI, features)
  - `pages/` - Page components including admin pages
  - `hooks/` - Custom hooks (`useBrowserAutomation.ts`, `useQuiz.ts`)
  - `stores/` - Zustand stores (`agentStore`, `websocketStore`)
  - `lib/` - Utilities (`trpc.ts`, `sse-client.ts`)

**server/_core/**
- Purpose: Core server infrastructure and setup
- Contains: Express app factory, tRPC setup, auth handlers, SSE management
- Key files:
  - `index.ts` - Express app factory (`createApp()`)
  - `trpc.ts` - tRPC setup with middleware
  - `context.ts` - Request context creation
  - `config.ts` - Environment configuration
  - `email-auth.ts`, `oauth.ts`, `google-auth.ts` - Auth implementations
  - `sse-routes.ts`, `sse-manager.ts` - Server-sent events
  - `browserbase.ts` - Browser automation SDK
  - `queue.ts` - BullMQ job queue

**server/api/**
- Purpose: API routes and handlers
- Contains: tRPC routers, REST routes, webhooks, schemas
- Subdirectories:
  - `routers/` - 60+ tRPC routers (agent, workflows, tasks, etc.)
  - `rest/` - Production REST API
  - `webhooks/` - Webhook handlers (Stripe)
  - `routes/` - REST route handlers (OAuth)
  - `schemas/` - Zod validation schemas

**server/services/**
- Purpose: Business logic services (100+ files)
- Contains: Domain services, orchestration, integrations
- Subdirectories:
  - `memory/` - Agent memory services (checkpoint, learning, patterns)
  - `intelligence/` - Adaptive strategy services (failure recovery)
  - `security/` - Credential vault, execution control
  - `browser/` - Browser context management (multi-tab, file upload)
  - `tools/` - Tool implementations (Shell, File, Map, Match)
  - `steps/` - Workflow step handlers
  - `swarm/` - Agent swarm coordination
- Key files:
  - `agentOrchestrator.service.ts` - Main agent logic (2,024 lines)
  - `workflowExecution.service.ts` - Workflow orchestration
  - `stagehand.service.ts` - Browser automation
  - `subscription.service.ts` - Subscription management

**server/providers/**
- Purpose: LLM provider integrations
- Contains: Abstract base, concrete implementations, factory
- Key files:
  - `base.provider.ts` - Abstract base with health checks
  - `anthropic.provider.ts` - Claude API
  - `openai.provider.ts` - OpenAI API
  - `gemini.provider.ts` - Google Gemini
  - `ollama.provider.ts` - Local Ollama
  - `provider.factory.ts` - Factory pattern
  - `provider.manager.ts` - Lifecycle management
  - `types.ts` - Provider interfaces

**server/workers/**
- Purpose: Background job processing
- Contains: BullMQ workers for async tasks
- Key files:
  - `index.ts` - Worker startup
  - `emailWorker.ts` - Email delivery
  - `voiceWorker.ts` - Voice processing
  - `workflowWorker.ts` - Scheduled workflows
  - `webhookRetryWorker.ts` - Webhook retries
  - `memoryCleanup.worker.ts` - Memory optimization

**server/lib/**
- Purpose: Shared utility libraries
- Contains: Logging, error handling, retry logic, circuit breaker
- Key files:
  - `logger.ts` - Pino logger configuration
  - `sentry.ts` - Error tracking setup
  - `errorTypes.ts` - Error classification
  - `retry.ts` - Exponential backoff
  - `circuitBreaker.ts` - Fault tolerance
  - `safeExpressionParser.ts` - Safe expression evaluation
  - `cacheKeys.ts` - Cache key generation

**drizzle/**
- Purpose: Database schema definitions and migrations
- Contains: 18 specialized schema files, relations, migrations
- Key files:
  - `schema.ts` - Users, sessions, core tables
  - `schema-agent.ts` - Agent configurations
  - `schema-memory.ts` - Memory and learning
  - `schema-knowledge.ts` - Knowledge base
  - `schema-rag.ts` - RAG embeddings
  - `schema-subscriptions.ts` - Subscription system
  - `relations.ts` - Table relationships
- Subdirectories:
  - `migrations/` - Migration files
  - `meta/` - Migration metadata

**shared/**
- Purpose: Code shared between client and server
- Contains: Types, constants, error definitions
- Key files:
  - `types.ts` - Unified type exports
  - `const.ts` - Shared constants
  - `_core/errors.ts` - Shared error types

**tests/**
- Purpose: Test suites organized by type
- Subdirectories:
  - `e2e/` - Playwright E2E tests (smoke, prelaunch)
  - `load/` - k6 load tests (api-load, api-stress, api-spike)
  - Co-located unit tests in source directories

## Key File Locations

**Entry Points:**
- `server/_core/index.ts` - Express app factory
- `api/index.ts` - Vercel serverless handler
- `client/src/main.tsx` - React app entry
- `server/workers/index.ts` - Worker startup

**Configuration:**
- `package.json` - Dependencies and scripts
- `tsconfig.json` - TypeScript with path aliases
- `vite.config.ts` - Frontend build
- `esbuild.config.mjs` - Backend build
- `drizzle.config.ts` - Database migrations
- `vitest.config.ts` - Test runner
- `playwright.config.ts` - E2E tests
- `.env.example` - Environment template

**Core Logic:**
- `server/routers.ts` - Main router composition
- `server/db.ts` - Database client
- `server/services/agentOrchestrator.service.ts` - Agent logic
- `server/services/workflowExecution.service.ts` - Workflow engine

**Testing:**
- `vitest.config.ts` - Vitest configuration
- `vitest.setup.ts` - Test setup and mocks
- `playwright.config.ts` - E2E configuration
- `tests/load/k6.config.js` - Load test config

## Naming Conventions

**Files:**
- kebab-case for general files: `email-password.ts`, `user-service.ts`
- camelCase for services: `apiKeyValidation.service.ts`
- PascalCase for React components: `NotificationCenter.tsx`
- `*.service.ts` suffix for service files
- `*.test.ts` or `*.spec.ts` for tests
- `schema-*.ts` for database schema files

**Directories:**
- kebab-case for all directories
- `_core/` prefix for core infrastructure
- Plural for collections: `services/`, `providers/`, `workers/`

**Special Patterns:**
- `index.ts` for directory exports
- `__tests__/` for co-located test directories
- `.test.ts` alongside source files

## Where to Add New Code

**New Feature:**
- Primary code: `server/services/{feature}.service.ts`
- Router: `server/api/routers/{feature}.ts`
- Client components: `client/src/components/{feature}/`
- Tests: Co-located `*.test.ts` files

**New API Endpoint:**
- tRPC router: `server/api/routers/{domain}.ts`
- Add to main router: `server/routers.ts`
- Validation: `server/api/schemas/{domain}.ts`

**New Database Table:**
- Schema: `drizzle/schema-{domain}.ts`
- Relations: Update `drizzle/relations.ts`
- Migration: `npx drizzle-kit generate`

**New Background Job:**
- Worker: `server/workers/{job}Worker.ts`
- Register in: `server/workers/index.ts`
- Queue setup: `server/_core/queue.ts`

**New LLM Provider:**
- Implementation: `server/providers/{provider}.provider.ts`
- Register in factory: `server/providers/provider.factory.ts`

**Utilities:**
- Shared helpers: `server/lib/`
- Client utilities: `client/src/lib/`
- Shared types: `shared/types.ts`

## Special Directories

**.planning/**
- Purpose: Project planning documents (created by GSD)
- Source: Generated by codebase mapping and planning
- Committed: Yes

**node_modules/**
- Purpose: Installed dependencies
- Source: pnpm install
- Committed: No (in .gitignore)

**dist/**
- Purpose: Build output
- Source: Vite and esbuild builds
- Committed: No (in .gitignore)

---

*Structure analysis: 2026-01-16*
*Update when directory structure changes*
