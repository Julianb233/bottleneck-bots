# Technology Stack

**Analysis Date:** 2026-01-16

## Languages

**Primary:**
- TypeScript 5.9.3 - All application code (`package.json`, `tsconfig.json`)

**Secondary:**
- JavaScript (Node.js ESM) - Build scripts, config files (`esbuild.config.mjs`)
- Python 3.x - Sandbox environment (`sandbox/requirements.txt`)
- HTML/CSS/JSX - React components (`client/src/`)

## Runtime

**Environment:**
- Node.js 20.x (LTS) - `package.json` engines field
- Vercel serverless runtime - Edge functions and API routes

**Package Manager:**
- pnpm 10.4.1+ (primary) - `package.json` packageManager field
- Lockfile: `pnpm-lock.yaml` present
- Workspace monorepo structure (client, server, shared packages)

## Frameworks

**Core:**
- React 19.2.3 - Frontend UI framework (`client/src/`)
- Express.js 4.22.1 - Backend HTTP server (`server/_core/index.ts`)
- tRPC 11.8.0 - Type-safe RPC layer (`server/routers.ts`)

**Testing:**
- Vitest 4.0.15 - Unit and integration tests (`vitest.config.ts`)
- Playwright 1.57.0 - E2E testing (`playwright.config.ts`)
- @testing-library/react 16.3.1 - React component tests
- k6 - Load testing (`tests/load/`)

**Build/Dev:**
- Vite 7.3.0 - Frontend bundling (`vite.config.ts`)
- esbuild 0.27.1 - Backend compilation (`esbuild.config.mjs`)
- TailwindCSS 4.1.18 - Styling via Vite plugin
- TypeScript 5.9.3 - Type checking and compilation

## Key Dependencies

**Critical:**
- Drizzle ORM 0.44.7 - Database access (`drizzle.config.ts`, `server/db.ts`)
- drizzle-kit 0.31.8 - Database migrations
- @anthropic-ai/sdk 0.71.2 - Claude AI integration (`server/providers/anthropic.provider.ts`)
- openai 4.104.0 - OpenAI integration (`server/providers/openai.provider.ts`)
- @google/genai 1.33.0 - Google Gemini integration

**Infrastructure:**
- pg 8.16.3 - PostgreSQL driver (`server/db.ts`)
- @supabase/supabase-js 2.89.0 - Supabase client (`server/lib/supabase.ts`)
- ioredis 5.8.2 - Redis client (`server/services/redis.service.ts`)
- bullmq 5.66.0 - Job queue (`server/workers/`)
- stripe 20.0.0 - Payment processing (`server/api/webhooks/stripe.ts`)

**Browser Automation:**
- @browserbasehq/stagehand 3.0.6 - AI browser automation (`server/services/stagehand.service.ts`)
- @browserbasehq/sdk 2.6.0 - Browserbase cloud browsers (`server/_core/browserbaseSDK.ts`)
- playwright-core 1.57.0 - Browser control
- puppeteer-core 24.33.0 - Chrome automation

**UI Components:**
- Radix UI (25+ packages) - Headless component primitives
- Framer Motion 12.23.26 - Animations
- Lucide React 0.453.0 - Icons
- Recharts 2.15.4 - Charts and graphs
- React Hook Form 7.68.0 - Form management

**State & Data:**
- Zustand 5.0.9 - Client state management
- @tanstack/react-query 5.90.12 - Server state and caching
- Zod 4.2.0 - Schema validation
- superjson 1.13.3 - JSON serialization with types

## Configuration

**Environment:**
- `.env` files for local development (`.env.example` template)
- Vercel environment variables for production
- Required vars: DATABASE_URL, SUPABASE_URL, API keys for services

**Build:**
- `vite.config.ts` - Frontend build with Tailwind, Sentry plugins
- `esbuild.config.mjs` - Backend build configuration
- `tsconfig.json` - TypeScript with path aliases (@/, @server/, @shared/)
- `drizzle.config.ts` - Database migration configuration

## Platform Requirements

**Development:**
- Any platform with Node.js 20.x
- pnpm for package management
- Local PostgreSQL or Supabase project
- Redis for job queue (optional for dev)

**Production:**
- Vercel - Primary deployment platform
- Docker support available (`Dockerfile`)
- PostgreSQL (Supabase) for database
- Redis for BullMQ job queue
- Browserbase for cloud browser sessions

---

*Stack analysis: 2026-01-16*
*Update after major dependency changes*
