/**
 * POST /v1/chat/completions — OpenAI-compatible proxy endpoint.
 *
 * Accepts the standard OpenAI chat completions request format and routes
 * to the appropriate provider (Anthropic, OpenAI, Google) based on model name.
 *
 * Extra fields:
 * - computer_id: string — attach computer_use tools and enable auto-execution
 * - auto_execute_tools: boolean (default true when computer_id is set)
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { detectProvider, routeToProvider, routeToProviderStream } from '../../services/model-router.js';
import type { ChatMessage, RouteOptions } from '../../services/model-router.js';
import { COMPUTER_TOOLS } from '../../services/tool-definitions.js';
import { executeWithTools } from '../../services/tool-executor.js';
import { getProviderKey, type ProviderName } from '../../db/provider-keys.js';
import { eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { workspaces } from '../../db/schema.js';

interface ChatCompletionBody {
  model: string;
  messages: ChatMessage[];
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
  tools?: Array<Record<string, unknown>>;
  // Orgo extensions
  computer_id?: string;
  auto_execute_tools?: boolean;
  workspace_id?: string;
}

export async function chatCompletionsRoutes(app: FastifyInstance): Promise<void> {
  app.post('/chat/completions', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as ChatCompletionBody;

    // ── Validate required fields ──────────────────────────────────────────────
    if (!body.model) {
      return reply.status(400).send({
        error: {
          message: 'model is required',
          type: 'invalid_request_error',
          code: 'missing_model',
        },
      });
    }
    if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
      return reply.status(400).send({
        error: {
          message: 'messages is required and must be a non-empty array',
          type: 'invalid_request_error',
          code: 'missing_messages',
        },
      });
    }

    // ── Resolve provider API key ──────────────────────────────────────────────
    const provider = detectProvider(body.model) as ProviderName;
    let providerApiKey: string | null = null;

    // Try workspace-level key first
    const workspaceId = body.workspace_id ?? await resolveWorkspaceId(request);
    if (workspaceId) {
      providerApiKey = await getProviderKey(workspaceId, provider);
    }

    // Fall back to server-level env vars
    if (!providerApiKey) {
      providerApiKey = getEnvProviderKey(provider);
    }

    if (!providerApiKey) {
      return reply.status(400).send({
        error: {
          message: `No API key configured for provider "${provider}". Set a workspace key or server environment variable.`,
          type: 'invalid_request_error',
          code: 'missing_provider_key',
        },
      });
    }

    // ── Build tools list ──────────────────────────────────────────────────────
    const computerId = body.computer_id;
    const autoExecute = body.auto_execute_tools ?? (computerId ? true : false);

    // Merge user-provided tools with computer tools if computer_id is set
    let tools = body.tools as RouteOptions['tools'];
    if (computerId) {
      tools = [...(tools || []), ...COMPUTER_TOOLS];
    }

    // ── Build route options ───────────────────────────────────────────────────
    const opts: RouteOptions = {
      model: body.model,
      messages: body.messages,
      tools,
      stream: body.stream ?? false,
      temperature: body.temperature,
      max_tokens: body.max_tokens,
      providerApiKey,
    };

    try {
      // ── Streaming (no auto-execute) ─────────────────────────────────────────
      if (body.stream && !autoExecute) {
        const stream = await routeToProviderStream(opts);
        reply.raw.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        });

        const reader = stream.getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            reply.raw.write(value);
          }
        } finally {
          reader.releaseLock();
          reply.raw.end();
        }
        return;
      }

      // ── Auto-execute tool loop ──────────────────────────────────────────────
      if (computerId && autoExecute) {
        const result = await executeWithTools(computerId, opts);

        // Add metadata about tool execution to response
        const response = result.completion as unknown as Record<string, unknown>;
        response._orgo = {
          tool_rounds: result.toolRounds,
          computer_id: computerId,
          auto_executed: true,
        };

        return reply.send(response);
      }

      // ── Single-shot (no auto-execute) ───────────────────────────────────────
      const completion = await routeToProvider(opts);
      return reply.send(completion);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Internal proxy error';
      request.log.error(err, 'Chat completions proxy error');

      // Parse upstream status codes from error message
      const statusMatch = message.match(/error (\d{3}):/);
      const status = statusMatch ? parseInt(statusMatch[1]!, 10) : 502;

      return reply.status(status).send({
        error: {
          message,
          type: 'api_error',
          code: 'provider_error',
        },
      });
    }
  });
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Resolve workspace ID from the authenticated user's first workspace.
 */
async function resolveWorkspaceId(request: FastifyRequest): Promise<string | null> {
  const userId = request.currentUser?.id;
  if (!userId) return null;

  const [ws] = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(eq(workspaces.userId, userId))
    .limit(1);

  return ws?.id ?? null;
}

/**
 * Get provider API key from server environment variables.
 */
function getEnvProviderKey(provider: ProviderName): string | null {
  switch (provider) {
    case 'anthropic':
      return process.env.ANTHROPIC_API_KEY ?? null;
    case 'openai':
      return process.env.OPENAI_API_KEY ?? null;
    case 'google':
      return process.env.GOOGLE_API_KEY ?? null;
    default:
      return null;
  }
}
