# Bottleneck Bots -- Launch Week Sprint

**Sprint**: 2026-03-16 (Mon) through 2026-03-20 (Fri)
**Goal**: Ship a production-ready AI agent platform for GHL agencies
**Mode**: YOLO -- parallel execution, no gate confirmations

---

## Day 1 (Mon 3/16): Deploy + Critical Fixes

Get the app live on Vercel and ensure core flows work end-to-end.

### Plan 1-1: Vercel Deployment

**Goal**: App running on Vercel with all env vars configured

**Tasks**:
1. Create Vercel project (`bottleneck-bots`) linked to `Julianb233/Bottleneck-Bots` repo
2. Configure all environment variables:
   - `DATABASE_URL` (Supabase PostgreSQL connection string)
   - `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY`
   - `ANTHROPIC_API_KEY`, `GOOGLE_GEMINI_API_KEY`, `OPENAI_API_KEY`
   - `BROWSERBASE_API_KEY`, `BROWSERBASE_PROJECT_ID`
   - `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PUBLISHABLE_KEY`
   - `JWT_SECRET`, `SESSION_SECRET`
   - `SENTRY_DSN` (server + client)
   - `REDIS_URL` (for BullMQ -- or disable workers for initial deploy)
   - `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `S3_BUCKET`, `CLOUDFRONT_DOMAIN`
   - `VAPI_API_KEY` (voice calling)
3. Run `pnpm build` locally to verify clean build
4. Push to main and trigger Vercel deployment
5. Verify the deployment URL loads (no white screen, no 500s)
6. Configure custom domain if available

**Verify**: App loads at Vercel URL, no console errors, API health endpoint returns 200

### Plan 1-2: Auth Flow End-to-End

**Goal**: Users can sign up, log in, and access the dashboard

**Tasks**:
1. Test email-based signup flow (create account, verify, log in)
2. Test Google OAuth login flow
3. Verify JWT token issuance and refresh
4. Verify protected routes redirect to login when unauthenticated
5. Fix any auth bugs found during testing (token expiry, redirect loops, etc.)
6. Ensure password reset flow works

**Verify**: New user can sign up, log in, reach dashboard, log out, log back in

### Plan 1-3: Stripe Billing End-to-End

**Goal**: Users can subscribe and the credit system works

**Tasks**:
1. Verify Stripe webhook endpoint is reachable at `/api/webhooks/stripe`
2. Configure Stripe webhook in Stripe dashboard pointing to production URL
3. Test subscription creation flow (select plan, enter card, activate)
4. Verify credit allocation on subscription activation
5. Test credit deduction during agent task execution
6. Verify subscription management (upgrade, downgrade, cancel)

**Verify**: User can subscribe, credits appear, agent execution deducts credits

### Plan 1-4: Critical UX Bug Sweep

**Goal**: No show-stopping UI bugs on core pages

**Tasks**:
1. Navigate through all core pages: Home, Login, Signup, Dashboard, Agent Dashboard, Task Board, Workflow Builder, Training, Settings, Browser Sessions
2. Check for broken imports, missing components, white screens
3. Fix any Tailwind 4 / React 19 compatibility issues
4. Verify mobile responsiveness on key pages (Login, Dashboard, Agent Dashboard)
5. Ensure navigation/sidebar works correctly with Wouter routing

**Verify**: All core pages render without errors, navigation works, no console errors

---

## Day 2 (Tue 3/17): Agent Training UX

Build the interface for agencies to train agents on their specific workflows.

### Plan 2-1: Agent Training Interface Enhancement

**Goal**: Users can configure agent training for agency-specific tasks

**Tasks**:
1. Enhance existing `Training.tsx` page with tabbed interface:
   - **Documents**: Upload SOPs, process docs, training materials (existing functionality)
   - **Workflows**: Define step-by-step workflow training for agents
   - **Skills**: Enable/disable agent capabilities (GHL, email, SMS, etc.)
   - **Behavior**: Configure agent personality, response style, escalation rules
2. Add workflow training form:
   - Workflow name and description
   - Step-by-step instructions (ordered list with actions)
   - Expected inputs/outputs per step
   - Platform target (GHL, email, etc.)
3. Wire to existing `knowledge.service.ts` and `rag.service.ts` for document processing
4. Add tRPC mutations for saving workflow training configs

**Verify**: User can upload docs, define workflow training, save and retrieve configs

### Plan 2-2: RAG Document Training for Agency SOPs

**Goal**: Uploaded documents are processed into searchable knowledge for agents

**Tasks**:
1. Verify existing RAG pipeline works end-to-end:
   - Upload document via Training page
   - Document is parsed (`document-parser.service.ts`)
   - Chunks are embedded and stored in vector DB
   - Agent can query knowledge during task execution
2. Add SOP-specific processing:
   - Extract step sequences from SOP documents
   - Tag knowledge chunks with category (SOP, process, policy, reference)
   - Priority ranking for agent retrieval
3. Add knowledge base browser:
   - List all uploaded documents with status (processing, ready, error)
   - Preview extracted chunks
   - Delete/re-process documents
4. Connect to agent orchestrator so agents reference training data during execution

**Verify**: Upload a PDF SOP, see it processed, agent references it in task execution

### Plan 2-3: Task Template System

**Goal**: Pre-built templates for common agency tasks users can assign to agents

**Tasks**:
1. Create task template schema (extend existing `templates.ts` router):
   - Template name, description, category
   - Required inputs (form fields)
   - Steps with action types (browser, API, email, etc.)
   - Platform requirements (GHL account needed, etc.)
   - Estimated duration and credit cost
2. Seed initial templates:
   - **GHL: Add contact to pipeline** -- create contact, add to pipeline stage
   - **GHL: Launch email campaign** -- select contacts, create campaign, send
   - **GHL: Create workflow** -- build automation workflow in GHL
   - **GHL: Update contact tags** -- bulk tag contacts by criteria
   - **GHL: Export pipeline report** -- pull pipeline data, generate CSV
   - **Lead enrichment** -- research company, find decision makers
   - **Competitor analysis** -- browse competitor sites, compile report
   - **Content creation** -- write blog post, social posts from brief
3. Build template browser UI:
   - Grid/list view of templates by category
   - Template detail modal with inputs form
   - "Run from template" button that creates a task with pre-filled config
4. Add template marketplace foundation (for future community templates)

**Verify**: User can browse templates, select one, fill in inputs, and create a task from it

### Plan 2-4: Agent Skill Configuration

**Goal**: Users can enable/disable agent capabilities and set permissions

**Tasks**:
1. Build agent skills configuration page (under Agent Dashboard or Settings):
   - Toggle skills on/off: Browser automation, GHL API, Email, SMS, Voice, File creation
   - Set per-skill permissions (read-only vs. read-write)
   - Configure rate limits per skill
2. Wire skill config to agent permissions system (`agentPermissions.service.ts`)
3. Agent orchestrator checks skill config before executing actions
4. Add skill usage analytics (which skills are used most, success rates)

**Verify**: Disable a skill, attempt task requiring it, agent correctly refuses or uses alternative

---

## Day 3 (Wed 3/18): GHL Automation Functions

Implement the 48 GHL automation functions from PRD-038.

### Plan 3-1: GHL OAuth + Core Service Layer

**Goal**: GHL OAuth flow works, base service handles auth and rate limiting

**Tasks**:
1. Create `server/services/ghl.service.ts`:
   - OAuth 2.0 authorization code flow with PKCE
   - Token storage with AES-256 encryption (use existing `credentialVault.service.ts`)
   - Automatic token refresh (5 min before expiry)
   - Rate limiter (respect GHL API limits)
   - Multi-location support (agency-level + location-level tokens)
   - Base HTTP client with retry and error handling
2. Create GHL OAuth routes:
   - `GET /api/ghl/oauth/authorize` -- initiate OAuth flow
   - `GET /api/ghl/oauth/callback` -- handle callback, store tokens
   - `POST /api/ghl/oauth/revoke` -- revoke access
3. Create tRPC router `server/api/routers/ghl.ts`:
   - `ghl.connect` -- initiate OAuth
   - `ghl.disconnect` -- revoke tokens
   - `ghl.status` -- connection health check
   - `ghl.listLocations` -- list authorized locations
4. Add GHL connection UI in Settings page:
   - Connect/disconnect button
   - Location selector
   - Connection status indicator

**Verify**: User can connect GHL account via OAuth, tokens stored, API calls succeed

### Plan 3-2: Contact Management Functions (FR-007 through FR-014)

**Goal**: Full CRUD + bulk operations for GHL contacts

**Tasks**:
1. Implement in `ghl.service.ts`:
   - `contacts.create(locationId, data)` -- Create contact
   - `contacts.get(locationId, contactId)` -- Get contact by ID
   - `contacts.update(locationId, contactId, data)` -- Update contact
   - `contacts.delete(locationId, contactId)` -- Delete contact
   - `contacts.search(locationId, query, filters)` -- Search contacts
   - `contacts.bulkImport(locationId, contacts[])` -- Bulk import (up to 50K)
   - `contacts.bulkExport(locationId, filters)` -- Export to CSV
   - `contacts.addTag(locationId, contactId, tag)` -- Add tag
   - `contacts.removeTag(locationId, contactId, tag)` -- Remove tag
   - `contacts.listTags(locationId)` -- List all tags
   - `contacts.getCustomFields(locationId)` -- List custom fields
   - `contacts.updateCustomField(locationId, contactId, field, value)` -- Update custom field
   - `contacts.getActivity(locationId, contactId)` -- Activity timeline
   - `contacts.merge(locationId, primaryId, duplicateIds[])` -- Merge duplicates
2. Add tRPC procedures for each function
3. Add contact management UI elements (can be minimal -- focus on API layer)

**Verify**: CRUD operations work against GHL sandbox, bulk import processes 100+ contacts

### Plan 3-3: Pipeline + Campaign + Workflow Functions (FR-015 through FR-039)

**Goal**: Pipeline automation, campaign operations, and workflow triggers

**Tasks**:
1. Pipeline operations in `ghl.service.ts`:
   - `pipelines.list(locationId)` -- List pipelines and stages
   - `opportunities.create(locationId, data)` -- Create opportunity
   - `opportunities.get(locationId, opportunityId)` -- Get opportunity
   - `opportunities.update(locationId, opportunityId, data)` -- Update opportunity
   - `opportunities.delete(locationId, opportunityId)` -- Delete opportunity
   - `opportunities.moveStage(locationId, opportunityId, stageId)` -- Move stage
   - `opportunities.assign(locationId, opportunityId, userId)` -- Assign to user
2. Campaign operations:
   - `campaigns.list(locationId)` -- List campaigns
   - `campaigns.addContact(locationId, campaignId, contactId)` -- Add contact
   - `campaigns.removeContact(locationId, campaignId, contactId)` -- Remove contact
   - `campaigns.pause(locationId, campaignId, contactId)` -- Pause for contact
   - `campaigns.getStats(locationId, campaignId)` -- Campaign metrics
   - `campaigns.create(locationId, data)` -- Create campaign
3. Workflow triggers:
   - `workflows.list(locationId)` -- List workflows
   - `workflows.trigger(locationId, workflowId, data)` -- Trigger workflow
   - `workflows.getStatus(locationId, executionId)` -- Execution status
4. Communication:
   - `messages.sendSMS(locationId, contactId, message)` -- Send SMS
   - `messages.sendEmail(locationId, contactId, templateId, data)` -- Send email
   - `messages.getStatus(locationId, messageId)` -- Delivery status
   - `templates.list(locationId)` -- List email/SMS templates

**Verify**: Can create opportunity, move through pipeline, add contact to campaign, trigger workflow

### Plan 3-4: GHL Webhook Processing + Appointment Management (FR-020 through FR-043)

**Goal**: Real-time event processing from GHL + appointment CRUD

**Tasks**:
1. GHL webhook endpoint:
   - `POST /api/webhooks/ghl` -- receive all GHL events
   - HMAC signature verification
   - Event type routing (contact.created, opportunity.updated, appointment.booked, etc.)
   - Dead letter queue for failed events (store in DB)
   - Deduplication by event ID
2. Event handlers:
   - Contact events -> sync to local DB, trigger workflows
   - Opportunity events -> update pipeline state, notify
   - Appointment events -> calendar sync, trigger reminders
   - Form submission events -> create contacts, trigger workflows
3. Appointment management:
   - `appointments.create(locationId, data)` -- Create appointment
   - `appointments.get(locationId, appointmentId)` -- Get appointment
   - `appointments.update(locationId, appointmentId, data)` -- Update
   - `appointments.delete(locationId, appointmentId)` -- Cancel
   - `appointments.getAvailability(locationId, calendarId, date)` -- Check availability
4. Wire webhook events to existing workflow engine for automated responses

**Verify**: GHL webhook fires, event processed, contact/opportunity updated, appointment CRUD works

### Plan 3-5: GHL Integration Testing with Sandbox

**Goal**: All 48 functions tested against real GHL sandbox

**Tasks**:
1. Set up GHL sandbox account (or use existing dev account)
2. Write integration tests for each function category:
   - Auth: connect, refresh, revoke
   - Contacts: CRUD, search, tags, custom fields, bulk
   - Pipelines: list, opportunity CRUD, stage moves
   - Campaigns: list, add/remove contacts, stats
   - Workflows: list, trigger, status
   - Webhooks: receive, process, route
   - Appointments: CRUD, availability
   - Messages: SMS, email, status
3. Create test data cleanup scripts
4. Document any GHL API quirks or rate limit findings

**Verify**: All integration tests pass against GHL sandbox, documented in test report

---

## Day 4 (Thu 3/19): Agent Execution Polish

Make agent execution robust, observable, and reliable.

### Plan 4-1: Agent Execution with Live Browser Preview

**Goal**: Users see real-time browser activity during agent task execution

**Tasks**:
1. Enhance BrowserBase session streaming:
   - SSE stream of browser screenshots/state during execution
   - Connect to existing `Browser Sessions` page (`BrowserSessions.tsx`)
   - Show current URL, page title, and action being performed
   - Live screenshot updates (1-2 fps via BrowserBase debug URL)
2. Add execution detail panel:
   - Current step in task plan
   - Action log (clicked X, typed Y, navigated to Z)
   - LLM reasoning visible (what the agent is thinking)
   - Elapsed time and estimated remaining
3. Add pause/resume/cancel controls during execution
4. Wire to existing `agentProgressTracker.service.ts`

**Verify**: Start agent task, see live browser preview with action log, pause and resume

### Plan 4-2: Execution History + Replay

**Goal**: Users can review past task executions and replay recordings

**Tasks**:
1. Build execution history page:
   - List all past executions with status (success, failed, cancelled)
   - Filter by agent, date, task type, status
   - Execution summary: duration, steps completed, credits used
2. Execution detail view:
   - Step-by-step timeline of actions taken
   - Screenshots at key moments
   - LLM reasoning for each decision
   - Error details for failed steps
3. BrowserBase session replay integration:
   - Link to BrowserBase replay URL for full session recording
   - Embedded replay player using rrweb (already in dependencies)
4. Export execution report (PDF via `pdf-report.service.ts`)

**Verify**: View past execution, see step-by-step timeline, replay browser recording

### Plan 4-3: Error Handling + Retry Logic

**Goal**: Agent execution handles failures gracefully with automatic retry

**Tasks**:
1. Enhance `agentOrchestrator.service.ts` error handling:
   - Categorize errors: recoverable (timeout, rate limit, element not found) vs. fatal (auth failure, invalid task)
   - Automatic retry for recoverable errors (max 3 attempts with backoff)
   - Screenshot on error for debugging
   - Graceful degradation (fall back to API if browser fails)
2. Leverage existing `failureRecovery.service.ts` and `strategyAdaptation.service.ts`:
   - Integrate failure recovery into main agent loop
   - Strategy adaptation: if approach A fails, try approach B
3. User-facing error reporting:
   - Clear error messages (not raw stack traces)
   - Suggested actions for common errors
   - "Retry" button on failed executions
4. Alert system for repeated failures (integrate with existing `alerts.ts` router)

**Verify**: Agent hits an error, retries automatically, reports clearly if ultimately fails

### Plan 4-4: Cron/Scheduled Agent Tasks

**Goal**: Users can schedule recurring agent tasks

**Tasks**:
1. Enhance existing `ScheduledTasks.tsx` page and `scheduledTasks.ts` router:
   - Cron expression builder UI (human-friendly, not raw cron syntax)
   - Schedule from task template or custom task
   - Preview next 5 execution times
   - Enable/disable schedule toggle
2. Wire to existing `cronScheduler.service.ts`:
   - Verify cron job execution with BullMQ
   - Handle missed executions (run immediately on startup if missed)
   - Execution history per scheduled task
3. Schedule management:
   - List all schedules with next run time
   - Edit schedule without losing history
   - Delete schedule with confirmation
4. Notifications on scheduled task completion/failure

**Verify**: Create hourly schedule, see it execute, view history, disable/re-enable

---

## Day 5 (Fri 3/20): UX Polish + Launch

Final quality pass and public launch.

### Plan 5-1: Full UX Audit with Stagehand Browser Testing

**Goal**: Every page and flow tested visually, all HIGH issues fixed

**Tasks**:
1. Use Stagehand (Browserbase) to crawl every page:
   - Login, Signup, Forgot Password, Reset Password
   - Dashboard Home, Agent Dashboard, Task Board
   - Workflow Builder, Training, Browser Sessions
   - Scheduled Tasks, Settings, Admin pages
   - Lead Lists, Lead Upload, Lead Details
   - Campaigns, Quizzes, Features
   - Credit Purchase, Privacy Policy, Terms of Service
2. For each page check:
   - Renders without errors (no white screen, no missing components)
   - Responsive design (desktop + mobile viewport)
   - Interactive elements work (buttons, forms, dropdowns)
   - Data loads correctly (no infinite spinners)
   - Navigation links work
3. Categorize issues as HIGH (blocks usage), MEDIUM (annoying), LOW (cosmetic)
4. Fix all HIGH issues immediately

**Verify**: Full audit report generated, zero HIGH issues remaining

### Plan 5-2: Landing Page Polish

**Goal**: Home page converts visitors to sign-ups

**Tasks**:
1. Review and enhance `Home.tsx`:
   - Hero section with clear value proposition: "AI Agents for Your Agency"
   - Feature highlights (GHL automation, browser agents, task templates)
   - Social proof section (testimonials or stats)
   - Pricing section or link to pricing page
   - CTA buttons throughout (Sign Up, Start Free Trial)
2. Ensure `Features.tsx` page is comprehensive:
   - Feature cards with icons for each capability
   - Comparison table (vs. manual, vs. competitors)
   - Technical specs for the technically curious
3. SEO basics:
   - Page titles and meta descriptions
   - Open Graph tags for social sharing
   - Structured data (JSON-LD for SaaS product)
4. Performance check:
   - Lighthouse score > 80 on performance
   - No layout shift, fast LCP
   - Images optimized

**Verify**: Landing page looks professional, loads fast, CTAs work, OG tags render

### Plan 5-3: Documentation + Quickstart Guide

**Goal**: New users can get started without hand-holding

**Tasks**:
1. In-app onboarding flow:
   - First-login wizard: connect GHL -> upload first SOP -> run first task
   - Tooltip tour of dashboard
   - Empty state messages with CTAs on each page
2. Help/docs content (can be in-app or linked):
   - Getting Started guide (3-5 steps)
   - How to connect GoHighLevel
   - How to create your first agent task
   - How to use task templates
   - How to train your agent with SOPs
3. API documentation (if exposing public API):
   - Swagger/OpenAPI spec from tRPC routes
   - Example requests/responses

**Verify**: New user can follow quickstart without confusion, reaches "aha moment" in < 5 min

### Plan 5-4: Production Smoke Tests + Launch

**Goal**: Everything works in production, announce launch

**Tasks**:
1. Run full smoke test suite against production:
   - `pnpm test:e2e:smoke` against production URL
   - Manual test: signup -> connect GHL -> create task -> execute -> view result
   - Stripe payment flow test with test card
   - Webhook delivery test (GHL -> production webhook endpoint)
2. Verify monitoring:
   - Sentry is capturing errors (trigger a test error)
   - Vercel analytics is tracking page views
   - API health endpoint is monitored
3. Final checklist:
   - [ ] All env vars set in production
   - [ ] Custom domain configured (if available)
   - [ ] Stripe webhooks pointing to production
   - [ ] GHL OAuth redirect URI updated to production
   - [ ] Sentry release tracking configured
   - [ ] Rate limiting enabled
   - [ ] CORS configured for production domain
4. Launch:
   - Update DNS/domain if needed
   - Post announcement (social, email list, relevant communities)
   - Monitor for first-hour issues

**Verify**: Full end-to-end flow works in production, monitoring captures events, zero critical errors

---

## Summary

| Day | Focus | Plans | Key Deliverable |
|-----|-------|-------|-----------------|
| 1 (Mon) | Deploy + Critical Fixes | 4 plans (parallel) | App live on Vercel, auth + billing working |
| 2 (Tue) | Agent Training UX | 4 plans (parallel) | Training interface, RAG pipeline, task templates |
| 3 (Wed) | GHL Automation | 5 plans (3+4 parallel, 5 after) | 48 GHL functions implemented and tested |
| 4 (Thu) | Execution Polish | 4 plans (parallel) | Live preview, history, retry, cron scheduling |
| 5 (Fri) | UX Polish + Launch | 4 plans (parallel) | Audit complete, landing polished, shipped |

**Total**: 21 plans across 5 days
**Execution**: Plans within each day run in parallel (max 5 concurrent agents)
**Risk buffer**: Day 5 has flex for spillover from earlier days

---

## Existing Assets to Leverage

These already exist in the codebase and should be used, not rebuilt:

| Asset | Location | Use For |
|-------|----------|---------|
| Agent Orchestrator | `server/services/agentOrchestrator.service.ts` | Core agent loop |
| Stagehand Service | `server/services/stagehand.service.ts` | Browser automation |
| BrowserBase Core | `server/_core/browserbase.ts` | Session management |
| RAG Service | `server/services/rag.service.ts` | Document training |
| Knowledge Service | `server/services/knowledge.service.ts` | Knowledge management |
| Document Parser | `server/services/document-parser.service.ts` | SOP parsing |
| Template Router | `server/api/routers/templates.ts` | Task templates |
| Scheduled Tasks | `server/api/routers/scheduledTasks.ts` + `cronScheduler.service.ts` | Cron jobs |
| Credential Vault | `server/services/credentialVault.service.ts` | GHL token storage |
| Webhook Receiver | `server/services/webhookReceiver.service.ts` | GHL webhooks |
| Agent Permissions | `server/services/agentPermissions.service.ts` | Skill gating |
| Failure Recovery | `server/services/intelligence/failureRecovery.service.ts` | Error handling |
| Strategy Adaptation | `server/services/intelligence/strategyAdaptation.service.ts` | Agent fallbacks |
| Progress Tracker | `server/services/agentProgressTracker.service.ts` | Live updates |
| PDF Reports | `server/services/pdf-report.service.ts` | Execution reports |
| Cost Tracking | `server/services/costTracking.service.ts` | Credit deduction |
| Data API | `server/_core/dataApi.ts` | GHL API base layer |
| Training Page | `client/src/pages/Training.tsx` | Document upload UI |
| Browser Sessions | `client/src/pages/BrowserSessions.tsx` | Live preview UI |
| Scheduled Tasks Page | `client/src/pages/ScheduledTasks.tsx` | Cron UI |

---
*Created: 2026-03-16 | Sprint: Mon 3/16 - Fri 3/20*
