/**
 * V1 route group registration.
 *
 * Mounts all /v1/* endpoints under the /v1 prefix.
 */

import type { FastifyInstance } from 'fastify';
import { chatCompletionsRoutes } from './chat-completions.js';
import { modelsRoutes } from './models.js';

export async function v1Routes(app: FastifyInstance): Promise<void> {
  await app.register(chatCompletionsRoutes);
  await app.register(modelsRoutes);
}
