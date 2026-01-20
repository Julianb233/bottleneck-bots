# Bottleneck Bots

## What This Is

An AI-powered virtual employee platform for marketing agencies. Manus-style autonomous agents that navigate and execute tasks inside GoHighLevel (and other CRMs), create workflows, run campaigns, and manage client work — replacing agency backend workforce with intelligent automation. Agencies can spin up multiple agents to execute tasks on their behalf across multiple platforms and communication channels.

## Core Value

**Full task loop that actually works**: User gives task → agent plans → agent navigates CRM via browser → agent executes work → agent reports back. If the agent can't autonomously complete real work inside GoHighLevel, nothing else matters.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

- ✓ Browserbase + Stagehand browser automation integration — existing (`stagehand.service.ts`)
- ✓ Agent orchestrator (Manus 1.5 style) with agent loop — existing (`agentOrchestrator.service.ts`)
- ✓ Workflow and task execution engine — existing (`workflowExecution.service.ts`, `taskExecution.service.ts`)
- ✓ RAG/Knowledge infrastructure with vector search — existing (`schema-rag.ts`, `schema-knowledge.ts`)
- ✓ Multi-LLM provider support (Anthropic, OpenAI, Gemini) — existing (`server/providers/`)
- ✓ Voice/calling capabilities via Vapi.ai — existing (`vapi.service.ts`, `voiceWorker.ts`)
- ✓ MCP (Model Context Protocol) integration framework — existing (`mcp.ts` router)
- ✓ Real-time SSE updates for agent progress — existing (`sse-manager.ts`)
- ✓ tRPC API with 60+ routers — existing
- ✓ React 19 + Zustand + React Query frontend — existing
- ✓ GHL-specific automation helpers (login, workflow creation, module navigation) — existing

### Active

<!-- Current scope. Building toward these. -->

**Browser Automation & GHL Mastery:**
- [ ] Full task loop: receive task → execute in GoHighLevel → report back
- [ ] Build workflows in GHL from natural language prompts
- [ ] Manage campaigns (email/SMS) inside GHL
- [ ] Handle contacts (add, update, segment)
- [ ] Create funnels and landing pages in GHL

**Sandbox Environment (Manus-style):**
- [ ] Isolated code execution environment for agents (Docker sandbox)
- [ ] Agents can create, edit, manipulate files within chat
- [ ] Webdev system for generating React/TypeScript projects
- [ ] Checkpoint/snapshot system for project versions
- [ ] Visual editor for click-to-edit on generated content
- [ ] Deployment system for publishing agent-created content

**Client Context & Knowledge:**
- [ ] Gemini file upload integration for client RAG (drag-and-drop documents)
- [ ] Client bucket for communication guidelines, goals, objectives
- [ ] Platform documentation RAG (GHL support docs, HubStaff docs, Zoho docs)
- [ ] Agent learns from user corrections and feedback

**Multi-Channel Communication:**
- [ ] Chat interface (talk to agent like ChatGPT)
- [ ] Task queue (assign structured tasks from dashboard)
- [ ] Slack integration (message agent like a team member)
- [ ] Email communication
- [ ] SMS/text message interface
- [ ] Instagram DM integration
- [ ] Facebook Messenger integration

**Voice & Audio:**
- [ ] Voice input to agent (speak commands via audio)
- [ ] Meeting note taker integrations (Fireflies, etc.)
- [ ] Audio transcription for instructions

**MCP Tool Integrations:**
- [ ] Google Drive (file access for client documents)
- [ ] Google Calendar (scheduling)
- [ ] Notion (documentation sync)
- [ ] Gmail (email automation)
- [ ] Airtable (data management)
- [ ] Zapier (workflow orchestration)
- [ ] N8N (workflow orchestration alternative)

**Multi-CRM Platform Support:**
- [ ] GoHighLevel (primary, first focus)
- [ ] HubStaff (time tracking, workforce management)
- [ ] Zoho (CRM suite)
- [ ] Additional CRMs as requested

**Agency Dashboard & Multi-Agent:**
- [ ] Dashboard showing tasks to complete
- [ ] Spin up multiple agents per agency
- [ ] Agent assignment to specific clients
- [ ] Background task execution
- [ ] Send reports to users automatically
- [ ] Client communication on behalf of agency

### Out of Scope

<!-- Explicit boundaries. Includes reasoning to prevent re-adding. -->

- Client-facing agents (agents work directly for agency's clients) — focus on internal ops first
- Real-time video/screen share with agent — complexity, defer to v2
- Custom voice cloning — cost/complexity, Vapi handles voice
- White-label phone numbers — telephony provider complexity
- A/B testing for agent scripts — complexity, defer to v2

## Context

**Existing Codebase:**
- Modular monolith with 100+ services, 60+ tRPC routers
- Full Browserbase + Stagehand integration already working
- Agent orchestrator exists with agent loop (Manus 1.5 architecture)
- Voice calling infrastructure complete (Vapi.ai)
- MCP protocol support built

**Reference Architecture:**
- `docs/manus/Manus 1.5 System Prompt for Claude API.md` — Agent loop design
- `docs/manus/MANUS_REPLICA_ARCHITECTURE.md` — Full system blueprint
- `docs/manus/Claude-Flow + GHL Agency AI Integration Architecture.md` — GHL-specific integration

**Target Users:**
- Marketing agencies wanting to automate backend operations
- Solo agency owners who need to scale without hiring
- Teams using GoHighLevel, HubStaff, Zoho for client management

## Constraints

- **First Platform**: GoHighLevel — must master this before expanding to other CRMs
- **Browser Automation**: Browserbase + Stagehand — already integrated, continue with this stack
- **Task Entry Points**: All of chat interface, task queue, and Slack/messaging — multiple ways to give agent tasks
- **Agency Model**: Internal operations — agents do the agency's backend work (not client-facing yet)
- **LLM Providers**: Claude for reasoning, Gemini for GHL tasks (per Manus best practices), GPT-4o for actions
- **Infrastructure**: Vercel + Supabase + Redis + Docker — existing stack

## Key Decisions

<!-- Decisions that constrain future work. Add throughout project lifecycle. -->

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| GoHighLevel as first CRM | Most requested, best documented, largest agency market | — Pending |
| Browserbase + Stagehand for automation | Already integrated, cloud browsers, AI-powered actions | ✓ Good |
| Manus 1.5 architecture reference | Proven agent loop design, comprehensive tool framework | — Pending |
| Gemini for file upload RAG | Native drag-and-drop file processing, client context storage | — Pending |
| Multi-channel communication | Agencies communicate via many channels, agent needs to be accessible | — Pending |
| Internal ops first | Simpler security model, agencies control agent directly | — Pending |

---
*Last updated: 2026-01-20 after initialization*
