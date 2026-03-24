/**
 * CRUD routes for provider API keys.
 *
 * POST   /workspaces/:workspaceId/providers
 * GET    /workspaces/:workspaceId/providers
 * DELETE /workspaces/:workspaceId/providers/:keyId
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { verifyWorkspaceOwnership } from '../middleware/ownership.js';
import {
  createProviderKey,
  listProviderKeys,
  deleteProviderKey,
  type ProviderName,
} from '../db/provider-keys.js';

// ─── Request types ───────────────────────────────────────────────────────────

interface WorkspaceParams {
  workspaceId: string;
}

interface ProviderKeyParams {
  workspaceId: string;
  keyId: string;
}

interface CreateProviderKeyBody {
  provider: ProviderName;
  api_key: string;
  label?: string;
}

const VALID_PROVIDERS: ProviderName[] = ['anthropic', 'openai', 'google'];

// ─── Route plugin ────────────────────────────────────────────────────────────

export async function providerKeyRoutes(app: FastifyInstance): Promise<void> {
  /**
   * POST /workspaces/:workspaceId/providers
   * Store an encrypted provider API key for this workspace.
   */
  app.post<{ Params: WorkspaceParams; Body: CreateProviderKeyBody }>(
    '/workspaces/:workspaceId/providers',
    {
      preHandler: [verifyWorkspaceOwnership],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { workspaceId } = request.params as WorkspaceParams;
      const body = request.body as CreateProviderKeyBody;

      // Validate provider
      if (!body.provider || !VALID_PROVIDERS.includes(body.provider)) {
        return reply.status(400).send({
          error: 'invalid_request',
          message: `provider must be one of: ${VALID_PROVIDERS.join(', ')}`,
        });
      }

      // Validate api_key
      if (!body.api_key || typeof body.api_key !== 'string' || body.api_key.trim().length === 0) {
        return reply.status(400).send({
          error: 'invalid_request',
          message: 'api_key is required and must be a non-empty string',
        });
      }

      try {
        const result = await createProviderKey(
          workspaceId,
          body.provider,
          body.api_key,
          body.label,
        );

        return reply.status(201).send({
          id: result.id,
          provider: body.provider,
          label: body.label ?? null,
          message: 'Provider key stored successfully.',
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to store provider key';
        request.log.error(err, 'Failed to create provider key');

        // Encryption key not configured
        if (message.includes('PROVIDER_KEY_ENCRYPTION_KEY')) {
          return reply.status(500).send({
            error: 'configuration_error',
            message: 'Server encryption is not configured. Contact administrator.',
          });
        }

        return reply.status(500).send({
          error: 'internal_error',
          message,
        });
      }
    },
  );

  /**
   * GET /workspaces/:workspaceId/providers
   * List all provider keys for this workspace (does NOT return the actual key).
   */
  app.get<{ Params: WorkspaceParams }>(
    '/workspaces/:workspaceId/providers',
    {
      preHandler: [verifyWorkspaceOwnership],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { workspaceId } = request.params as WorkspaceParams;

      try {
        const keys = await listProviderKeys(workspaceId);

        return reply.send({
          data: keys.map((k) => ({
            id: k.id,
            provider: k.provider,
            label: k.label,
            created_at: k.createdAt.toISOString(),
          })),
        });
      } catch (err: unknown) {
        request.log.error(err, 'Failed to list provider keys');
        return reply.status(500).send({
          error: 'internal_error',
          message: 'Failed to list provider keys',
        });
      }
    },
  );

  /**
   * DELETE /workspaces/:workspaceId/providers/:keyId
   * Remove a provider key.
   */
  app.delete<{ Params: ProviderKeyParams }>(
    '/workspaces/:workspaceId/providers/:keyId',
    {
      preHandler: [verifyWorkspaceOwnership],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { workspaceId, keyId } = request.params as ProviderKeyParams;

      try {
        const deleted = await deleteProviderKey(keyId, workspaceId);

        if (!deleted) {
          return reply.status(404).send({
            error: 'not_found',
            message: 'Provider key not found or does not belong to this workspace.',
          });
        }

        return reply.status(200).send({
          message: 'Provider key deleted successfully.',
        });
      } catch (err: unknown) {
        request.log.error(err, 'Failed to delete provider key');
        return reply.status(500).send({
          error: 'internal_error',
          message: 'Failed to delete provider key',
        });
      }
    },
  );
}
