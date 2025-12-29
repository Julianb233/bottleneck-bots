# Stagehand AI Web Automation - Expert Knowledge Base

## Overview
Stagehand is an AI-powered web automation SDK from Browserbase that enables natural language control of web browsers. It uses LLMs to understand and execute web automation tasks without explicit selectors.

## Core Concepts

### Initialization
```typescript
import { Stagehand } from "@browserbasehq/stagehand";

const stagehand = new Stagehand({
  env: "BROWSERBASE",  // Use cloud browsers
  apiKey: process.env.BROWSERBASE_API_KEY,
  projectId: process.env.BROWSERBASE_PROJECT_ID,
});

await stagehand.init();
```

### Three Core Methods

#### 1. act() - Execute Actions
Natural language instructions to interact with the page.

```typescript
// Click a button
await stagehand.act("Click the Sign In button");

// Fill a form
await stagehand.act("Type 'john@example.com' in the email field");

// Navigate
await stagehand.act("Click on the Products menu item");

// Complex actions
await stagehand.act("Scroll down and click 'Load More'");
```

**Best Practices:**
- Be specific about which element to target
- Use visible text when possible
- Break complex actions into steps

#### 2. extract() - Get Structured Data
Extract data from pages using Zod schemas.

```typescript
import { z } from "zod";

// Extract product info
const productSchema = z.object({
  name: z.string(),
  price: z.number(),
  description: z.string(),
  inStock: z.boolean(),
});

const product = await stagehand.extract(
  "Extract the product information from this page",
  productSchema
);

// Extract list of items
const productsSchema = z.array(z.object({
  title: z.string(),
  price: z.string(),
  url: z.string(),
}));

const products = await stagehand.extract(
  "Get all product listings on this page",
  productsSchema
);
```

**Best Practices:**
- Define clear Zod schemas
- Use optional() for fields that might not exist
- Be specific about what data to extract

#### 3. observe() - Discover Actions
Find available actions on a page.

```typescript
// Get all possible actions
const actions = await stagehand.observe();
// Returns: [{ selector: "...", description: "Click login button" }, ...]

// Get specific type of actions
const formFields = await stagehand.observe(
  "What form fields can I fill on this page?"
);
```

## Common Patterns

### Multi-Step Workflows
```typescript
// Navigate and extract
await stagehand.page.goto("https://example.com");
await stagehand.act("Click on Products");
await stagehand.act("Select Electronics category");

const data = await stagehand.extract(
  "Get all electronic products with prices",
  productsSchema
);
```

### Form Automation
```typescript
await stagehand.act("Fill in 'John Doe' for the name field");
await stagehand.act("Enter 'john@example.com' in email");
await stagehand.act("Select 'United States' from the country dropdown");
await stagehand.act("Check the 'I agree to terms' checkbox");
await stagehand.act("Click Submit");
```

### Login Flows
```typescript
await stagehand.page.goto("https://app.example.com/login");
await stagehand.act("Enter username 'user@example.com'");
await stagehand.act("Enter password 'secretpassword'");
await stagehand.act("Click the Sign In button");
await stagehand.page.waitForNavigation();
```

### Data Scraping
```typescript
// Paginated scraping
const allProducts = [];
let hasNextPage = true;

while (hasNextPage) {
  const products = await stagehand.extract(
    "Get all products on this page",
    productsSchema
  );
  allProducts.push(...products);

  try {
    await stagehand.act("Click the Next page button");
    await stagehand.page.waitForLoadState("networkidle");
  } catch {
    hasNextPage = false;
  }
}
```

## Error Handling

```typescript
try {
  await stagehand.act("Click the Submit button");
} catch (error) {
  if (error.message.includes("Element not found")) {
    // Try alternative approach
    await stagehand.act("Click the button that says Submit");
  }
}
```

## Session Management

```typescript
// Get session info
const sessionId = stagehand.sessionId;

// Take screenshot
const screenshot = await stagehand.page.screenshot({
  encoding: "base64",
  fullPage: true,
});

// Get current URL
const url = stagehand.page.url();

// Close session
await stagehand.close();
```

## Integration Tips

1. **Rate Limiting**: Add delays between actions for stability
2. **Timeouts**: Set appropriate timeouts for slow pages
3. **Retries**: Implement retry logic for flaky operations
4. **Screenshots**: Take screenshots for debugging/verification
5. **Logging**: Log all actions for audit trail

## Common Extraction Schemas

```typescript
// Contact information
const contactSchema = z.object({
  email: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
});

// Article/content
const articleSchema = z.object({
  title: z.string(),
  author: z.string().optional(),
  date: z.string().optional(),
  content: z.string(),
});

// E-commerce product
const productSchema = z.object({
  name: z.string(),
  price: z.number(),
  currency: z.string(),
  description: z.string().optional(),
  imageUrl: z.string().optional(),
  availability: z.enum(["in_stock", "out_of_stock", "limited"]).optional(),
});

// Table data
const tableSchema = z.array(z.record(z.string(), z.string()));
```

## Limitations
- Cannot interact with CAPTCHAs (use CAPTCHA solving services)
- Some dynamic content may require explicit waits
- Complex JavaScript apps may need page.waitForSelector()
- Rate limits apply based on Browserbase plan
