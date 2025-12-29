import Browserbase from "@browserbasehq/sdk";
import { chromium, Browser, Page } from "playwright-core";

// Browserbase client singleton
let browserbaseClient: Browserbase | null = null;

function getBrowserbaseClient(): Browserbase {
  if (!browserbaseClient) {
    const apiKey = process.env.BROWSERBASE_API_KEY;
    if (!apiKey) {
      throw new Error("BROWSERBASE_API_KEY environment variable is required for browser automation");
    }
    browserbaseClient = new Browserbase({ apiKey });
  }
  return browserbaseClient;
}

export interface BrowserScrapeConfig {
  url: string;
  selector?: string;
  waitForSelector?: string;
  screenshot?: boolean;
  fullPage?: boolean;
  timeout?: number;
  extractText?: boolean;
  extractHtml?: boolean;
  extractLinks?: boolean;
  clickSelector?: string;
  fillForm?: { selector: string; value: string }[];
  waitTime?: number;
  userAgent?: string;
  viewport?: { width: number; height: number };
}

export interface BrowserScrapeResult {
  success: boolean;
  data?: {
    text?: string;
    html?: string;
    links?: string[];
    screenshot?: string; // base64
    title?: string;
    url?: string;
  };
  error?: string;
  sessionId?: string;
}

/**
 * Scrape a URL using Browserbase cloud browser
 * Supports JavaScript rendering, screenshots, form filling, and more
 */
export async function browserScrape(
  config: BrowserScrapeConfig,
  variables?: Record<string, unknown>
): Promise<BrowserScrapeResult> {
  const bb = getBrowserbaseClient();
  let browser: Browser | null = null;
  let session: { id: string } | null = null;

  try {
    // Create a new browser session
    const projectId = process.env.BROWSERBASE_PROJECT_ID;
    if (!projectId) {
      throw new Error("BROWSERBASE_PROJECT_ID environment variable is required");
    }
    session = await bb.sessions.create({
      projectId,
    });

    // Connect to the browser
    browser = await chromium.connectOverCDP(
      `wss://connect.browserbase.com?apiKey=${process.env.BROWSERBASE_API_KEY}&sessionId=${session.id}`
    );

    const context = browser.contexts()[0];
    const page = context.pages()[0];

    // Set viewport if specified
    if (config.viewport) {
      await page.setViewportSize(config.viewport);
    }

    // Set user agent if specified
    if (config.userAgent) {
      await context.setExtraHTTPHeaders({
        "User-Agent": config.userAgent,
      });
    }

    // Apply variable interpolation to URL
    const url = replaceVariables(config.url, variables);

    // Navigate to the page
    await page.goto(url, {
      waitUntil: "networkidle",
      timeout: config.timeout || 30000,
    });

    // Wait for specific selector if provided
    if (config.waitForSelector) {
      await page.waitForSelector(config.waitForSelector, {
        timeout: config.timeout || 30000,
      });
    }

    // Additional wait time if needed
    if (config.waitTime) {
      await page.waitForTimeout(config.waitTime);
    }

    // Click selector if specified
    if (config.clickSelector) {
      await page.click(config.clickSelector);
      await page.waitForTimeout(1000); // Wait for any animations/loads
    }

    // Fill form fields if specified
    if (config.fillForm && config.fillForm.length > 0) {
      for (const field of config.fillForm) {
        await page.fill(field.selector, replaceVariables(field.value, variables));
      }
    }

    // Prepare result data
    const data: BrowserScrapeResult["data"] = {
      title: await page.title(),
      url: page.url(),
    };

    // Extract text from selector or entire page
    if (config.extractText !== false) {
      if (config.selector) {
        const element = await page.$(config.selector);
        if (element) {
          data.text = await element.textContent() || "";
        }
      } else {
        data.text = await page.textContent("body") || "";
      }
    }

    // Extract HTML if requested
    if (config.extractHtml) {
      if (config.selector) {
        const element = await page.$(config.selector);
        if (element) {
          data.html = await element.innerHTML();
        }
      } else {
        data.html = await page.content();
      }
    }

    // Extract links if requested
    if (config.extractLinks) {
      data.links = await page.$$eval("a[href]", (links) =>
        links.map((link) => link.getAttribute("href")).filter(Boolean) as string[]
      );
    }

    // Take screenshot if requested
    if (config.screenshot) {
      const screenshotBuffer = await page.screenshot({
        fullPage: config.fullPage || false,
        type: "png",
      });
      data.screenshot = screenshotBuffer.toString("base64");
    }

    return {
      success: true,
      data,
      sessionId: session.id,
    };
  } catch (error) {
    console.error("Browser scrape error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Browser scrape failed",
      sessionId: session?.id,
    };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Take a screenshot of a URL
 */
export async function browserScreenshot(
  url: string,
  options?: {
    fullPage?: boolean;
    viewport?: { width: number; height: number };
    waitForSelector?: string;
  }
): Promise<{ success: boolean; screenshot?: string; error?: string }> {
  const result = await browserScrape({
    url,
    screenshot: true,
    fullPage: options?.fullPage,
    viewport: options?.viewport,
    waitForSelector: options?.waitForSelector,
    extractText: false,
    extractHtml: false,
  });

  if (result.success && result.data?.screenshot) {
    return { success: true, screenshot: result.data.screenshot };
  }
  return { success: false, error: result.error || "Screenshot failed" };
}

/**
 * Extract all text content from a page
 */
export async function browserExtractText(
  url: string,
  selector?: string
): Promise<{ success: boolean; text?: string; error?: string }> {
  const result = await browserScrape({
    url,
    selector,
    extractText: true,
    extractHtml: false,
  });

  if (result.success && result.data?.text) {
    return { success: true, text: result.data.text };
  }
  return { success: false, error: result.error || "Text extraction failed" };
}

/**
 * Check if Browserbase is configured
 */
export function isBrowserbaseConfigured(): boolean {
  return !!process.env.BROWSERBASE_API_KEY;
}

// Helper function for variable interpolation
function replaceVariables(text: string, data?: Record<string, unknown>): string {
  if (!data) return text;
  return text.replace(/{{([^}]+)}}/g, (match, key) => {
    const keys = key.trim().split(".");
    let value: unknown = data;
    for (const k of keys) {
      if (value && typeof value === "object" && k in value) {
        value = (value as Record<string, unknown>)[k];
      } else {
        return match;
      }
    }
    return value !== undefined ? String(value) : match;
  });
}
