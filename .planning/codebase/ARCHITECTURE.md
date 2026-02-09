# Architecture

**Analysis Date:** 2026-01-16

## Pattern Overview

**Overall:** Modular Monolith with Service-Oriented Architecture (SOA)

**Key Characteristics:**
- Single codebase with clear separation of concerns
- Backend and frontend coexist in monorepo structure
- Heavy service layer abstraction for business logic
- tRPC for type-safe client-server communication
- Event-driven architecture with SSE and WebSocket support
- Background worker processes for async job handling

## Layers

**API/Communication Layer:**
- Purpose: Handle HTTP requests and route to appropriate handlers
- Contains: Express middleware, tRPC routers, REST endpoints
- Location: `server/_core/index.ts` (Express factory), `server/api/` (routes)
- Depends on: Service layer, context layer
- Used by: External clients (browser, webhooks)

**Routing Layer:**
- Purpose: Define and compose API endpoints
- Contains: 60+ tRPC routers aggregated in main router
- Location: `server/routers.ts`, `server/api/routers/*.ts`
- Key routers: agent, workflows, tasks, tools, browser, knowledge, rag, memory, swarm, email, voice, seo, ads, marketplace, subscription, credits, costs, analytics, security, webhooks, mcp, deployment
- Depends on: Service layer, database
- Used by: API layer

**Context & Auth Layer:**
- Purpose: Create request context and validate authentication
- Contains: TrpcContext creation, auth middleware, OAuth handlers
- Location: `server/_core/context.ts`, `server/_core/trpc.ts`, `server/_core/email-auth.ts`, `server/_core/oauth.ts`, `server/_core/google-auth.ts`
- Procedure types: publicProcedure, protectedProcedure, adminProcedure
- Depends on: Database, auth services
- Used by: All routers

**Service Layer:**
- Purpose: Core business logic and orchestration
- Contains: 100+ specialized services
- Location: `server/services/`
- Subdirectories: `memory/`, `intelligence/`, `security/`, `browser/`, `tools/`, `steps/`, `swarm/`
- Key services:
  - `agentOrchestrator.service.ts` - Manus 1.5 autonomous agent
  - `workflowExecution.service.ts` - Workflow orchestration
  - `taskExecution.service.ts` - Task execution engine
  - `stagehand.service.ts` - Browser automation
  - `subscription.service.ts` - Subscription management
- Depends on: Data access, providers, utilities
- Used by: Routers, workers

**Data Access Layer:**
- Purpose: Database operations and schema definitions
- Contains: Drizzle ORM client, schema definitions, relations
- Location: `server/db.ts`, `drizzle/schema*.ts`
- Schemas (18 files): schema.ts, schema-agent.ts, schema-auth.ts, schema-memory.ts, schema-knowledge.ts, schema-rag.ts, schema-webhooks.ts, schema-email.ts, schema-seo.ts, schema-sop.ts, schema-subscriptions.ts, schema-costs.ts, schema-alerts.ts, schema-security.ts, schema-admin.ts, schema-meta-ads.ts, schema-lead-enrichment.ts, schema-scheduled-tasks.ts
- Pool: 10 max connections, 30s idle timeout
- Depends on: PostgreSQL via pg driver
- Used by: Service layer

**Provider/LLM Layer:**
- Purpose: Abstract LLM provider implementations
- Contains: Provider factory, manager, and implementations
- Location: `server/providers/`
- Files: `base.provider.ts`, `anthropic.provider.ts`, `openai.provider.ts`, `gemini.provider.ts`, `ollama.provider.ts`, `provider.factory.ts`, `provider.manager.ts`
- Pattern: Abstract factory with concrete implementations
- Depends on: External LLM APIs
- Used by: Agent services, AI features

**Utilities & Core Infrastructure:**
- Purpose: Cross-cutting concerns and shared utilities
- Contains: Logging, error handling, retry logic, circuit breaker
- Location: `server/lib/`
- Key files: `logger.ts`, `errorTypes.ts`, `retry.ts`, `circuitBreaker.ts`, `sentry.ts`, `safeExpressionParser.ts`, `cacheKeys.ts`
- Depends on: External libraries (pino, Sentry)
- Used by: All layers

## Data Flow

**HTTP Request (tRPC):**

1. Client sends request to `/api/trpc` (`client/src/lib/trpc.ts`)
2. Express middleware stack processes (`server/_core/index.ts`):
   - Health check (`/api/health`) - fast path
   - Sentry middleware
   - Helmet security headers
   - Request ID injection
   - CORS handling
   - Body parsing
   - Request logging
   - Rate limiting
3. tRPC router resolution (`server/routers.ts`)
4. Context creation with user auth (`server/_core/context.ts`)
5. Middleware chain (public/protected/admin)
6. Router handler execution (`server/api/routers/*.ts`)
7. Service layer invocation with Zod validation
8. Database operations via Drizzle ORM
9. Response via SuperJSON serialization
10. React Query cache update, UI re-render

**Agent Task Execution:**

1. API call to `agent.executeTask()` (`server/api/routers/agent.ts`)
2. Get `AgentOrchestrator` instance (`server/services/agentOrchestrator.service.ts`)
3. Open SSE connection for real-time updates
4. Agent loop: Analyze → Plan → Think → Select Tool → Execute → Observe → Iterate
5. Updates streamed to client via SSE events
6. Memory and learning updates stored

**Workflow Execution:**

1. API call to `workflows.execute()` (`server/api/routers/workflows.ts`)
2. Trigger `executeWorkflow()` (`server/services/workflowExecution.service.ts`)
3. Stagehand browser automation (`server/services/stagehand.service.ts`)
4. Step-by-step execution with screenshot capture
5. Real-time progress via SSE

**Background Jobs:**

1. Job enqueued to BullMQ (`server/_core/queue.ts`)
2. Worker picks up job (`server/workers/index.ts`)
3. Specialized worker processes (`server/workers/*.ts`):
   - emailWorker.ts - Email delivery
   - voiceWorker.ts - Voice transcription
   - workflowWorker.ts - Scheduled workflows
   - webhookRetryWorker.ts - Webhook retries
   - memoryCleanup.worker.ts - Memory optimization
4. Results stored, notifications sent

**State Management:**
- Server: Stateless request handling, database per request
- Client: Zustand stores + React Query cache
- Real-time: SSE for agent progress, WebSocket for collaboration
- Jobs: Redis-backed BullMQ for persistence

## Key Abstractions

**Service Singleton:**
- Purpose: Encapsulate business logic for a domain
- Examples: `agentOrchestrator.service.ts`, `subscription.service.ts`, `stagehand.service.ts`
- Pattern: Factory functions or exported instances
- Export: `export function getAgentOrchestrator(): AgentOrchestratorService`

**tRPC Router:**
- Purpose: Define type-safe API endpoints
- Examples: `server/api/routers/agent.ts`, `server/api/routers/workflows.ts`
- Pattern: Router composition with shared context
- Export: `export const agentRouter = router({...})`

**Provider (LLM):**
- Purpose: Abstract LLM API implementations
- Examples: `AnthropicProvider`, `OpenAIProvider`, `GeminiProvider`
- Pattern: Abstract base class with factory
- Interface: `LLMProvider`, `LLMRequest`, `LLMResponse`

**Database Schema:**
- Purpose: Type-safe database table definitions
- Examples: `drizzle/schema.ts`, `drizzle/schema-agent.ts`
- Pattern: Drizzle ORM schema with relations
- Export: Table definitions and inferred types

## Entry Points

**Server Entry:**
- Location: `server/_core/index.ts`
- Triggers: `npm run dev` or `npm run start`
- Responsibilities: Create Express app, register middleware, mount routes

**Vercel Serverless:**
- Location: `api/index.ts`
- Triggers: HTTP requests to Vercel functions
- Responsibilities: Wrap Express app for serverless

**Client Entry:**
- Location: `client/src/main.tsx`
- Triggers: Browser loads application
- Responsibilities: Mount React app, initialize providers

**Worker Entry:**
- Location: `server/workers/index.ts`
- Triggers: `npm run workers`
- Responsibilities: Start BullMQ workers, process background jobs

## Error Handling

**Strategy:** Layered error handling with classification and recovery

**Patterns:**
- Services throw typed errors (`server/lib/errorTypes.ts`)
- tRPC middleware catches and transforms errors
- Circuit breaker prevents cascading failures (`server/lib/circuitBreaker.ts`)
- Retry with exponential backoff for transient errors (`server/lib/retry.ts`)
- Sentry captures and reports errors (`server/lib/sentry.ts`)

## Cross-Cutting Concerns

**Logging:**
- Tool: Pino logger (`server/lib/logger.ts`)
- Pattern: Structured JSON logging with context
- Levels: debug, info, warn, error

**Validation:**
- Tool: Zod schemas
- Location: Router input definitions, `server/api/schemas/`
- Pattern: Validate at API boundary, trust internal calls

**Authentication:**
- Tool: Custom middleware + Supabase
- Pattern: Context-based auth with procedure types
- Levels: Public (no auth), Protected (user required), Admin (role check)

**Real-time Updates:**
- SSE Manager: `server/_core/sse-manager.ts`
- SSE Routes: `server/_core/sse-routes.ts`
- Agent Events: `server/_core/agent-sse-events.ts`
- Client: `client/src/lib/sse-client.ts`

---

*Architecture analysis: 2026-01-16*
*Update when major patterns change*
