/**
 * Agent Execution Engine
 *
 * Real LLM-based agent execution using Claude API.
 * Replaces the simulated responses with actual AI reasoning and tool execution.
 */

import Anthropic from "@anthropic-ai/sdk";
import {
  getKnowledgeForAgent,
  buildExpertisePrompt,
} from "./agent-knowledge";
import { AGENT_TOOLS, executeAgentTool, type AgentToolName } from "./agent-tools";

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Agent configuration interface
export interface AgentConfig {
  id: string;
  name: string;
  role: string;
  systemPrompt?: string;
  capabilities: string[];
  integrationExpertise: string[];
  knowledgeSources?: Array<{
    filename: string;
    content: string;
  }>;
  clientContext?: ClientContext;
  maxIterations?: number;
  temperature?: number;
}

export interface ClientContext {
  organizationName?: string;
  industry?: string;
  useCase?: string;
  preferences?: Record<string, string>;
  customInstructions?: string;
}

export interface AgentMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResult {
  toolCallId: string;
  result: unknown;
  error?: string;
}

export interface AgentResponse {
  content: string;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
  thinking?: string;
  tokensUsed?: {
    input: number;
    output: number;
  };
}

/**
 * Build the system prompt for an agent
 */
function buildSystemPrompt(config: AgentConfig): string {
  const parts: string[] = [];

  // Base identity
  parts.push(`You are ${config.name}, a ${config.role} agent.`);

  // Custom system prompt
  if (config.systemPrompt) {
    parts.push("\n## Your Instructions\n" + config.systemPrompt);
  }

  // Default behavior guidelines
  parts.push(`
## Agent Behavior Guidelines

1. **One Tool Per Message**: Execute only one tool action per response to ensure clarity and traceability.

2. **Transparency**: Always explain what you're doing and why before taking action.

3. **Error Handling**: If an action fails, explain what went wrong and suggest alternatives.

4. **Progress Tracking**: Keep track of subtasks and report progress clearly.

5. **Ask for Clarification**: If a request is ambiguous, ask for clarification rather than guessing.

6. **Preserve Context**: Reference previous messages and results when relevant.
`);

  // Client context
  if (config.clientContext) {
    parts.push("\n## Client Context\n");
    if (config.clientContext.organizationName) {
      parts.push(`Organization: ${config.clientContext.organizationName}`);
    }
    if (config.clientContext.industry) {
      parts.push(`Industry: ${config.clientContext.industry}`);
    }
    if (config.clientContext.useCase) {
      parts.push(`Use Case: ${config.clientContext.useCase}`);
    }
    if (config.clientContext.customInstructions) {
      parts.push(
        `\nCustom Instructions:\n${config.clientContext.customInstructions}`
      );
    }
  }

  // Integration expertise
  if (config.integrationExpertise.length > 0) {
    parts.push(buildExpertisePrompt(config.integrationExpertise));

    // Add full knowledge content
    const knowledge = getKnowledgeForAgent(config.integrationExpertise);
    if (knowledge) {
      parts.push("\n" + knowledge);
    }
  }

  // Knowledge sources (uploaded documents)
  if (config.knowledgeSources && config.knowledgeSources.length > 0) {
    parts.push("\n## Uploaded Knowledge Sources\n");
    for (const source of config.knowledgeSources) {
      parts.push(`### ${source.filename}\n${source.content}\n`);
    }
  }

  // Capabilities
  if (config.capabilities.length > 0) {
    parts.push(
      `\n## Your Capabilities\nYou have access to: ${config.capabilities.join(", ")}`
    );
  }

  return parts.join("\n");
}

/**
 * Convert our tools to Anthropic tool format
 */
function getAnthropicTools(
  capabilities: string[]
): Anthropic.Tool[] {
  const tools: Anthropic.Tool[] = [];

  // Map capabilities to tools
  for (const capability of capabilities) {
    const toolDef = AGENT_TOOLS[capability as AgentToolName];
    if (toolDef) {
      tools.push({
        name: capability,
        description: toolDef.description,
        input_schema: toolDef.inputSchema as Anthropic.Tool.InputSchema,
      });
    }
  }

  return tools;
}

/**
 * Execute an agent with real LLM
 */
export async function executeAgent(
  config: AgentConfig,
  messages: AgentMessage[],
  onToolCall?: (toolCall: ToolCall) => void,
  onToolResult?: (result: ToolResult) => void
): Promise<AgentResponse> {
  const systemPrompt = buildSystemPrompt(config);
  const tools = getAnthropicTools(config.capabilities);

  // Convert messages to Anthropic format
  const anthropicMessages: Anthropic.MessageParam[] = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const maxIterations = config.maxIterations || 5;
  let iteration = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  const allToolCalls: ToolCall[] = [];
  const allToolResults: ToolResult[] = [];

  while (iteration < maxIterations) {
    iteration++;

    // Call Claude
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      temperature: config.temperature || 0.7,
      system: systemPrompt,
      tools: tools.length > 0 ? tools : undefined,
      messages: anthropicMessages,
    });

    totalInputTokens += response.usage.input_tokens;
    totalOutputTokens += response.usage.output_tokens;

    // Check if we need to handle tool use
    if (response.stop_reason === "tool_use") {
      // Find tool use blocks
      const toolUseBlocks = response.content.filter(
        (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
      );

      // Process each tool call
      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const toolUse of toolUseBlocks) {
        const toolCall: ToolCall = {
          id: toolUse.id,
          name: toolUse.name,
          input: toolUse.input as Record<string, unknown>,
        };

        allToolCalls.push(toolCall);
        onToolCall?.(toolCall);

        // Execute the tool
        try {
          const result = await executeAgentTool(
            toolUse.name as AgentToolName,
            toolUse.input as Record<string, unknown>
          );

          const toolResult: ToolResult = {
            toolCallId: toolUse.id,
            result,
          };

          allToolResults.push(toolResult);
          onToolResult?.(toolResult);

          toolResults.push({
            type: "tool_result",
            tool_use_id: toolUse.id,
            content: JSON.stringify(result),
          });
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";

          const toolResult: ToolResult = {
            toolCallId: toolUse.id,
            result: null,
            error: errorMessage,
          };

          allToolResults.push(toolResult);
          onToolResult?.(toolResult);

          toolResults.push({
            type: "tool_result",
            tool_use_id: toolUse.id,
            content: JSON.stringify({ error: errorMessage }),
            is_error: true,
          });
        }
      }

      // Add assistant message with tool use
      anthropicMessages.push({
        role: "assistant",
        content: response.content,
      });

      // Add tool results
      anthropicMessages.push({
        role: "user",
        content: toolResults,
      });

      // Continue the loop for another iteration
      continue;
    }

    // No tool use - extract text response
    const textBlocks = response.content.filter(
      (block): block is Anthropic.TextBlock => block.type === "text"
    );

    const content = textBlocks.map((b) => b.text).join("\n");

    return {
      content,
      toolCalls: allToolCalls.length > 0 ? allToolCalls : undefined,
      toolResults: allToolResults.length > 0 ? allToolResults : undefined,
      tokensUsed: {
        input: totalInputTokens,
        output: totalOutputTokens,
      },
    };
  }

  // Max iterations reached
  return {
    content:
      "I've reached the maximum number of tool calls for this request. Please provide more specific instructions or break this into smaller tasks.",
    toolCalls: allToolCalls,
    toolResults: allToolResults,
    tokensUsed: {
      input: totalInputTokens,
      output: totalOutputTokens,
    },
  };
}

/**
 * Stream agent response (for real-time UI updates)
 */
export async function* streamAgentResponse(
  config: AgentConfig,
  messages: AgentMessage[]
): AsyncGenerator<{
  type: "text" | "tool_call" | "tool_result" | "done";
  content?: string;
  toolCall?: ToolCall;
  toolResult?: ToolResult;
}> {
  const systemPrompt = buildSystemPrompt(config);
  const tools = getAnthropicTools(config.capabilities);

  const anthropicMessages: Anthropic.MessageParam[] = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const stream = await anthropic.messages.stream({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    temperature: config.temperature || 0.7,
    system: systemPrompt,
    tools: tools.length > 0 ? tools : undefined,
    messages: anthropicMessages,
  });

  let currentText = "";

  for await (const event of stream) {
    if (
      event.type === "content_block_delta" &&
      event.delta.type === "text_delta"
    ) {
      currentText += event.delta.text;
      yield { type: "text", content: event.delta.text };
    }
  }

  const finalMessage = await stream.finalMessage();

  // Handle tool calls if any
  const toolUseBlocks = finalMessage.content.filter(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
  );

  for (const toolUse of toolUseBlocks) {
    const toolCall: ToolCall = {
      id: toolUse.id,
      name: toolUse.name,
      input: toolUse.input as Record<string, unknown>,
    };

    yield { type: "tool_call", toolCall };

    // Execute tool
    try {
      const result = await executeAgentTool(
        toolUse.name as AgentToolName,
        toolUse.input as Record<string, unknown>
      );

      yield {
        type: "tool_result",
        toolResult: {
          toolCallId: toolUse.id,
          result,
        },
      };
    } catch (error) {
      yield {
        type: "tool_result",
        toolResult: {
          toolCallId: toolUse.id,
          result: null,
          error: error instanceof Error ? error.message : "Unknown error",
        },
      };
    }
  }

  yield { type: "done" };
}

/**
 * Simple chat without tools (for basic conversations)
 */
export async function simpleChat(
  systemPrompt: string,
  userMessage: string
): Promise<string> {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2048,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });

  const textBlock = response.content.find(
    (block): block is Anthropic.TextBlock => block.type === "text"
  );

  return textBlock?.text || "";
}

/**
 * Test if API key is valid
 */
export async function testApiConnection(): Promise<boolean> {
  try {
    await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 10,
      messages: [{ role: "user", content: "Hi" }],
    });
    return true;
  } catch {
    return false;
  }
}
