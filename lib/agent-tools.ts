/**
 * Agent Tools Registry
 *
 * Defines tools available to agents for execution.
 * Tools integrate with Stagehand, APIs, and internal functions.
 */

import {
  createStagehandSession,
  actOnPage,
  extractData,
  observePage,
  takeScreenshot,
  navigateTo,
  closeStagehandSession,
} from "./stagehand";
import { z } from "zod";

// Tool definition interface
export interface AgentToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required: string[];
  };
  execute: (input: Record<string, unknown>) => Promise<unknown>;
}

// Available tools
export const AGENT_TOOLS: Record<string, AgentToolDefinition> = {
  // Web Browsing Tools
  web_navigate: {
    name: "web_navigate",
    description:
      "Navigate to a URL in the browser. Use this to visit websites before performing actions.",
    inputSchema: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "The full URL to navigate to (including https://)",
        },
        sessionId: {
          type: "string",
          description: "Optional existing session ID to use",
        },
      },
      required: ["url"],
    },
    execute: async (input) => {
      const { url, sessionId } = input as { url: string; sessionId?: string };

      // Create or get session
      let activeSessionId = sessionId;
      if (!activeSessionId) {
        const session = await createStagehandSession();
        activeSessionId = session.sessionId;
      }

      await navigateTo(activeSessionId, url);

      return {
        success: true,
        sessionId: activeSessionId,
        url,
        message: `Navigated to ${url}`,
      };
    },
  },

  web_act: {
    name: "web_act",
    description:
      "Perform an action on the current page using natural language. Examples: 'Click the Sign In button', 'Type hello@email.com in the email field', 'Select United States from the country dropdown'.",
    inputSchema: {
      type: "object",
      properties: {
        instruction: {
          type: "string",
          description:
            "Natural language instruction for what to do on the page",
        },
        sessionId: {
          type: "string",
          description: "Session ID from web_navigate",
        },
      },
      required: ["instruction", "sessionId"],
    },
    execute: async (input) => {
      const { instruction, sessionId } = input as {
        instruction: string;
        sessionId: string;
      };

      const result = await actOnPage(sessionId, instruction);
      return result;
    },
  },

  web_extract: {
    name: "web_extract",
    description:
      "Extract structured data from the current page. Specify what data you want and its structure.",
    inputSchema: {
      type: "object",
      properties: {
        instruction: {
          type: "string",
          description: "What data to extract, e.g., 'Get all product names and prices'",
        },
        sessionId: {
          type: "string",
          description: "Session ID from web_navigate",
        },
        fields: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              type: { type: "string", enum: ["string", "number", "boolean", "array"] },
            },
          },
          description: "Fields to extract with their types",
        },
      },
      required: ["instruction", "sessionId"],
    },
    execute: async (input) => {
      const { instruction, sessionId, fields } = input as {
        instruction: string;
        sessionId: string;
        fields?: Array<{ name: string; type: string }>;
      };

      // Build dynamic schema from fields
      let schema: z.ZodSchema = z.record(z.string(), z.unknown());

      if (fields && fields.length > 0) {
        const schemaObj: Record<string, z.ZodTypeAny> = {};
        for (const field of fields) {
          switch (field.type) {
            case "string":
              schemaObj[field.name] = z.string();
              break;
            case "number":
              schemaObj[field.name] = z.number();
              break;
            case "boolean":
              schemaObj[field.name] = z.boolean();
              break;
            case "array":
              schemaObj[field.name] = z.array(z.string());
              break;
            default:
              schemaObj[field.name] = z.unknown();
          }
        }
        schema = z.object(schemaObj);
      }

      const data = await extractData(sessionId, instruction, schema);
      return { success: true, data };
    },
  },

  web_observe: {
    name: "web_observe",
    description:
      "Observe the current page to see what actions are available. Returns a list of possible interactions.",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: {
          type: "string",
          description: "Session ID from web_navigate",
        },
        question: {
          type: "string",
          description: "Optional question about what to look for",
        },
      },
      required: ["sessionId"],
    },
    execute: async (input) => {
      const { sessionId, question } = input as {
        sessionId: string;
        question?: string;
      };

      const observations = await observePage(sessionId, question);
      return { success: true, availableActions: observations };
    },
  },

  web_screenshot: {
    name: "web_screenshot",
    description: "Take a screenshot of the current page.",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: {
          type: "string",
          description: "Session ID from web_navigate",
        },
      },
      required: ["sessionId"],
    },
    execute: async (input) => {
      const { sessionId } = input as { sessionId: string };
      const screenshot = await takeScreenshot(sessionId);
      return {
        success: true,
        screenshot,
        message: "Screenshot captured",
      };
    },
  },

  web_close: {
    name: "web_close",
    description: "Close a browser session when done.",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: {
          type: "string",
          description: "Session ID to close",
        },
      },
      required: ["sessionId"],
    },
    execute: async (input) => {
      const { sessionId } = input as { sessionId: string };
      await closeStagehandSession(sessionId);
      return { success: true, message: "Session closed" };
    },
  },

  // API Call Tool
  api_call: {
    name: "api_call",
    description:
      "Make an HTTP request to an external API. Supports GET, POST, PUT, PATCH, DELETE methods.",
    inputSchema: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "The API endpoint URL",
        },
        method: {
          type: "string",
          enum: ["GET", "POST", "PUT", "PATCH", "DELETE"],
          description: "HTTP method",
        },
        headers: {
          type: "object",
          description: "Request headers as key-value pairs",
        },
        body: {
          type: "object",
          description: "Request body for POST/PUT/PATCH requests",
        },
      },
      required: ["url", "method"],
    },
    execute: async (input) => {
      const { url, method, headers, body } = input as {
        url: string;
        method: string;
        headers?: Record<string, string>;
        body?: Record<string, unknown>;
      };

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      const contentType = response.headers.get("content-type");
      let data;

      if (contentType?.includes("application/json")) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      return {
        success: response.ok,
        status: response.status,
        statusText: response.statusText,
        data,
      };
    },
  },

  // Search Knowledge Tool
  search_knowledge: {
    name: "search_knowledge",
    description:
      "Search through uploaded knowledge documents for relevant information.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "What to search for in the knowledge base",
        },
      },
      required: ["query"],
    },
    execute: async (input) => {
      const { query } = input as { query: string };
      // This would integrate with actual knowledge storage
      // For now, return a placeholder
      return {
        success: true,
        results: [],
        message: `Searched for: ${query}. Knowledge search not yet implemented.`,
      };
    },
  },

  // Task Delegation Tool
  delegate_task: {
    name: "delegate_task",
    description:
      "Delegate a subtask to another agent in the swarm. Use this to break down complex tasks.",
    inputSchema: {
      type: "object",
      properties: {
        targetAgentId: {
          type: "string",
          description: "ID of the agent to delegate to (or 'auto' for automatic selection)",
        },
        task: {
          type: "string",
          description: "Description of the task to delegate",
        },
        context: {
          type: "string",
          description: "Additional context for the delegated task",
        },
        priority: {
          type: "string",
          enum: ["low", "medium", "high", "critical"],
          description: "Task priority",
        },
      },
      required: ["task"],
    },
    execute: async (input) => {
      const { targetAgentId, task, context, priority } = input as {
        targetAgentId?: string;
        task: string;
        context?: string;
        priority?: string;
      };

      // This would integrate with the swarm task system
      return {
        success: true,
        message: `Task delegated: ${task}`,
        taskId: `task_${Date.now()}`,
        targetAgent: targetAgentId || "auto",
        priority: priority || "medium",
      };
    },
  },

  // Data Analysis Tool
  analyze_data: {
    name: "analyze_data",
    description:
      "Analyze structured data and provide insights. Pass JSON data to analyze.",
    inputSchema: {
      type: "object",
      properties: {
        data: {
          type: "object",
          description: "The data to analyze (JSON format)",
        },
        analysisType: {
          type: "string",
          enum: ["summary", "trends", "anomalies", "comparison"],
          description: "Type of analysis to perform",
        },
        question: {
          type: "string",
          description: "Specific question about the data",
        },
      },
      required: ["data"],
    },
    execute: async (input) => {
      const { data, analysisType, question } = input as {
        data: unknown;
        analysisType?: string;
        question?: string;
      };

      // Basic analysis - in production this would be more sophisticated
      const dataString = JSON.stringify(data, null, 2);
      const analysis = {
        recordCount:
          Array.isArray(data) ? data.length : Object.keys(data as object).length,
        fields: Array.isArray(data) && data.length > 0 ? Object.keys(data[0]) : [],
        analysisType: analysisType || "summary",
        question,
      };

      return {
        success: true,
        analysis,
        summary: `Analyzed ${analysis.recordCount} records with fields: ${analysis.fields.join(", ")}`,
      };
    },
  },

  // File Operations
  save_result: {
    name: "save_result",
    description: "Save results or data to a file for later reference.",
    inputSchema: {
      type: "object",
      properties: {
        filename: {
          type: "string",
          description: "Name for the file (will be saved in results folder)",
        },
        content: {
          type: "string",
          description: "Content to save",
        },
        format: {
          type: "string",
          enum: ["text", "json", "csv", "markdown"],
          description: "File format",
        },
      },
      required: ["filename", "content"],
    },
    execute: async (input) => {
      const { filename, content, format } = input as {
        filename: string;
        content: string;
        format?: string;
      };

      // In production, this would save to storage
      return {
        success: true,
        message: `Would save to ${filename}.${format || "txt"}`,
        contentPreview: content.substring(0, 200),
      };
    },
  },
};

// Tool name type
export type AgentToolName = keyof typeof AGENT_TOOLS;

/**
 * Execute a tool by name
 */
export async function executeAgentTool(
  toolName: AgentToolName,
  input: Record<string, unknown>
): Promise<unknown> {
  const tool = AGENT_TOOLS[toolName];

  if (!tool) {
    throw new Error(`Unknown tool: ${toolName}`);
  }

  return tool.execute(input);
}

/**
 * Get tool definitions for a set of capabilities
 */
export function getToolsForCapabilities(
  capabilities: string[]
): AgentToolDefinition[] {
  return capabilities
    .map((cap) => AGENT_TOOLS[cap])
    .filter((tool): tool is AgentToolDefinition => tool !== undefined);
}

/**
 * Map capability names to tool names
 */
export const CAPABILITY_TO_TOOL_MAP: Record<string, AgentToolName[]> = {
  browser_automation: [
    "web_navigate",
    "web_act",
    "web_extract",
    "web_observe",
    "web_screenshot",
    "web_close",
  ],
  web_search: ["web_navigate", "web_extract", "web_observe"],
  data_extraction: ["web_extract", "analyze_data"],
  data_analysis: ["analyze_data"],
  api_calls: ["api_call"],
  content_generation: [],
  monitoring: ["web_navigate", "web_extract", "web_screenshot"],
  alerting: ["api_call"],
  file_operations: ["save_result"],
  screenshot: ["web_screenshot"],
};

/**
 * Get all tools for given capabilities
 */
export function expandCapabilities(capabilities: string[]): AgentToolName[] {
  const tools = new Set<AgentToolName>();

  for (const capability of capabilities) {
    const mappedTools = CAPABILITY_TO_TOOL_MAP[capability];
    if (mappedTools) {
      for (const tool of mappedTools) {
        tools.add(tool);
      }
    } else if (AGENT_TOOLS[capability]) {
      // Direct tool reference
      tools.add(capability as AgentToolName);
    }
  }

  return Array.from(tools);
}
