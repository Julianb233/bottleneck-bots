/**
 * Browser Scrape Action for Bottleneck-Bots
 * Uses Browserbase for cloud browser automation with JavaScript rendering support
 */

import {
  BaseAction,
  ActionInput,
  ActionOutput,
  ActionConfigSchema,
  executeWithTimeout,
} from "./base";
import { ActionType } from "../types";
import {
  browserScrape,
  isBrowserbaseConfigured,
  BrowserScrapeConfig,
} from "../../browserbase";

/**
 * Browser scrape action configuration
 */
export interface BrowserScrapeActionConfig {
  /** URL to scrape */
  url: string;
  /** CSS selector to extract content from */
  selector?: string;
  /** Wait for this selector before scraping */
  waitForSelector?: string;
  /** Take a screenshot */
  screenshot?: boolean;
  /** Capture full page screenshot */
  fullPage?: boolean;
  /** Timeout in milliseconds */
  timeout?: number;
  /** Extract text content (default: true) */
  extractText?: boolean;
  /** Extract HTML content */
  extractHtml?: boolean;
  /** Extract all links from page */
  extractLinks?: boolean;
  /** Click this element before scraping */
  clickSelector?: string;
  /** Form fields to fill before scraping */
  fillForm?: { selector: string; value: string }[];
  /** Additional wait time in ms after page load */
  waitTime?: number;
  /** Custom user agent string */
  userAgent?: string;
  /** Viewport width */
  viewportWidth?: number;
  /** Viewport height */
  viewportHeight?: number;
}

/**
 * Browser Scrape Action Implementation
 */
export class BrowserScrapeAction extends BaseAction {
  readonly type = ActionType.BROWSER_SCRAPE;
  readonly name = "Browser Scrape";
  readonly description =
    "Scrape web pages using a real browser (Browserbase). Supports JavaScript rendering, screenshots, form filling, and more.";

  protected defaultTimeoutMs = 60000; // Browser operations can take longer

  readonly configSchema: ActionConfigSchema = {
    required: [
      {
        name: "url",
        type: "string",
        description: "URL to scrape",
      },
    ],
    optional: [
      {
        name: "selector",
        type: "string",
        description: "CSS selector to extract content from",
      },
      {
        name: "waitForSelector",
        type: "string",
        description: "Wait for this selector before scraping",
      },
      {
        name: "screenshot",
        type: "boolean",
        description: "Take a screenshot",
      },
      {
        name: "fullPage",
        type: "boolean",
        description: "Capture full page screenshot",
      },
      {
        name: "timeout",
        type: "number",
        description: "Timeout in milliseconds (default: 30000)",
        min: 1000,
        max: 120000,
      },
      {
        name: "extractText",
        type: "boolean",
        description: "Extract text content (default: true)",
      },
      {
        name: "extractHtml",
        type: "boolean",
        description: "Extract HTML content",
      },
      {
        name: "extractLinks",
        type: "boolean",
        description: "Extract all links from page",
      },
      {
        name: "clickSelector",
        type: "string",
        description: "Click this element before scraping",
      },
      {
        name: "waitTime",
        type: "number",
        description: "Additional wait time in ms after page load",
        min: 0,
        max: 30000,
      },
      {
        name: "userAgent",
        type: "string",
        description: "Custom user agent string",
      },
      {
        name: "viewportWidth",
        type: "number",
        description: "Viewport width (default: 1280)",
        min: 320,
        max: 3840,
      },
      {
        name: "viewportHeight",
        type: "number",
        description: "Viewport height (default: 720)",
        min: 240,
        max: 2160,
      },
    ],
  };

  async execute(input: ActionInput): Promise<ActionOutput> {
    const config = input.interpolatedConfig as unknown as BrowserScrapeActionConfig;
    const { context, abortSignal } = input;

    // Check if Browserbase is configured
    if (!isBrowserbaseConfigured()) {
      throw new Error(
        "Browserbase is not configured. Set BROWSERBASE_API_KEY and BROWSERBASE_PROJECT_ID environment variables."
      );
    }

    // Validate URL
    if (!config.url) {
      throw new Error("URL is required for browser scrape action");
    }

    // Build the scrape config
    const scrapeConfig: BrowserScrapeConfig = {
      url: config.url,
      selector: config.selector,
      waitForSelector: config.waitForSelector,
      screenshot: config.screenshot,
      fullPage: config.fullPage,
      timeout: config.timeout,
      extractText: config.extractText ?? true,
      extractHtml: config.extractHtml,
      extractLinks: config.extractLinks,
      clickSelector: config.clickSelector,
      waitTime: config.waitTime,
      userAgent: config.userAgent,
      viewport:
        config.viewportWidth && config.viewportHeight
          ? { width: config.viewportWidth, height: config.viewportHeight }
          : undefined,
      fillForm: config.fillForm,
    };

    // Execute the browser scrape with timeout
    const result = await executeWithTimeout(
      () => browserScrape(scrapeConfig, context.getVariable("triggerData") as Record<string, unknown>),
      config.timeout || this.defaultTimeoutMs,
      abortSignal
    );

    if (!result.success) {
      throw new Error(result.error || "Browser scrape failed");
    }

    return {
      data: result.data,
      metadata: {
        url: config.url,
        pageTitle: result.data?.title,
        finalUrl: result.data?.url,
        sessionId: result.sessionId,
        hasScreenshot: !!result.data?.screenshot,
        linkCount: result.data?.links?.length || 0,
        textLength: result.data?.text?.length || 0,
      },
    };
  }

  /**
   * Override retryable check for browser-specific errors
   */
  isRetryable(error: Error): boolean {
    const message = error.message.toLowerCase();

    // Browser-specific retryable errors
    if (
      message.includes("navigation timeout") ||
      message.includes("browser disconnected") ||
      message.includes("session expired") ||
      message.includes("page crashed")
    ) {
      return true;
    }

    return super.isRetryable(error);
  }
}

// Export singleton instance for registry
export const browserScrapeAction = new BrowserScrapeAction();
