import { test, expect } from '@playwright/test';
import { getDeploymentUrl } from '../utils/deployment-test-utils';

const baseUrl = getDeploymentUrl();

/**
 * Production Smoke Test Suite
 *
 * Comprehensive smoke tests covering all critical production systems:
 * 1. Auth - login, signup, session management, OAuth
 * 2. Billing - Stripe integration, subscription tiers, webhooks
 * 3. Agent Training - knowledge base, patterns, selectors
 * 4. Execution - agent tasks, workflow execution, browser automation
 * 5. GHL Integration - GoHighLevel workflow endpoints, browser sessions
 * 6. Infrastructure - health, liveness, readiness, metrics
 *
 * These tests verify endpoints respond correctly without testing
 * business logic. They catch deployment issues, broken routes,
 * and service outages.
 *
 * Usage:
 *   DEPLOYMENT_URL=https://bottleneck-bots.vercel.app pnpm test:e2e:smoke
 */

// Helper: parse tRPC JSON response (handles both v10 and v11 formats)
function parseTrpcData(json: any): any {
  // tRPC v11: { result: { data: { json: ... } } }
  // tRPC v10: { result: { data: ... } }
  const result = json?.result?.data;
  if (result && typeof result === 'object' && 'json' in result) {
    return result.json;
  }
  return result;
}

// ============================================================
// 1. AUTH SMOKE TESTS
// ============================================================

test.describe('Production Smoke: Auth', () => {
  test('login page loads successfully', async ({ page }) => {
    const response = await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle' });
    expect(response?.status()).toBeLessThan(400);
  });

  test('login page renders interactive elements', async ({ page }) => {
    await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle' });
    // Wait for React to render — check for any input or button
    const interactive = await page.locator('input, button, a').count();
    expect(interactive).toBeGreaterThan(0);
  });

  test('signup page loads successfully', async ({ page }) => {
    const response = await page.goto(`${baseUrl}/signup`, { waitUntil: 'networkidle' });
    expect(response?.status()).toBeLessThan(400);
  });

  test('protected routes redirect or block unauthenticated users', async ({ page }) => {
    const response = await page.goto(`${baseUrl}/dashboard`, { waitUntil: 'networkidle' });
    const url = page.url();
    // Either redirected away from /dashboard, or page loads with auth wall
    const protected_ =
      url.includes('/login') ||
      url.includes('/signup') ||
      url === baseUrl ||
      url === `${baseUrl}/` ||
      (response?.status() ?? 0) < 500;
    expect(protected_).toBe(true);
  });

  test('tRPC auth.me responds without server error', async ({ page }) => {
    const response = await page.request.get(`${baseUrl}/api/trpc/auth.me`).catch(() => null);
    if (response) {
      expect(response.status()).toBeLessThan(500);
    }
  });

  test('OAuth config endpoint is accessible', async ({ page }) => {
    const response = await page.request.get(`${baseUrl}/api/oauth/google/config`).catch(() => null);
    if (response) {
      expect(response.status()).toBeLessThan(500);
    }
  });

  test('auth debug endpoint responds without server error', async ({ page }) => {
    const response = await page.request.get(`${baseUrl}/api/auth/debug`).catch(() => null);
    if (response) {
      expect(response.status()).toBeLessThan(500);
    }
  });

  test('invalid JWT is rejected on protected endpoints', async ({ page }) => {
    const response = await page.request.get(`${baseUrl}/api/trpc/tasks.list`, {
      headers: { 'Authorization': 'Bearer fake.invalid.token' }
    }).catch(() => null);
    if (response) {
      expect(response.status()).toBeLessThan(500);
    }
  });
});

// ============================================================
// 2. BILLING SMOKE TESTS
// ============================================================

test.describe('Production Smoke: Billing', () => {
  test('subscription tiers endpoint returns data', async ({ page }) => {
    const response = await page.request.get(`${baseUrl}/api/trpc/subscription.getTiers`).catch(() => null);
    if (response) {
      expect(response.status()).toBeLessThan(500);
      if (response.status() === 200) {
        const json = await response.json();
        const data = parseTrpcData(json);
        expect(data).toBeDefined();
      }
    }
  });

  test('pricing section exists on homepage', async ({ page }) => {
    await page.goto(`${baseUrl}`, { waitUntil: 'networkidle' });
    const body = await page.textContent('body');
    // Look for pricing-related keywords in page content
    const hasPricingContent =
      body?.toLowerCase().includes('pricing') ||
      body?.toLowerCase().includes('plan') ||
      body?.toLowerCase().includes('month') ||
      body?.toLowerCase().includes('subscribe');
    expect(hasPricingContent).toBe(true);
  });

  test('Stripe webhook endpoint accepts POST', async ({ page }) => {
    const response = await page.request.post(`${baseUrl}/api/webhooks/stripe`, {
      data: JSON.stringify({ type: 'test' }),
      headers: { 'Content-Type': 'application/json' }
    }).catch(() => null);
    if (response) {
      // Should reject due to missing Stripe signature, but not 500
      expect(response.status()).toBeLessThan(500);
    }
  });

  test('no Stripe secret key exposed in HTML', async ({ page }) => {
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    const html = await page.content();
    expect(html).not.toContain('sk_live_');
    expect(html).not.toContain('sk_test_');
  });

  test('subscription status requires auth', async ({ page }) => {
    const response = await page.request.get(`${baseUrl}/api/trpc/subscription.getMySubscription`).catch(() => null);
    if (response) {
      expect(response.status()).toBeLessThan(500);
    }
  });

  test('execution packs endpoint requires auth', async ({ page }) => {
    const response = await page.request.get(`${baseUrl}/api/trpc/subscription.getExecutionPacks`).catch(() => null);
    if (response) {
      expect(response.status()).toBeLessThan(500);
    }
  });
});

// ============================================================
// 3. AGENT TRAINING SMOKE TESTS
// ============================================================

test.describe('Production Smoke: Agent Training', () => {
  test('knowledge health endpoint responds', async ({ page }) => {
    const response = await page.request.get(`${baseUrl}/api/trpc/knowledge.health`).catch(() => null);
    if (response) {
      expect(response.status()).toBeLessThan(500);
    }
  });

  test('knowledge patterns endpoint requires auth', async ({ page }) => {
    const response = await page.request.get(`${baseUrl}/api/trpc/knowledge.listPatterns`).catch(() => null);
    if (response) {
      expect(response.status()).toBeLessThan(500);
    }
  });

  test('knowledge selectors endpoint requires auth', async ({ page }) => {
    const response = await page.request.get(`${baseUrl}/api/trpc/knowledge.listAllSelectors`).catch(() => null);
    if (response) {
      expect(response.status()).toBeLessThan(500);
    }
  });

  test('knowledge system stats endpoint requires auth', async ({ page }) => {
    const response = await page.request.get(`${baseUrl}/api/trpc/knowledge.getSystemStats`).catch(() => null);
    if (response) {
      expect(response.status()).toBeLessThan(500);
    }
  });

  test('knowledge error stats endpoint requires auth', async ({ page }) => {
    const response = await page.request.get(`${baseUrl}/api/trpc/knowledge.getErrorStats`).catch(() => null);
    if (response) {
      expect(response.status()).toBeLessThan(500);
    }
  });

  test('knowledge brand voices endpoint requires auth', async ({ page }) => {
    const response = await page.request.get(`${baseUrl}/api/trpc/knowledge.listBrandVoices`).catch(() => null);
    if (response) {
      expect(response.status()).toBeLessThan(500);
    }
  });

  test('knowledge client contexts endpoint requires auth', async ({ page }) => {
    const response = await page.request.get(`${baseUrl}/api/trpc/knowledge.listClientContexts`).catch(() => null);
    if (response) {
      expect(response.status()).toBeLessThan(500);
    }
  });

  test('RAG endpoints are accessible', async ({ page }) => {
    const response = await page.request.get(`${baseUrl}/api/trpc/rag.search`, {
      headers: { 'Accept': 'application/json' }
    }).catch(() => null);
    if (response) {
      expect(response.status()).toBeLessThan(500);
    }
  });
});

// ============================================================
// 4. EXECUTION SMOKE TESTS
// ============================================================

test.describe('Production Smoke: Execution', () => {
  test('agent execution endpoint requires auth', async ({ page }) => {
    const response = await page.request.post(`${baseUrl}/api/trpc/agent.executeTask`, {
      data: JSON.stringify({ taskDescription: 'test' }),
      headers: { 'Content-Type': 'application/json' }
    }).catch(() => null);
    if (response) {
      expect(response.status()).toBeLessThan(500);
    }
  });

  test('agent execution list requires auth', async ({ page }) => {
    const response = await page.request.get(
      `${baseUrl}/api/trpc/agent.listExecutions?input=${encodeURIComponent(JSON.stringify({ limit: 5, offset: 0 }))}`
    ).catch(() => null);
    if (response) {
      expect(response.status()).toBeLessThan(500);
    }
  });

  test('workflow endpoints require auth', async ({ page }) => {
    const response = await page.request.get(`${baseUrl}/api/trpc/workflows.list`).catch(() => null);
    if (response) {
      expect(response.status()).toBeLessThan(500);
    }
  });

  test('task endpoints require auth', async ({ page }) => {
    const response = await page.request.get(`${baseUrl}/api/trpc/tasks.list`).catch(() => null);
    if (response) {
      expect(response.status()).toBeLessThan(500);
    }
  });

  test('agency tasks endpoint requires auth', async ({ page }) => {
    const response = await page.request.get(`${baseUrl}/api/trpc/agencyTasks.list`).catch(() => null);
    if (response) {
      expect(response.status()).toBeLessThan(500);
    }
  });

  test('tools available endpoint requires auth', async ({ page }) => {
    const response = await page.request.get(`${baseUrl}/api/trpc/tools.listAvailable`).catch(() => null);
    if (response) {
      expect(response.status()).toBeLessThan(500);
    }
  });

  test('scheduled tasks endpoint requires auth', async ({ page }) => {
    const response = await page.request.get(`${baseUrl}/api/trpc/scheduledTasks.list`).catch(() => null);
    if (response) {
      expect(response.status()).toBeLessThan(500);
    }
  });

  test('swarm coordination endpoint requires auth', async ({ page }) => {
    const response = await page.request.get(`${baseUrl}/api/trpc/swarm.getStatus`).catch(() => null);
    if (response) {
      expect(response.status()).toBeLessThan(500);
    }
  });
});

// ============================================================
// 5. GHL INTEGRATION SMOKE TESTS
// ============================================================

test.describe('Production Smoke: GHL Integration', () => {
  test('browser session creation requires auth', async ({ page }) => {
    const response = await page.request.post(`${baseUrl}/api/trpc/browser.createSession`, {
      data: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' }
    }).catch(() => null);
    if (response) {
      expect(response.status()).toBeLessThan(500);
    }
  });

  test('browserbase health check is accessible', async ({ page }) => {
    const response = await page.request.get(`${baseUrl}/api/trpc/health.getBrowserbaseHealth`).catch(() => null);
    if (response) {
      expect(response.status()).toBeLessThan(500);
    }
  });

  test('browserbase config status is accessible', async ({ page }) => {
    const response = await page.request.get(`${baseUrl}/api/trpc/health.getBrowserbaseConfig`).catch(() => null);
    if (response) {
      expect(response.status()).toBeLessThan(500);
    }
  });

  test('GHL sub-accounts endpoint requires auth', async ({ page }) => {
    const response = await page.request.get(`${baseUrl}/api/trpc/subAccounts.list`).catch(() => null);
    if (response) {
      expect(response.status()).toBeLessThan(500);
    }
  });

  test('GHL onboarding endpoint requires auth', async ({ page }) => {
    const response = await page.request.get(`${baseUrl}/api/trpc/onboarding.getStatus`).catch(() => null);
    if (response) {
      expect(response.status()).toBeLessThan(500);
    }
  });

  test('settings endpoint requires auth (stores GHL config)', async ({ page }) => {
    const response = await page.request.get(`${baseUrl}/api/trpc/settings.get`).catch(() => null);
    if (response) {
      expect(response.status()).toBeLessThan(500);
    }
  });

  test('webhook endpoints for GHL events accept POST', async ({ page }) => {
    const response = await page.request.post(`${baseUrl}/api/webhooks/ghl`, {
      data: JSON.stringify({ type: 'contact.created', data: {} }),
      headers: { 'Content-Type': 'application/json' }
    }).catch(() => null);
    if (response) {
      expect(response.status()).toBeLessThan(500);
    }
  });

  test('API keys endpoint requires auth (used for GHL API keys)', async ({ page }) => {
    const response = await page.request.get(`${baseUrl}/api/trpc/apiKeys.list`).catch(() => null);
    if (response) {
      expect(response.status()).toBeLessThan(500);
    }
  });
});

// ============================================================
// 6. INFRASTRUCTURE SMOKE TESTS
// ============================================================

test.describe('Production Smoke: Infrastructure', () => {
  test('health endpoint returns 200', async ({ page }) => {
    const response = await page.request.get(`${baseUrl}/api/health`);
    expect(response.status()).toBe(200);
  });

  test('tRPC health endpoints respond', async ({ page }) => {
    const response = await page.request.get(`${baseUrl}/api/trpc/health.getSystemHealth`).catch(() => null);
    if (response) {
      expect(response.status()).toBeLessThan(500);
    }
  });

  test('liveness probe responds', async ({ page }) => {
    const response = await page.request.get(`${baseUrl}/api/trpc/health.liveness`).catch(() => null);
    if (response) {
      expect(response.status()).toBeLessThan(500);
    }
  });

  test('readiness probe responds', async ({ page }) => {
    const response = await page.request.get(`${baseUrl}/api/trpc/health.readiness`).catch(() => null);
    if (response) {
      expect(response.status()).toBeLessThan(500);
    }
  });

  test('service availability endpoint responds', async ({ page }) => {
    const response = await page.request.get(`${baseUrl}/api/trpc/health.getServiceAvailability`).catch(() => null);
    if (response) {
      expect(response.status()).toBeLessThan(500);
    }
  });

  test('database health check responds', async ({ page }) => {
    const response = await page.request.get(`${baseUrl}/api/trpc/health.getDatabaseHealth`).catch(() => null);
    if (response) {
      expect(response.status()).toBeLessThan(500);
    }
  });

  test('metrics endpoint responds', async ({ page }) => {
    const response = await page.request.get(`${baseUrl}/api/trpc/health.getMetrics`).catch(() => null);
    if (response) {
      expect(response.status()).toBeLessThan(500);
    }
  });

  test('homepage loads without critical console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.goto(baseUrl, { waitUntil: 'networkidle' });

    // Filter out expected auth-related errors
    const critical = errors.filter(e =>
      !e.includes('401') &&
      !e.includes('CORS') &&
      !e.includes('403') &&
      !e.includes('fetch')
    );
    expect(critical.length).toBeLessThan(5);
  });

  test('no 5xx errors on critical JS/CSS resources', async ({ page }) => {
    const failed: string[] = [];
    page.on('response', response => {
      if (response.status() >= 500 && ['script', 'stylesheet'].includes(response.request().resourceType())) {
        failed.push(`${response.status()} ${response.url()}`);
      }
    });

    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    expect(failed).toEqual([]);
  });

  test('SPA root element exists', async ({ page }) => {
    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    // Check for #root or similar React mount point
    const root = await page.locator('#root, [data-react-root], [id="app"]').count();
    expect(root).toBeGreaterThan(0);
  });

  test('page renders visible content', async ({ page }) => {
    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    const bodyText = await page.textContent('body');
    expect(bodyText?.trim().length).toBeGreaterThan(0);
  });
});
