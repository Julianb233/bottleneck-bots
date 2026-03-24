import type { FastifyInstance } from 'fastify';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | unknown[];
  tool_call_id?: string;
}

interface ChatRequest {
  model: string;
  messages: ChatMessage[];
  stream?: boolean;
  max_tokens?: number;
  extra_body?: {
    computer_id?: string;
    auto_execute_tools?: boolean;
  };
}

function getProvider(model: string): 'anthropic' | 'openai' | 'google' {
  if (model.startsWith('claude') || model.startsWith('anthropic/')) return 'anthropic';
  if (model.startsWith('gemini') || model.startsWith('google/')) return 'google';
  return 'openai';
}

export async function chatCompletionRoutes(app: FastifyInstance): Promise<void> {
  app.post('/v1/chat/completions', async (request, reply) => {
    const body = request.body as ChatRequest;
    const { model, extra_body } = body;
    const computerId = extra_body?.computer_id;
    const provider = getProvider(model);

    // If computer_id provided, inject computer_use tools
    const computerTools = computerId ? [{
      type: 'function' as const,
      function: {
        name: 'computer_screenshot',
        description: 'Take a screenshot of the desktop',
        parameters: { type: 'object', properties: {} },
      },
    }, {
      type: 'function' as const,
      function: {
        name: 'computer_click',
        description: 'Click at coordinates',
        parameters: {
          type: 'object',
          required: ['x', 'y'],
          properties: { x: { type: 'number' }, y: { type: 'number' } },
        },
      },
    }, {
      type: 'function' as const,
      function: {
        name: 'computer_type',
        description: 'Type text',
        parameters: {
          type: 'object',
          required: ['text'],
          properties: { text: { type: 'string' } },
        },
      },
    }, {
      type: 'function' as const,
      function: {
        name: 'computer_key',
        description: 'Press key combination',
        parameters: {
          type: 'object',
          required: ['key'],
          properties: { key: { type: 'string' } },
        },
      },
    }, {
      type: 'function' as const,
      function: {
        name: 'computer_bash',
        description: 'Execute bash command',
        parameters: {
          type: 'object',
          required: ['command'],
          properties: { command: { type: 'string' } },
        },
      },
    }] : [];

    // For now, return a structured response indicating routing
    // Full provider routing requires stored API keys (future enhancement)
    return reply.send({
      id: `chatcmpl-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model,
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: `[Bottleneck Proxy] Would route to ${provider}. Computer: ${computerId || 'none'}. Tools: ${computerTools.length} injected.`,
        },
        finish_reason: 'stop',
      }],
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      _orgo: {
        provider,
        computer_id: computerId,
        tools_injected: computerTools.length,
      },
    });
  });
}
