# Bottleneck Bots

## What This Is

An AI-powered virtual employee platform for marketing agencies. Manus-style autonomous agents that navigate and execute tasks inside GoHighLevel (and other CRMs), create workflows, run campaigns, and manage client work -- replacing agency backend workforce with intelligent automation. Agencies can spin up multiple agents to execute tasks on their behalf across multiple platforms and communication channels.

## Core Value

**Full task loop that actually works**: User gives task -> agent plans -> agent navigates CRM via browser -> agent executes work -> agent reports back. If the agent can't autonomously complete real work inside GoHighLevel, nothing else matters.

## Tech Stack

- **Frontend**: React 19, Tailwind CSS 4, shadcn/ui (Radix), Wouter (routing), Zustand (state), TanStack React Query
- **Backend**: Node.js 20 + Express 4, tRPC 11 (end-to-end type safety)
- **Database**: Drizzle ORM + Supabase PostgreSQL (7 schema files)
- **AI**: Anthropic SDK, Google Gemini, OpenAI
- **Browser Automation**: BrowserBase SDK + Stagehand, Puppeteer Core, Playwright Core
- **Auth**: JWT (jose), OAuth, Google Auth, email-based auth
- **Payments**: Stripe (subscriptions + webhooks)
- **Jobs**: BullMQ + ioredis (background task queue)
- **Monitoring**: Sentry (Node + React)
- **Build**: Vite 7 (frontend) + esbuild (server)
- **Deploy**: Vercel (serverless functions)
- **Package Manager**: pnpm

## Current State (2026-03-16)

### What Exists (Validated)

- 37 frontend pages (auth, dashboard, agents, tasks, workflows, training, settings, admin, quizzes, campaigns, leads, browser sessions, scheduled tasks)
- 60+ tRPC routers covering: AI, agents, browser, workflows, tasks, templates, knowledge, RAG, webhooks, MCP, memory, analytics, credits, subscriptions, admin, scheduled tasks, voice, email, swarm, tools, SEO, ads, lead enrichment, webdev
- BrowserBase + Stagehand browser automation integration
- Agent orchestrator (Manus 1.5 style) with agent loop
- Workflow builder and execution engine
- RAG/Knowledge infrastructure with document upload and vector search
- Multi-LLM provider support (Anthropic, OpenAI, Gemini)
- Voice/calling via Vapi.ai
- MCP integration framework
- Real-time SSE updates
- Stripe subscription and credit system
- Vercel deployment config (`vercel.json`)
- Training page with document upload, SOP management

### What Needs Building (This Sprint)

- Vercel deployment with all env vars (not yet live)
- GHL API integration (48 functions from PRD-038) -- no `ghl.service.ts` exists yet
- Agent training UX for agency-specific workflows
- Task template system for common agency tasks
- Agent execution polish (live preview, history, retry, cron)
- Full UX audit and landing page polish

## Repo

- **Owner**: Julianb233
- **Repo**: Bottleneck-Bots
- **Branch**: main

## Constraints

- GoHighLevel is the first and primary CRM target
- BrowserBase + Stagehand for cloud browser automation (already integrated)
- Vercel for deployment (serverless)
- pnpm only (no npm/yarn)
- Node 20.x required

---
*Last updated: 2026-03-16*
