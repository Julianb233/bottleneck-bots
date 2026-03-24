/**
 * Auto-executes tool calls from model responses by mapping them to
 * desktop actions via the action-proxy, then loops until the model
 * stops issuing tool calls (or we hit limits).
 */

import { sendAction, type ActionResult } from '../lib/action-proxy.js';
import { TOOL_TO_ACTION } from './tool-definitions.js';
import {
  routeToProvider,
  type ChatMessage,
  type CompletionResponse,
  type RouteOptions,
  type ToolCall,
} from './model-router.js';

const MAX_TOOL_ROUNDS = 10;
const TOTAL_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export interface ToolExecutionResult {
  /** The final completion (after all tool rounds). */
  completion: CompletionResponse;
  /** Full conversation including all tool call / result messages. */
  messages: ChatMessage[];
  /** Number of tool execution rounds performed. */
  toolRounds: number;
}

/**
 * Run the model, auto-execute any tool calls, feed results back, repeat.
 *
 * @param computerId - The computer UUID to execute actions against
 * @param opts       - The original route options (model, messages, tools, etc.)
 */
export async function executeWithTools(
  computerId: string,
  opts: RouteOptions,
): Promise<ToolExecutionResult> {
  const startTime = Date.now();
  const messages = [...opts.messages];
  let toolRounds = 0;
  let completion: CompletionResponse;

  // Initial model call
  completion = await routeToProvider({ ...opts, messages, stream: false });

  while (toolRounds < MAX_TOOL_ROUNDS) {
    // Check timeout
    if (Date.now() - startTime > TOTAL_TIMEOUT_MS) {
      break;
    }

    const choice = completion.choices[0];
    if (!choice || choice.finish_reason !== 'tool_calls' || !choice.message.tool_calls?.length) {
      break;
    }

    toolRounds++;

    // Add assistant message with tool calls to conversation
    messages.push(choice.message);

    // Execute each tool call
    for (const toolCall of choice.message.tool_calls) {
      const result = await executeToolCall(computerId, toolCall);
      messages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        name: toolCall.function.name,
        content: JSON.stringify(result),
      });
    }

    // Call model again with updated conversation
    completion = await routeToProvider({ ...opts, messages, stream: false });
  }

  return { completion, messages, toolRounds };
}

/**
 * Execute a single tool call against the computer.
 */
async function executeToolCall(
  computerId: string,
  toolCall: ToolCall,
): Promise<Record<string, unknown>> {
  const functionName = toolCall.function.name;
  const actionName = TOOL_TO_ACTION[functionName];

  if (!actionName) {
    return {
      success: false,
      error: `Unknown tool: ${functionName}`,
    };
  }

  let params: Record<string, unknown>;
  try {
    params = JSON.parse(toolCall.function.arguments);
  } catch {
    return {
      success: false,
      error: `Invalid JSON arguments for tool ${functionName}`,
    };
  }

  let result: ActionResult;
  try {
    result = await sendAction(computerId, actionName, params);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown execution error';
    return {
      success: false,
      error: message,
    };
  }

  if (!result.success) {
    return {
      success: false,
      error: result.error ?? 'Action failed',
      duration_ms: result.duration_ms,
    };
  }

  // For screenshots, include the base64 image data
  if (functionName === 'computer_screenshot' && result.data?.image) {
    return {
      success: true,
      image: result.data.image,
      format: result.data.format ?? 'png',
      width: result.data.width,
      height: result.data.height,
      duration_ms: result.duration_ms,
    };
  }

  return {
    success: true,
    ...result.data,
    duration_ms: result.duration_ms,
  };
}
