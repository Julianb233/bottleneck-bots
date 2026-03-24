import type { FastifyInstance } from 'fastify';
import { sendAction } from '../lib/action-proxy.js';
import { verifyComputerOwnership } from '../middleware/ownership.js';
import { registerActivityTracker } from '../middleware/activity-tracker.js';
import {
  screenshotQuerySchema,
  clickSchema,
  scrollSchema,
  dragSchema,
  moveSchema,
  typeSchema,
  keySchema,
  clipboardWriteSchema,
  bashSchema,
  execSchema,
  batchActionsSchema,
  validateKeyCombo,
  containsNullBytes,
} from '../schemas/actions.js';

export async function actionRoutes(app: FastifyInstance): Promise<void> {
  const preHandler = [verifyComputerOwnership];

  // Register activity tracking (debounced DB writes every 30s)
  await registerActivityTracker(app);

  // ── Screenshot ──────────────────────────────────────────────────────────────

  app.get('/computers/:id/screenshot', {
    preHandler,
    schema: screenshotQuerySchema,
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { format = 'png', quality = '70' } = request.query as Record<string, string>;

    const result = await sendAction(id, 'screenshot', {
      format,
      quality: parseInt(quality, 10),
    });

    // Never cache screenshots
    reply.header('Cache-Control', 'no-store');

    if (!result.success) {
      return reply.status(502).send({
        success: false,
        error: 'action_failed',
        message: result.error,
        duration_ms: result.duration_ms,
      });
    }

    const data = result.data as {
      image: string; format: string; width: number; height: number; bytes: number;
    };

    // Return raw binary if Accept header requests an image type
    const accept = request.headers.accept || '';
    if (accept.includes('image/png') || accept.includes('image/jpeg')) {
      const buf = Buffer.from(data.image, 'base64');
      return reply
        .header('Content-Type', `image/${data.format}`)
        .send(buf);
    }

    return reply.send({
      success: true,
      duration_ms: result.duration_ms,
      image: data.image,
      format: data.format,
      width: data.width,
      height: data.height,
      timestamp: new Date().toISOString(),
      bytes: data.bytes,
    });
  });

  // ── Mouse Actions ───────────────────────────────────────────────────────────

  app.post('/computers/:id/click', { preHandler, schema: clickSchema }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { x, y } = request.body as { x: number; y: number };
    const result = await sendAction(id, 'click', { x, y });
    if (!result.success) {
      return reply.status(502).send({ success: false, error: 'action_failed', message: result.error, duration_ms: result.duration_ms });
    }
    return reply.send({ success: true, duration_ms: result.duration_ms, ...result.data });
  });

  app.post('/computers/:id/right-click', { preHandler, schema: clickSchema }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { x, y } = request.body as { x: number; y: number };
    const result = await sendAction(id, 'right_click', { x, y });
    if (!result.success) {
      return reply.status(502).send({ success: false, error: 'action_failed', message: result.error, duration_ms: result.duration_ms });
    }
    return reply.send({ success: true, duration_ms: result.duration_ms, ...result.data });
  });

  app.post('/computers/:id/double-click', { preHandler, schema: clickSchema }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { x, y } = request.body as { x: number; y: number };
    const result = await sendAction(id, 'double_click', { x, y });
    if (!result.success) {
      return reply.status(502).send({ success: false, error: 'action_failed', message: result.error, duration_ms: result.duration_ms });
    }
    return reply.send({ success: true, duration_ms: result.duration_ms, ...result.data });
  });

  app.post('/computers/:id/scroll', { preHandler, schema: scrollSchema }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { x: number; y: number; direction: string; amount: number };
    const result = await sendAction(id, 'scroll', body);
    if (!result.success) {
      return reply.status(502).send({ success: false, error: 'action_failed', message: result.error, duration_ms: result.duration_ms });
    }
    return reply.send({ success: true, duration_ms: result.duration_ms, ...result.data });
  });

  app.post('/computers/:id/drag', { preHandler, schema: dragSchema }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { start_x, start_y, end_x, end_y } = request.body as Record<string, number>;
    const result = await sendAction(id, 'drag', { start_x, start_y, end_x, end_y });
    if (!result.success) {
      return reply.status(502).send({ success: false, error: 'action_failed', message: result.error, duration_ms: result.duration_ms });
    }
    return reply.send({ success: true, duration_ms: result.duration_ms, ...result.data });
  });

  app.post('/computers/:id/move', { preHandler, schema: moveSchema }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { x, y } = request.body as { x: number; y: number };
    const result = await sendAction(id, 'move', { x, y });
    if (!result.success) {
      return reply.status(502).send({ success: false, error: 'action_failed', message: result.error, duration_ms: result.duration_ms });
    }
    return reply.send({ success: true, duration_ms: result.duration_ms, ...result.data });
  });

  // ── Keyboard Actions ────────────────────────────────────────────────────────

  app.post('/computers/:id/type', { preHandler, schema: typeSchema }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { text } = request.body as { text: string };
    if (containsNullBytes(text)) {
      return reply.status(400).send({ success: false, error: 'invalid_input', message: 'Text must not contain null bytes' });
    }
    const result = await sendAction(id, 'type', { text });
    if (!result.success) {
      return reply.status(502).send({ success: false, error: 'action_failed', message: result.error, duration_ms: result.duration_ms });
    }
    return reply.send({ success: true, duration_ms: result.duration_ms, ...result.data });
  });

  app.post('/computers/:id/key', { preHandler, schema: keySchema }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { key } = request.body as { key: string };
    if (!validateKeyCombo(key)) {
      return reply.status(400).send({
        success: false,
        error: 'invalid_key',
        message: `Invalid key combo "${key}". Use format like "ctrl+c", "shift+alt+f1", or single chars.`,
      });
    }
    const result = await sendAction(id, 'key', { key });
    if (!result.success) {
      return reply.status(502).send({ success: false, error: 'action_failed', message: result.error, duration_ms: result.duration_ms });
    }
    return reply.send({ success: true, duration_ms: result.duration_ms, ...result.data });
  });

  // ── Clipboard ───────────────────────────────────────────────────────────────

  app.get('/computers/:id/clipboard', { preHandler }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await sendAction(id, 'clipboard_read', {});
    if (!result.success) {
      return reply.status(502).send({ success: false, error: 'action_failed', message: result.error, duration_ms: result.duration_ms });
    }
    return reply.send({ success: true, duration_ms: result.duration_ms, ...result.data });
  });

  app.post('/computers/:id/clipboard', { preHandler, schema: clipboardWriteSchema }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { text } = request.body as { text: string };
    if (containsNullBytes(text)) {
      return reply.status(400).send({ success: false, error: 'invalid_input', message: 'Text must not contain null bytes' });
    }
    const result = await sendAction(id, 'clipboard_write', { text });
    if (!result.success) {
      return reply.status(502).send({ success: false, error: 'action_failed', message: result.error, duration_ms: result.duration_ms });
    }
    return reply.send({ success: true, duration_ms: result.duration_ms, ...result.data });
  });

  // ── Execution ───────────────────────────────────────────────────────────────

  app.post('/computers/:id/bash', { preHandler, schema: bashSchema }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { command, timeout } = request.body as { command: string; timeout?: number };
    if (containsNullBytes(command)) {
      return reply.status(400).send({ success: false, error: 'invalid_input', message: 'Command must not contain null bytes' });
    }
    const timeoutSec = timeout ?? 30;
    const result = await sendAction(
      id,
      'bash',
      { command, timeout: timeoutSec },
      timeoutSec * 1000 + 5000, // extra 5s buffer for proxy overhead
    );
    if (!result.success) {
      return reply.status(502).send({ success: false, error: 'action_failed', message: result.error, duration_ms: result.duration_ms });
    }
    return reply.send({ success: true, duration_ms: result.duration_ms, ...result.data });
  });

  app.post('/computers/:id/exec', { preHandler, schema: execSchema }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { code, language } = request.body as { code: string; language: string };
    if (containsNullBytes(code)) {
      return reply.status(400).send({ success: false, error: 'invalid_input', message: 'Code must not contain null bytes' });
    }
    const result = await sendAction(id, 'exec', { code, language });
    if (!result.success) {
      return reply.status(502).send({ success: false, error: 'action_failed', message: result.error, duration_ms: result.duration_ms });
    }
    return reply.send({ success: true, duration_ms: result.duration_ms, ...result.data });
  });

  // ── Batch Actions ───────────────────────────────────────────────────────────

  app.post('/computers/:id/actions', { preHandler, schema: batchActionsSchema }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { actions, continue_on_error = false } = request.body as {
      actions: Array<{ action: string; params?: Record<string, unknown> }>;
      continue_on_error?: boolean;
    };

    const startTime = Date.now();
    const results: Array<{
      action: string;
      success: boolean;
      duration_ms: number;
      data?: Record<string, unknown>;
      error?: string;
    }> = [];

    for (const { action, params = {} } of actions) {
      const result = await sendAction(id, action, params);
      results.push({
        action,
        success: result.success,
        duration_ms: result.duration_ms,
        ...(result.success ? { data: result.data } : { error: result.error }),
      });
      if (!result.success && !continue_on_error) break;
    }

    const allSucceeded = results.every((r) => r.success);
    return reply.send({
      success: allSucceeded,
      duration_ms: Date.now() - startTime,
      results,
      completed: results.length,
      total: actions.length,
    });
  });
}
