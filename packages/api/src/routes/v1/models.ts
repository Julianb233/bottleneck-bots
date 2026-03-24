/**
 * GET /v1/models — List available models from configured providers.
 *
 * Returns an OpenAI-compatible model listing.
 */

import type { FastifyInstance } from 'fastify';

interface ModelEntry {
  id: string;
  object: 'model';
  created: number;
  owned_by: string;
}

const AVAILABLE_MODELS: ModelEntry[] = [
  // Anthropic
  { id: 'claude-sonnet-4-20250514', object: 'model', created: 1700000000, owned_by: 'anthropic' },
  { id: 'claude-3-5-sonnet-20241022', object: 'model', created: 1700000000, owned_by: 'anthropic' },
  { id: 'claude-3-5-haiku-20241022', object: 'model', created: 1700000000, owned_by: 'anthropic' },
  { id: 'claude-3-opus-20240229', object: 'model', created: 1700000000, owned_by: 'anthropic' },

  // OpenAI
  { id: 'gpt-4o', object: 'model', created: 1700000000, owned_by: 'openai' },
  { id: 'gpt-4o-mini', object: 'model', created: 1700000000, owned_by: 'openai' },
  { id: 'gpt-4-turbo', object: 'model', created: 1700000000, owned_by: 'openai' },
  { id: 'o1-preview', object: 'model', created: 1700000000, owned_by: 'openai' },
  { id: 'o1-mini', object: 'model', created: 1700000000, owned_by: 'openai' },

  // Google
  { id: 'gemini-2.0-flash', object: 'model', created: 1700000000, owned_by: 'google' },
  { id: 'gemini-2.0-flash-lite', object: 'model', created: 1700000000, owned_by: 'google' },
  { id: 'gemini-1.5-pro', object: 'model', created: 1700000000, owned_by: 'google' },
  { id: 'gemini-1.5-flash', object: 'model', created: 1700000000, owned_by: 'google' },
];

export async function modelsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/models', async (_request, reply) => {
    return reply.send({
      object: 'list',
      data: AVAILABLE_MODELS,
    });
  });

  app.get('/models/:model', async (request, reply) => {
    const { model } = request.params as { model: string };
    const found = AVAILABLE_MODELS.find((m) => m.id === model);
    if (!found) {
      return reply.status(404).send({
        error: {
          message: `Model '${model}' not found.`,
          type: 'invalid_request_error',
          code: 'model_not_found',
        },
      });
    }
    return reply.send(found);
  });
}
