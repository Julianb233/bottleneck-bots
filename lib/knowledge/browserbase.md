# Browserbase SDK - Expert Knowledge Base

## Overview
Browserbase provides cloud-hosted browsers for web automation. It handles browser infrastructure, proxies, and anti-detection, letting you focus on automation logic.

## Installation
```bash
npm install @browserbasehq/sdk
```

## Authentication
```typescript
const BROWSERBASE_API_KEY = process.env.BROWSERBASE_API_KEY;
const BROWSERBASE_PROJECT_ID = process.env.BROWSERBASE_PROJECT_ID;
```

## Core Concepts

### Session Management

#### Create Session
```typescript
import Browserbase from "@browserbasehq/sdk";

const browserbase = new Browserbase({
  apiKey: BROWSERBASE_API_KEY,
  projectId: BROWSERBASE_PROJECT_ID,
});

const session = await browserbase.sessions.create({
  projectId: BROWSERBASE_PROJECT_ID,
  browserSettings: {
    viewport: { width: 1920, height: 1080 },
    locale: "en-US",
    timezone: "America/New_York",
  },
});
```

#### Connect to Session
```typescript
import { chromium } from "playwright";

const browser = await chromium.connectOverCDP(session.connectUrl);
const context = browser.contexts()[0];
const page = context.pages()[0];
```

#### List Sessions
```typescript
const sessions = await browserbase.sessions.list({
  status: "RUNNING",
});
```

#### Stop Session
```typescript
await browserbase.sessions.update(sessionId, {
  status: "REQUEST_RELEASE",
});
```

### Browser Settings

```typescript
const session = await browserbase.sessions.create({
  projectId: BROWSERBASE_PROJECT_ID,
  browserSettings: {
    // Viewport size
    viewport: { width: 1920, height: 1080 },

    // Geolocation
    geolocation: {
      latitude: 40.7128,
      longitude: -74.0060,
    },

    // Timezone
    timezone: "America/New_York",

    // Locale
    locale: "en-US",

    // User agent (optional - Browserbase rotates by default)
    userAgent: "Mozilla/5.0...",

    // Proxy configuration
    proxy: {
      type: "RESIDENTIAL",  // or "DATACENTER"
      country: "US",
      state: "CA",
    },
  },

  // Session timeout (max 15 minutes)
  timeout: 900,

  // Keep session alive after disconnect
  keepAlive: true,
});
```

### Context & Extensions

#### Browser Context
```typescript
const session = await browserbase.sessions.create({
  projectId: BROWSERBASE_PROJECT_ID,
  // Persist cookies and localStorage between sessions
  browserContext: {
    id: "persistent-context-id",
  },
});
```

#### Extensions
```typescript
const session = await browserbase.sessions.create({
  projectId: BROWSERBASE_PROJECT_ID,
  extensionId: "your-extension-id",  // Upload via dashboard first
});
```

### Live View & Recording

#### Get Live View URL
```typescript
const debugUrl = session.debugUrl;
// Open in browser to watch session live
```

#### Session Recording
```typescript
// Sessions are automatically recorded
// Access recordings via dashboard or API
const recording = await browserbase.sessions.getRecording(sessionId);
```

### Page Automation with Playwright

```typescript
// Navigate
await page.goto("https://example.com");
await page.waitForLoadState("networkidle");

// Click elements
await page.click("button.submit");
await page.click("text=Sign In");
await page.click('[data-testid="login-btn"]');

// Fill forms
await page.fill('input[name="email"]', "user@example.com");
await page.fill('input[name="password"]', "password123");

// Select dropdowns
await page.selectOption("select#country", "US");

// Check checkboxes
await page.check('input[type="checkbox"]');

// Type with keyboard
await page.keyboard.type("Hello World");
await page.keyboard.press("Enter");

// Scroll
await page.evaluate(() => window.scrollTo(0, 1000));

// Wait for elements
await page.waitForSelector(".results");
await page.waitForTimeout(2000);

// Get text content
const text = await page.textContent(".title");
const allTexts = await page.$$eval(".item", els => els.map(e => e.textContent));

// Get attribute
const href = await page.getAttribute("a.link", "href");

// Screenshot
const screenshot = await page.screenshot({ fullPage: true });
await page.screenshot({ path: "screenshot.png" });

// PDF (headless only)
const pdf = await page.pdf({ format: "A4" });
```

### Handling Dynamic Content

```typescript
// Wait for network to be idle
await page.waitForLoadState("networkidle");

// Wait for specific request
await page.waitForResponse(response =>
  response.url().includes("/api/data") && response.status() === 200
);

// Wait for element state
await page.waitForSelector(".loading", { state: "hidden" });
await page.waitForSelector(".content", { state: "visible" });

// Scroll and load more
async function scrollToLoadAll(page) {
  let previousHeight = 0;
  while (true) {
    const currentHeight = await page.evaluate(() => document.body.scrollHeight);
    if (currentHeight === previousHeight) break;
    previousHeight = currentHeight;
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1000);
  }
}
```

### Error Handling

```typescript
try {
  await page.click("button.submit", { timeout: 5000 });
} catch (error) {
  if (error.name === "TimeoutError") {
    // Element not found within timeout
    console.log("Button not found, trying alternative");
    await page.click("input[type='submit']");
  }
}

// Retry pattern
async function withRetry(fn, maxAttempts = 3) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxAttempts) throw error;
      await new Promise(r => setTimeout(r, 1000 * attempt));
    }
  }
}
```

## Common Patterns

### Web Scraping
```typescript
async function scrapeProducts(url: string) {
  const session = await browserbase.sessions.create({ projectId });
  const browser = await chromium.connectOverCDP(session.connectUrl);
  const page = browser.contexts()[0].pages()[0];

  try {
    await page.goto(url);
    await page.waitForSelector(".product-grid");

    const products = await page.$$eval(".product-card", cards =>
      cards.map(card => ({
        name: card.querySelector(".name")?.textContent?.trim(),
        price: card.querySelector(".price")?.textContent?.trim(),
        url: card.querySelector("a")?.href,
      }))
    );

    return products;
  } finally {
    await browser.close();
  }
}
```

### Form Submission
```typescript
async function submitForm(formData: FormData) {
  const session = await browserbase.sessions.create({ projectId });
  const browser = await chromium.connectOverCDP(session.connectUrl);
  const page = browser.contexts()[0].pages()[0];

  try {
    await page.goto("https://example.com/contact");

    await page.fill('input[name="name"]', formData.name);
    await page.fill('input[name="email"]', formData.email);
    await page.fill('textarea[name="message"]', formData.message);

    await page.click('button[type="submit"]');
    await page.waitForSelector(".success-message");

    return { success: true };
  } finally {
    await browser.close();
  }
}
```

### Authenticated Sessions
```typescript
async function loginAndScrape(credentials: Credentials, targetUrl: string) {
  // Use persistent context to maintain login
  const session = await browserbase.sessions.create({
    projectId,
    browserContext: { id: `user-${credentials.userId}` },
  });

  const browser = await chromium.connectOverCDP(session.connectUrl);
  const page = browser.contexts()[0].pages()[0];

  try {
    // Check if already logged in
    await page.goto(targetUrl);

    if (await page.$("text=Login")) {
      // Need to login
      await page.click("text=Login");
      await page.fill('input[name="email"]', credentials.email);
      await page.fill('input[name="password"]', credentials.password);
      await page.click('button[type="submit"]');
      await page.waitForNavigation();
    }

    // Now scrape authenticated content
    const data = await page.$$eval(".private-data", els =>
      els.map(el => el.textContent)
    );

    return data;
  } finally {
    await browser.close();
  }
}
```

## Rate Limits & Quotas
- Concurrent sessions: Based on plan (5-100+)
- Session timeout: 15 minutes max
- API rate limit: 100 requests/minute

## Best Practices
1. Always close browser connections in finally blocks
2. Use keepAlive for long-running workflows
3. Implement retry logic for flaky operations
4. Use persistent contexts for authenticated sessions
5. Monitor session usage to stay within quotas
6. Use appropriate timeouts for waitFor operations
