/**
 * Multi-model router — translates between OpenAI chat completions format
 * and Anthropic / OpenAI / Google Gemini APIs.
 *
 * All responses are normalised back to the OpenAI chat completions shape.
 */

import type { ToolDefinition } from './tool-definitions.js';

// ─── Types ──────────────────────────────────────────────────────────────────

export type Provider = 'anthropic' | 'openai' | 'google';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | Array<{ type: string; [k: string]: unknown }>;
  name?: string;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface RouteOptions {
  model: string;
  messages: ChatMessage[];
  tools?: ToolDefinition[];
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
  providerApiKey: string;
}

export interface CompletionChoice {
  index: number;
  message: ChatMessage;
  finish_reason: string | null;
}

export interface CompletionResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: CompletionChoice[];
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

export interface StreamChunk {
  id: string;
  object: 'chat.completion.chunk';
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: Partial<ChatMessage>;
    finish_reason: string | null;
  }>;
}

// ─── Provider detection ─────────────────────────────────────────────────────

export function detectProvider(model: string): Provider {
  if (model.startsWith('claude-') || model.startsWith('anthropic/')) return 'anthropic';
  if (model.startsWith('gemini-') || model.startsWith('google/')) return 'google';
  // Default to OpenAI for gpt-*, o1-*, o3-*, or anything else
  return 'openai';
}

// ─── Main router ────────────────────────────────────────────────────────────

export async function routeToProvider(opts: RouteOptions): Promise<CompletionResponse> {
  const provider = detectProvider(opts.model);

  switch (provider) {
    case 'anthropic':
      return anthropicAdapter(opts);
    case 'google':
      return geminiAdapter(opts);
    case 'openai':
    default:
      return openaiAdapter(opts);
  }
}

export async function routeToProviderStream(
  opts: RouteOptions,
): Promise<ReadableStream<Uint8Array>> {
  const provider = detectProvider(opts.model);

  switch (provider) {
    case 'anthropic':
      return anthropicStreamAdapter(opts);
    case 'google':
      return geminiStreamAdapter(opts);
    case 'openai':
    default:
      return openaiStreamAdapter(opts);
  }
}

// ─── OpenAI Adapter ─────────────────────────────────────────────────────────

async function openaiAdapter(opts: RouteOptions): Promise<CompletionResponse> {
  const body: Record<string, unknown> = {
    model: opts.model,
    messages: opts.messages,
    stream: false,
  };
  if (opts.tools?.length) body.tools = opts.tools;
  if (opts.temperature != null) body.temperature = opts.temperature;
  if (opts.max_tokens != null) body.max_tokens = opts.max_tokens;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${opts.providerApiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI API error ${res.status}: ${text}`);
  }

  return (await res.json()) as CompletionResponse;
}

async function openaiStreamAdapter(opts: RouteOptions): Promise<ReadableStream<Uint8Array>> {
  const body: Record<string, unknown> = {
    model: opts.model,
    messages: opts.messages,
    stream: true,
  };
  if (opts.tools?.length) body.tools = opts.tools;
  if (opts.temperature != null) body.temperature = opts.temperature;
  if (opts.max_tokens != null) body.max_tokens = opts.max_tokens;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${opts.providerApiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI API error ${res.status}: ${text}`);
  }

  return res.body as ReadableStream<Uint8Array>;
}

// ─── Anthropic Adapter ──────────────────────────────────────────────────────

/**
 * Convert OpenAI-style messages to Anthropic Messages API format.
 */
function toAnthropicMessages(messages: ChatMessage[]): {
  system: string | undefined;
  messages: Array<{ role: string; content: unknown }>;
} {
  let system: string | undefined;
  const anthropicMsgs: Array<{ role: string; content: unknown }> = [];

  for (const msg of messages) {
    if (msg.role === 'system') {
      system = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
      continue;
    }

    if (msg.role === 'tool') {
      // Tool results go as user messages with tool_result content blocks
      anthropicMsgs.push({
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: msg.tool_call_id,
            content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
          },
        ],
      });
      continue;
    }

    if (msg.role === 'assistant' && msg.tool_calls?.length) {
      // Assistant message with tool calls → tool_use content blocks
      const contentBlocks: Array<Record<string, unknown>> = [];
      if (msg.content && typeof msg.content === 'string' && msg.content.length > 0) {
        contentBlocks.push({ type: 'text', text: msg.content });
      }
      for (const tc of msg.tool_calls) {
        contentBlocks.push({
          type: 'tool_use',
          id: tc.id,
          name: tc.function.name,
          input: JSON.parse(tc.function.arguments),
        });
      }
      anthropicMsgs.push({ role: 'assistant', content: contentBlocks });
      continue;
    }

    anthropicMsgs.push({
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
    });
  }

  return { system, messages: anthropicMsgs };
}

function toAnthropicTools(tools: ToolDefinition[]): Array<Record<string, unknown>> {
  return tools.map((t) => ({
    name: t.function.name,
    description: t.function.description,
    input_schema: t.function.parameters,
  }));
}

function fromAnthropicResponse(raw: Record<string, unknown>, model: string): CompletionResponse {
  const content = raw.content as Array<{ type: string; text?: string; id?: string; name?: string; input?: unknown }>;
  const usage = raw.usage as { input_tokens: number; output_tokens: number } | undefined;

  let textContent = '';
  const toolCalls: ToolCall[] = [];

  for (const block of content || []) {
    if (block.type === 'text') {
      textContent += block.text ?? '';
    } else if (block.type === 'tool_use') {
      toolCalls.push({
        id: block.id!,
        type: 'function',
        function: {
          name: block.name!,
          arguments: JSON.stringify(block.input),
        },
      });
    }
  }

  const stopReason = raw.stop_reason as string;
  let finishReason = 'stop';
  if (stopReason === 'tool_use') finishReason = 'tool_calls';
  else if (stopReason === 'max_tokens') finishReason = 'length';

  const message: ChatMessage = {
    role: 'assistant',
    content: textContent,
  };
  if (toolCalls.length > 0) {
    message.tool_calls = toolCalls;
  }

  return {
    id: (raw.id as string) || `chatcmpl-${Date.now()}`,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        message,
        finish_reason: finishReason,
      },
    ],
    usage: {
      prompt_tokens: usage?.input_tokens ?? 0,
      completion_tokens: usage?.output_tokens ?? 0,
      total_tokens: (usage?.input_tokens ?? 0) + (usage?.output_tokens ?? 0),
    },
  };
}

async function anthropicAdapter(opts: RouteOptions): Promise<CompletionResponse> {
  const { system, messages } = toAnthropicMessages(opts.messages);

  const body: Record<string, unknown> = {
    model: opts.model.replace('anthropic/', ''),
    messages,
    max_tokens: opts.max_tokens ?? 4096,
    stream: false,
  };
  if (system) body.system = system;
  if (opts.tools?.length) body.tools = toAnthropicTools(opts.tools);
  if (opts.temperature != null) body.temperature = opts.temperature;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': opts.providerApiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${text}`);
  }

  const raw = (await res.json()) as Record<string, unknown>;
  return fromAnthropicResponse(raw, opts.model);
}

async function anthropicStreamAdapter(opts: RouteOptions): Promise<ReadableStream<Uint8Array>> {
  const { system, messages } = toAnthropicMessages(opts.messages);

  const body: Record<string, unknown> = {
    model: opts.model.replace('anthropic/', ''),
    messages,
    max_tokens: opts.max_tokens ?? 4096,
    stream: true,
  };
  if (system) body.system = system;
  if (opts.tools?.length) body.tools = toAnthropicTools(opts.tools);
  if (opts.temperature != null) body.temperature = opts.temperature;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': opts.providerApiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${text}`);
  }

  // Transform Anthropic SSE stream to OpenAI SSE format
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const reader = (res.body as ReadableStream<Uint8Array>).getReader();

  let buffer = '';
  const completionId = `chatcmpl-${Date.now()}`;
  const created = Math.floor(Date.now() / 1000);

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) {
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
        return;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const payload = line.slice(6).trim();
        if (!payload || payload === '[DONE]') continue;

        try {
          const event = JSON.parse(payload);
          const chunk = convertAnthropicStreamEvent(event, completionId, created, opts.model);
          if (chunk) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
          }
        } catch {
          // Skip unparseable events
        }
      }
    },
  });
}

function convertAnthropicStreamEvent(
  event: Record<string, unknown>,
  id: string,
  created: number,
  model: string,
): StreamChunk | null {
  const type = event.type as string;

  if (type === 'content_block_delta') {
    const delta = event.delta as Record<string, unknown>;
    if (delta.type === 'text_delta') {
      return {
        id,
        object: 'chat.completion.chunk',
        created,
        model,
        choices: [
          {
            index: 0,
            delta: { content: delta.text as string },
            finish_reason: null,
          },
        ],
      };
    }
    if (delta.type === 'input_json_delta') {
      // Tool call argument delta — we accumulate on the client side
      return {
        id,
        object: 'chat.completion.chunk',
        created,
        model,
        choices: [
          {
            index: 0,
            delta: {
              tool_calls: [
                {
                  id: '',
                  type: 'function',
                  function: { name: '', arguments: delta.partial_json as string },
                },
              ],
            },
            finish_reason: null,
          },
        ],
      };
    }
  }

  if (type === 'content_block_start') {
    const contentBlock = event.content_block as Record<string, unknown>;
    if (contentBlock?.type === 'tool_use') {
      return {
        id,
        object: 'chat.completion.chunk',
        created,
        model,
        choices: [
          {
            index: 0,
            delta: {
              tool_calls: [
                {
                  id: contentBlock.id as string,
                  type: 'function',
                  function: { name: contentBlock.name as string, arguments: '' },
                },
              ],
            },
            finish_reason: null,
          },
        ],
      };
    }
  }

  if (type === 'message_delta') {
    const delta = event.delta as Record<string, unknown>;
    const stopReason = delta?.stop_reason as string;
    let finishReason = 'stop';
    if (stopReason === 'tool_use') finishReason = 'tool_calls';
    else if (stopReason === 'max_tokens') finishReason = 'length';

    return {
      id,
      object: 'chat.completion.chunk',
      created,
      model,
      choices: [
        {
          index: 0,
          delta: {},
          finish_reason: finishReason,
        },
      ],
    };
  }

  return null;
}

// ─── Gemini Adapter ─────────────────────────────────────────────────────────

function toGeminiContents(messages: ChatMessage[]): {
  systemInstruction?: { parts: Array<{ text: string }> };
  contents: Array<{ role: string; parts: Array<Record<string, unknown>> }>;
} {
  let systemInstruction: { parts: Array<{ text: string }> } | undefined;
  const contents: Array<{ role: string; parts: Array<Record<string, unknown>> }> = [];

  for (const msg of messages) {
    if (msg.role === 'system') {
      const text = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
      systemInstruction = { parts: [{ text }] };
      continue;
    }

    if (msg.role === 'tool') {
      contents.push({
        role: 'user',
        parts: [
          {
            functionResponse: {
              name: msg.name || 'unknown',
              response: {
                result: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
              },
            },
          },
        ],
      });
      continue;
    }

    if (msg.role === 'assistant' && msg.tool_calls?.length) {
      const parts: Array<Record<string, unknown>> = [];
      if (msg.content && typeof msg.content === 'string' && msg.content.length > 0) {
        parts.push({ text: msg.content });
      }
      for (const tc of msg.tool_calls) {
        parts.push({
          functionCall: {
            name: tc.function.name,
            args: JSON.parse(tc.function.arguments),
          },
        });
      }
      contents.push({ role: 'model', parts });
      continue;
    }

    const role = msg.role === 'assistant' ? 'model' : 'user';
    const text = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
    contents.push({ role, parts: [{ text }] });
  }

  return { systemInstruction, contents };
}

function toGeminiTools(tools: ToolDefinition[]): Array<Record<string, unknown>> {
  return [
    {
      functionDeclarations: tools.map((t) => ({
        name: t.function.name,
        description: t.function.description,
        parameters: t.function.parameters,
      })),
    },
  ];
}

function fromGeminiResponse(raw: Record<string, unknown>, model: string): CompletionResponse {
  const candidates = raw.candidates as Array<Record<string, unknown>> | undefined;
  const candidate = candidates?.[0];
  const content = candidate?.content as { parts: Array<Record<string, unknown>> } | undefined;
  const usageMetadata = raw.usageMetadata as Record<string, number> | undefined;

  let textContent = '';
  const toolCalls: ToolCall[] = [];

  for (const part of content?.parts || []) {
    if (part.text) {
      textContent += part.text as string;
    }
    if (part.functionCall) {
      const fc = part.functionCall as { name: string; args: unknown };
      toolCalls.push({
        id: `call_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        type: 'function',
        function: {
          name: fc.name,
          arguments: JSON.stringify(fc.args),
        },
      });
    }
  }

  const finishReason = candidate?.finishReason as string;
  let mappedFinish = 'stop';
  if (toolCalls.length > 0) mappedFinish = 'tool_calls';
  else if (finishReason === 'MAX_TOKENS') mappedFinish = 'length';

  const message: ChatMessage = {
    role: 'assistant',
    content: textContent,
  };
  if (toolCalls.length > 0) {
    message.tool_calls = toolCalls;
  }

  return {
    id: `chatcmpl-${Date.now()}`,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        message,
        finish_reason: mappedFinish,
      },
    ],
    usage: {
      prompt_tokens: usageMetadata?.promptTokenCount ?? 0,
      completion_tokens: usageMetadata?.candidatesTokenCount ?? 0,
      total_tokens: usageMetadata?.totalTokenCount ?? 0,
    },
  };
}

async function geminiAdapter(opts: RouteOptions): Promise<CompletionResponse> {
  const modelName = opts.model.replace('google/', '');
  const { systemInstruction, contents } = toGeminiContents(opts.messages);

  const body: Record<string, unknown> = { contents };
  if (systemInstruction) body.systemInstruction = systemInstruction;
  if (opts.tools?.length) body.tools = toGeminiTools(opts.tools);
  if (opts.temperature != null) {
    body.generationConfig = { temperature: opts.temperature, maxOutputTokens: opts.max_tokens ?? 4096 };
  } else {
    body.generationConfig = { maxOutputTokens: opts.max_tokens ?? 4096 };
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${opts.providerApiKey}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${text}`);
  }

  const raw = (await res.json()) as Record<string, unknown>;
  return fromGeminiResponse(raw, opts.model);
}

async function geminiStreamAdapter(opts: RouteOptions): Promise<ReadableStream<Uint8Array>> {
  const modelName = opts.model.replace('google/', '');
  const { systemInstruction, contents } = toGeminiContents(opts.messages);

  const body: Record<string, unknown> = { contents };
  if (systemInstruction) body.systemInstruction = systemInstruction;
  if (opts.tools?.length) body.tools = toGeminiTools(opts.tools);
  body.generationConfig = {
    maxOutputTokens: opts.max_tokens ?? 4096,
    ...(opts.temperature != null ? { temperature: opts.temperature } : {}),
  };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:streamGenerateContent?alt=sse&key=${opts.providerApiKey}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${text}`);
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const reader = (res.body as ReadableStream<Uint8Array>).getReader();
  const completionId = `chatcmpl-${Date.now()}`;
  const created = Math.floor(Date.now() / 1000);

  let buffer = '';

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) {
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
        return;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const payload = line.slice(6).trim();
        if (!payload) continue;

        try {
          const event = JSON.parse(payload);
          const candidates = event.candidates as Array<Record<string, unknown>> | undefined;
          const parts = (candidates?.[0]?.content as Record<string, unknown>)?.parts as Array<Record<string, unknown>> | undefined;

          for (const part of parts || []) {
            if (part.text) {
              const chunk: StreamChunk = {
                id: completionId,
                object: 'chat.completion.chunk',
                created,
                model: opts.model,
                choices: [
                  {
                    index: 0,
                    delta: { content: part.text as string },
                    finish_reason: null,
                  },
                ],
              };
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
            }
          }
        } catch {
          // Skip
        }
      }
    },
  });
}
