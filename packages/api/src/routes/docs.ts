/**
 * Documentation routes.
 *
 * - GET /openapi.json — serves the OpenAPI 3.1 specification
 * - GET /docs — serves Swagger UI
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { openApiSpec } from '../openapi.js';

const SWAGGER_UI_CDN = 'https://cdn.jsdelivr.net/npm/swagger-ui-dist@5';

function swaggerHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Bottleneck Bots API — Documentation</title>
  <link rel="stylesheet" href="${SWAGGER_UI_CDN}/swagger-ui.css" />
  <style>
    body { margin: 0; padding: 0; }
    .topbar { display: none; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="${SWAGGER_UI_CDN}/swagger-ui-bundle.js"></script>
  <script>
    SwaggerUIBundle({
      url: '/openapi.json',
      dom_id: '#swagger-ui',
      deepLinking: true,
      presets: [
        SwaggerUIBundle.presets.apis,
        SwaggerUIBundle.SwaggerUIStandalonePreset,
      ],
      layout: 'BaseLayout',
    });
  </script>
</body>
</html>`;
}

export async function docsRoutes(app: FastifyInstance): Promise<void> {
  // Serve OpenAPI JSON spec
  app.get('/openapi.json', { schema: { hide: true } as any }, async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply
      .header('Content-Type', 'application/json')
      .header('Cache-Control', 'public, max-age=3600')
      .send(openApiSpec);
  });

  // Serve Swagger UI
  app.get('/docs', { schema: { hide: true } as any }, async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply
      .header('Content-Type', 'text/html; charset=utf-8')
      .send(swaggerHtml());
  });
}
