import { Stagehand } from "@browserbasehq/stagehand";
import { z } from "zod";

// Environment variables for Browserbase
const BROWSERBASE_API_KEY = process.env.BROWSERBASE_API_KEY;
const BROWSERBASE_PROJECT_ID = process.env.BROWSERBASE_PROJECT_ID;

// Stagehand session cache
const sessionCache = new Map<string, Stagehand>();

/**
 * Create a new Stagehand session with Browserbase
 */
export async function createStagehandSession(sessionId?: string): Promise<{
  stagehand: Stagehand;
  sessionId: string;
}> {
  if (!BROWSERBASE_API_KEY || !BROWSERBASE_PROJECT_ID) {
    throw new Error("Browserbase credentials not configured");
  }

  const stagehand = new Stagehand({
    env: "BROWSERBASE",
    apiKey: BROWSERBASE_API_KEY,
    projectId: BROWSERBASE_PROJECT_ID,
  });

  await stagehand.init();

  const id = sessionId || crypto.randomUUID();
  sessionCache.set(id, stagehand);

  return { stagehand, sessionId: id };
}

/**
 * Get an existing Stagehand session
 */
export function getStagehandSession(sessionId: string): Stagehand | undefined {
  return sessionCache.get(sessionId);
}

/**
 * Close a Stagehand session
 */
export async function closeStagehandSession(sessionId: string): Promise<void> {
  const stagehand = sessionCache.get(sessionId);
  if (stagehand) {
    await stagehand.close();
    sessionCache.delete(sessionId);
  }
}

/**
 * Navigate to a URL using Stagehand
 */
export async function navigateTo(
  sessionId: string,
  url: string
): Promise<void> {
  const stagehand = sessionCache.get(sessionId);
  if (!stagehand) {
    throw new Error("Session not found");
  }

  // Use goto method directly from stagehand
  await (stagehand as any).page?.goto(url);
}

/**
 * Act on the page using natural language instructions
 * This is the core Stagehand feature - AI-driven web automation
 */
export async function actOnPage(
  sessionId: string,
  instruction: string
): Promise<{ success: boolean; message: string }> {
  const stagehand = sessionCache.get(sessionId);
  if (!stagehand) {
    throw new Error("Session not found");
  }

  try {
    await stagehand.act(instruction);
    return { success: true, message: `Completed: ${instruction}` };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Action failed",
    };
  }
}

/**
 * Extract structured data from the page using a schema
 */
export async function extractData<T extends z.ZodSchema>(
  sessionId: string,
  instruction: string,
  schema: T
): Promise<z.infer<T> | null> {
  const stagehand = sessionCache.get(sessionId);
  if (!stagehand) {
    throw new Error("Session not found");
  }

  try {
    const result = await stagehand.extract(instruction, schema as any);
    return result as z.infer<T>;
  } catch (error) {
    console.error("Extraction failed:", error);
    return null;
  }
}

/**
 * Observe the page and return possible actions
 */
export async function observePage(
  sessionId: string,
  instruction?: string
): Promise<Array<{ selector: string; description: string }>> {
  const stagehand = sessionCache.get(sessionId);
  if (!stagehand) {
    throw new Error("Session not found");
  }

  try {
    const observations = await stagehand.observe(instruction || "What actions can I take on this page?");
    return observations.map((obs: any) => ({
      selector: obs.selector,
      description: obs.description,
    }));
  } catch (error) {
    console.error("Observation failed:", error);
    return [];
  }
}

/**
 * Take a screenshot of the current page
 */
export async function takeScreenshot(
  sessionId: string
): Promise<string | null> {
  const stagehand = sessionCache.get(sessionId);
  if (!stagehand) {
    throw new Error("Session not found");
  }

  try {
    const page = (stagehand as any).page;
    if (!page) return null;

    const screenshot = await page.screenshot({
      encoding: "base64",
      fullPage: false,
    });
    return `data:image/png;base64,${screenshot}`;
  } catch (error) {
    console.error("Screenshot failed:", error);
    return null;
  }
}

/**
 * Get the current page URL
 */
export function getCurrentUrl(sessionId: string): string | null {
  const stagehand = sessionCache.get(sessionId);
  if (!stagehand) {
    return null;
  }
  const page = (stagehand as any).page;
  return page?.url() || null;
}

/**
 * Get the page title
 */
export async function getPageTitle(sessionId: string): Promise<string | null> {
  const stagehand = sessionCache.get(sessionId);
  if (!stagehand) {
    return null;
  }
  const page = (stagehand as any).page;
  return page?.title() || null;
}

/**
 * Wait for page to load
 */
export async function waitForLoad(sessionId: string): Promise<void> {
  const stagehand = sessionCache.get(sessionId);
  if (!stagehand) {
    throw new Error("Session not found");
  }
  const page = (stagehand as any).page;
  if (page) {
    await page.waitForLoadState("networkidle");
  }
}

/**
 * Execute a multi-step workflow
 */
export async function executeWorkflow(
  sessionId: string,
  steps: Array<{
    type: "navigate" | "act" | "extract" | "screenshot" | "wait";
    instruction?: string;
    url?: string;
    schema?: z.ZodSchema;
  }>
): Promise<Array<{ step: number; success: boolean; result?: unknown; error?: string }>> {
  const results: Array<{ step: number; success: boolean; result?: unknown; error?: string }> = [];

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    try {
      let result: unknown;

      switch (step.type) {
        case "navigate":
          if (!step.url) throw new Error("URL required for navigate");
          await navigateTo(sessionId, step.url);
          result = { url: step.url };
          break;

        case "act":
          if (!step.instruction) throw new Error("Instruction required for act");
          result = await actOnPage(sessionId, step.instruction);
          break;

        case "extract":
          if (!step.instruction || !step.schema) {
            throw new Error("Instruction and schema required for extract");
          }
          result = await extractData(sessionId, step.instruction, step.schema);
          break;

        case "screenshot":
          result = await takeScreenshot(sessionId);
          break;

        case "wait":
          await waitForLoad(sessionId);
          result = { waited: true };
          break;
      }

      results.push({ step: i, success: true, result });
    } catch (error) {
      results.push({
        step: i,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      // Stop workflow on error
      break;
    }
  }

  return results;
}

// Common extraction schemas
export const schemas = {
  pageInfo: z.object({
    title: z.string(),
    description: z.string().optional(),
    url: z.string(),
  }),

  price: z.object({
    amount: z.number(),
    currency: z.string(),
    originalPrice: z.number().optional(),
    discount: z.string().optional(),
  }),

  product: z.object({
    name: z.string(),
    price: z.number(),
    currency: z.string(),
    description: z.string().optional(),
    imageUrl: z.string().optional(),
    availability: z.string().optional(),
  }),

  article: z.object({
    title: z.string(),
    author: z.string().optional(),
    date: z.string().optional(),
    content: z.string(),
    tags: z.array(z.string()).optional(),
  }),

  contact: z.object({
    email: z.string().optional(),
    phone: z.string().optional(),
    address: z.string().optional(),
    socialLinks: z.array(z.string()).optional(),
  }),

  tableData: z.array(
    z.record(z.string(), z.string())
  ),

  links: z.array(
    z.object({
      text: z.string(),
      url: z.string(),
    })
  ),
};

export type StagehandSession = {
  id: string;
  stagehand: Stagehand;
  createdAt: Date;
  url?: string;
};
