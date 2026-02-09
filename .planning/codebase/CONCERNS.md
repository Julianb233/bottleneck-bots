# Codebase Concerns

**Analysis Date:** 2026-01-16

## Tech Debt

**Excessive console.log usage (1,790+ instances):**
- Issue: Debug logging via console.log throughout codebase instead of structured logging
- Files: Throughout `server/` directory, especially `server/db.ts`, `server/services/`
- Why: Rapid development, incremental addition without cleanup
- Impact: Sensitive info may be logged, performance overhead, noisy logs
- Fix approach: Migrate to Pino logger (`server/lib/logger.ts`) for structured logging

**Large monolithic files:**
- Issue: Several files exceed 1,000+ lines with complex logic
- Files:
  - `server/api/routers/browser.ts` (2,856 lines)
  - `server/services/agentOrchestrator.service.ts` (2,024 lines)
  - `server/api/routers/settings.ts` (1,853 lines)
  - `client/src/pages/ScheduledTasks.tsx` (1,459 lines)
  - `client/src/components/Dashboard.tsx` (1,173 lines)
- Why: Features grew organically without refactoring
- Impact: Hard to maintain, test, and understand
- Fix approach: Extract into smaller, focused modules

**484 'any' type usages:**
- Issue: Excessive use of `any` type reduces TypeScript safety
- Files: Throughout `server/` directory
- Why: Quick fixes, external API responses, complex types
- Impact: Type errors not caught at compile time, runtime errors possible
- Fix approach: Gradually replace with proper types, use `unknown` where appropriate

## Known Bugs

**Race condition in subscription updates:**
- Symptoms: User shows incorrect tier for 5-10 seconds after payment
- Trigger: Fast navigation after Stripe checkout, before webhook processes
- Files: `server/api/webhooks/stripe.ts`
- Workaround: Webhook eventually updates status (self-heals)
- Root cause: Webhook processing slower than user navigation
- Fix: Add polling or optimistic UI update after checkout

## Security Considerations

**Unverified user ownership in deployment router:**
- Risk: Users may deploy, rollback, or manage other users' projects
- Files: `server/api/routers/deployment.ts` (lines 96, 132, 229, 281, 327, 373, 422)
- Current mitigation: None - TODO comments indicate missing checks
- Recommendations: Add user ownership validation to all deployment operations

**Incomplete email authentication:**
- Risk: Password reset link generation not implemented for production
- Files: `server/_core/email-auth.ts:223`
- Current mitigation: Returns reset link only in development mode
- Recommendations: Implement email sending for password reset flow

**Admin role check client-side only:**
- Risk: Admin pages check isAdmin from client, no server verification
- Files: Client admin components
- Current mitigation: UI hiding only
- Recommendations: Add server-side role verification middleware

## Performance Bottlenecks

**N+1 query potential in credit service:**
- Problem: Loop loading credit types individually
- Files: `server/services/credit.service.ts:50-56`
- Measurement: Not profiled
- Cause: Sequential queries instead of batch
- Improvement path: Batch load in single query

**Large client bundles:**
- Problem: Multiple large page components
- Files: `client/src/pages/ScheduledTasks.tsx` (1,459 lines), `client/src/pages/Settings.tsx` (1,295 lines)
- Improvement path: Code splitting, lazy loading

## Fragile Areas

**Agent orchestrator service:**
- Files: `server/services/agentOrchestrator.service.ts` (2,024 lines)
- Why fragile: Monolithic with many responsibilities
- Common failures: State management complexity, error handling paths
- Safe modification: Add comprehensive tests before changes
- Test coverage: Marked as TODO - unit tests missing

**Stripe webhook handling:**
- Files: `server/api/webhooks/stripe.ts`
- Why fragile: Multiple event types with shared transaction logic
- Common failures: New events not handled, partial DB updates
- Safe modification: Extract each event handler to separate file
- Test coverage: Limited

## Missing Critical Features

**Permission validation queries not implemented:**
- Problem: Current active executions and monthly usage use hardcoded zeros
- Files: `server/services/agentPermissions.service.ts:371-372`
- Current workaround: Limits cannot be enforced
- Blocks: Subscription tier limits not enforced
- Implementation complexity: Low - need to query taskExecutions table

**Platform detection service stub:**
- Problem: Entire service returns empty results
- Files: `server/services/platformDetection.service.ts:5-101`
- Current workaround: Platform detection non-functional
- Blocks: GoHighLevel, WordPress, Cloudflare detection
- Implementation complexity: Medium

**Message delivery not implemented:**
- Problem: Outbound messages marked "sent" without actual delivery
- Files: `server/services/webhookReceiver.service.ts:551`
- Current workaround: None - messages not delivered
- Blocks: Webhook message automation
- Implementation complexity: Medium

**Credit management stub:**
- Problem: Credit tracking logic not implemented
- Files: `server/services/credit.service.ts:5`
- Current workaround: Credit features don't work
- Blocks: Usage-based billing, enrichment credits
- Implementation complexity: Medium

**Memory browser features disabled:**
- Problem: Top patterns and similar patterns queries commented out
- Files: `client/src/components/memory/MemoryBrowser.tsx:62, 526`
- Current workaround: Memory browser features disabled
- Blocks: Pattern analysis UI
- Implementation complexity: Low - backend needs implementation

**Onboarding OAuth flow:**
- Problem: OAuth integration in onboarding not implemented
- Files: `client/src/components/onboarding/IntegrationsStep.tsx:89`
- Current workaround: Manual integration setup
- Blocks: Smooth onboarding experience
- Implementation complexity: Medium

**Email and Slack notifications:**
- Problem: Scheduler sends placeholder notifications
- Files: `server/services/schedulerRunner.service.ts:562, 582`
- Current workaround: No notifications sent
- Blocks: User notification for scheduled tasks
- Implementation complexity: Low

**Cost threshold alerts:**
- Problem: Alert notifications not implemented
- Files: `server/services/costTracking.service.ts:910`
- Current workaround: Users not notified of cost overruns
- Blocks: Budget management
- Implementation complexity: Low

## Test Coverage Gaps

**Agent orchestrator unit tests:**
- What's not tested: Main agent service logic
- Files: `server/services/agentOrchestrator.service.ts`
- Risk: Core agent functionality could break unnoticed
- Priority: High
- Difficulty to test: Complex state machine, many dependencies

**Payment flow end-to-end:**
- What's not tested: Full Stripe checkout → webhook → subscription flow
- Risk: Payment processing could break silently
- Priority: High
- Difficulty to test: Need Stripe test fixtures, webhook simulation

**Deployment operations:**
- What's not tested: Deploy, rollback, domain management
- Files: `server/api/routers/deployment.ts`
- Risk: Deployment features untested
- Priority: Medium
- Difficulty to test: External service interactions

## Dependencies at Risk

**rrweb (2.0.0-alpha.4):**
- Risk: Alpha version, potential breaking changes
- Impact: Session replay functionality
- Migration plan: Monitor for stable release

## Summary

| Category | Count | Severity |
|----------|-------|----------|
| Security Issues | 4 | CRITICAL |
| Missing Implementations | 9 | HIGH |
| Tech Debt Items | 3 | MEDIUM |
| Test Coverage Gaps | 3 | MEDIUM |
| Performance Concerns | 2 | MEDIUM |
| **TOTAL** | **21** | — |

## Recommended Actions (Priority Order)

1. **IMMEDIATE**: Add user ownership validation to deployment operations (`server/api/routers/deployment.ts`)
2. **IMMEDIATE**: Implement email password reset for production (`server/_core/email-auth.ts`)
3. **HIGH**: Implement permission validation queries (`server/services/agentPermissions.service.ts`)
4. **HIGH**: Implement message delivery in webhook service (`server/services/webhookReceiver.service.ts`)
5. **HIGH**: Add unit tests for agent orchestrator service
6. **MEDIUM**: Migrate console.log to structured Pino logging
7. **MEDIUM**: Refactor large files into smaller modules
8. **MEDIUM**: Replace `any` types with proper TypeScript types

---

*Concerns audit: 2026-01-16*
*Update as issues are fixed or new ones discovered*
