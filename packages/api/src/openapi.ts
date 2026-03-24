/**
 * OpenAPI 3.1 Specification for the Bottleneck Bots API.
 *
 * Covers all REST endpoints: auth, workspaces, computers, actions,
 * templates, teams, invites, and the OpenAI-compatible v1 proxy.
 */

export const openApiSpec = {
  openapi: '3.1.0',
  info: {
    title: 'Bottleneck Bots API',
    version: '1.0.0',
    description:
      'Cloud desktop infrastructure for AI agents. Create virtual machines, control mouse/keyboard, take screenshots, and run agent loops — all via API.',
    contact: { name: 'Bottleneck Bots', url: 'https://github.com/bottleneck-bots/bottleneck-bots' },
    license: { name: 'MIT', url: 'https://opensource.org/licenses/MIT' },
  },
  servers: [
    { url: 'http://localhost:3000', description: 'Local development' },
    { url: 'https://api.bottleneckbots.com', description: 'Production' },
  ],
  tags: [
    { name: 'Health', description: 'Server health checks' },
    { name: 'Auth', description: 'Authentication, registration, and API key management' },
    { name: 'Workspaces', description: 'Workspace CRUD operations' },
    { name: 'Computers', description: 'Virtual machine lifecycle management' },
    { name: 'Actions', description: 'Desktop control — screenshot, click, type, scroll, bash' },
    { name: 'Templates', description: 'Custom VM template management' },
    { name: 'Teams', description: 'Workspace members and invitations' },
    { name: 'V1', description: 'OpenAI-compatible chat completions proxy' },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http' as const,
        scheme: 'bearer',
        description: 'API key in the format `sk_live_...`. Pass as `Authorization: Bearer sk_live_...`',
      },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          error: { type: 'string' },
          message: { type: 'string' },
        },
      },
      Workspace: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
          computerCount: { type: 'integer' },
        },
      },
      Computer: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          status: {
            type: 'string',
            enum: ['creating', 'starting', 'running', 'stopping', 'stopped', 'error'],
          },
          specs: {
            type: 'object',
            properties: {
              cpu: { type: 'integer' },
              ramMb: { type: 'integer' },
              diskGb: { type: 'integer' },
              gpu: { type: 'string', nullable: true },
            },
          },
          ipAddress: { type: 'string', nullable: true },
          vncPort: { type: 'integer', nullable: true },
          novncPort: { type: 'integer', nullable: true },
          novncUrl: { type: 'string', nullable: true },
          vncUrl: { type: 'string', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      Screenshot: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          duration_ms: { type: 'number' },
          image: { type: 'string', description: 'Base64-encoded image' },
          format: { type: 'string', enum: ['png', 'jpeg'] },
          width: { type: 'integer' },
          height: { type: 'integer' },
          timestamp: { type: 'string', format: 'date-time' },
          bytes: { type: 'integer' },
        },
      },
      ActionResult: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          duration_ms: { type: 'number' },
        },
      },
      ExecResult: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          duration_ms: { type: 'number' },
          stdout: { type: 'string' },
          stderr: { type: 'string' },
          exit_code: { type: 'integer' },
        },
      },
      Template: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          tags: { type: 'array', items: { type: 'string' } },
          size: { type: 'integer' },
          created: { type: 'string', format: 'date-time' },
        },
      },
      Member: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          userId: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          email: { type: 'string', format: 'email' },
          role: { type: 'string', enum: ['owner', 'admin', 'member'] },
          joinedAt: { type: 'string', format: 'date-time' },
        },
      },
      Invite: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          email: { type: 'string', format: 'email' },
          role: { type: 'string', enum: ['admin', 'member'] },
          status: { type: 'string', enum: ['pending', 'accepted', 'revoked', 'expired'] },
          expiresAt: { type: 'string', format: 'date-time' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      ChatCompletionRequest: {
        type: 'object',
        required: ['model', 'messages'],
        properties: {
          model: { type: 'string', description: 'Model identifier (e.g. claude-sonnet-4-20250514, gpt-4o, gemini-2.0-flash)' },
          messages: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                role: { type: 'string', enum: ['system', 'user', 'assistant'] },
                content: { type: 'string' },
              },
            },
          },
          stream: { type: 'boolean', default: false },
          temperature: { type: 'number' },
          max_tokens: { type: 'integer' },
          tools: { type: 'array', items: { type: 'object' } },
          computer_id: { type: 'string', description: 'Attach computer_use tools and auto-execute' },
          auto_execute_tools: { type: 'boolean', description: 'Auto-execute tool calls (default true when computer_id set)' },
          workspace_id: { type: 'string', description: 'Workspace ID for provider key resolution' },
        },
      },
      Model: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          object: { type: 'string', enum: ['model'] },
          created: { type: 'integer' },
          owned_by: { type: 'string' },
        },
      },
    },
  },
  security: [{ BearerAuth: [] }],
  paths: {
    // ── Health ──────────────────────────────────────────────────────────────
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Health check',
        security: [],
        responses: {
          200: {
            description: 'All systems healthy',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', enum: ['healthy', 'degraded'] },
                    version: { type: 'string' },
                    uptime: { type: 'integer' },
                    checks: {
                      type: 'object',
                      properties: {
                        database: { type: 'string' },
                        redis: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },

    // ── Auth ────────────────────────────────────────────────────────────────
    '/api/v1/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Register a new user',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'name', 'password'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  name: { type: 'string', minLength: 1, maxLength: 255 },
                  password: { type: 'string', minLength: 8, maxLength: 128 },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'User created' },
          400: { description: 'Validation error or duplicate email' },
        },
      },
    },
    '/api/v1/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Login with email and password',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'JWT tokens returned',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    access_token: { type: 'string' },
                    refresh_token: { type: 'string' },
                    token_type: { type: 'string' },
                    expires_in: { type: 'integer' },
                  },
                },
              },
            },
          },
          401: { description: 'Invalid credentials' },
        },
      },
    },
    '/api/v1/auth/refresh': {
      post: {
        tags: ['Auth'],
        summary: 'Refresh JWT tokens',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['refresh_token'],
                properties: {
                  refresh_token: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'New tokens returned' },
          401: { description: 'Invalid refresh token' },
        },
      },
    },
    '/api/v1/auth/api-keys': {
      post: {
        tags: ['Auth'],
        summary: 'Create a new API key (requires JWT)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name'],
                properties: {
                  name: { type: 'string', minLength: 1, maxLength: 255 },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: 'API key created. The full key is only shown once.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    api_key: { type: 'string', description: 'Full API key (sk_live_...)' },
                    id: { type: 'string', format: 'uuid' },
                    name: { type: 'string' },
                    prefix: { type: 'string' },
                    created_at: { type: 'string', format: 'date-time' },
                  },
                },
              },
            },
          },
        },
      },
      get: {
        tags: ['Auth'],
        summary: 'List API keys (requires JWT)',
        responses: {
          200: { description: 'List of API keys (prefixes only, no full keys)' },
        },
      },
    },
    '/api/v1/auth/api-keys/{id}': {
      delete: {
        tags: ['Auth'],
        summary: 'Revoke an API key',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          204: { description: 'API key revoked' },
          404: { description: 'API key not found' },
        },
      },
    },

    // ── Workspaces ──────────────────────────────────────────────────────────
    '/api/v1/workspaces': {
      post: {
        tags: ['Workspaces'],
        summary: 'Create a workspace',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name'],
                properties: {
                  name: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: 'Workspace created',
            content: { 'application/json': { schema: { type: 'object', properties: { workspace: { $ref: '#/components/schemas/Workspace' } } } } },
          },
        },
      },
      get: {
        tags: ['Workspaces'],
        summary: 'List workspaces',
        responses: {
          200: {
            description: 'Array of workspaces with computer counts',
            content: { 'application/json': { schema: { type: 'object', properties: { workspaces: { type: 'array', items: { $ref: '#/components/schemas/Workspace' } } } } } },
          },
        },
      },
    },
    '/api/v1/workspaces/{id}': {
      get: {
        tags: ['Workspaces'],
        summary: 'Get workspace with computers',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          200: { description: 'Workspace details with computers list' },
          404: { description: 'Workspace not found' },
        },
      },
      patch: {
        tags: ['Workspaces'],
        summary: 'Update workspace name',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['name'], properties: { name: { type: 'string' } } } } },
        },
        responses: {
          200: { description: 'Workspace updated' },
        },
      },
      delete: {
        tags: ['Workspaces'],
        summary: 'Delete workspace',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          { name: 'force', in: 'query', schema: { type: 'string', enum: ['true'] }, description: 'Force delete even with running computers' },
        ],
        responses: {
          200: { description: 'Workspace deleted' },
          409: { description: 'Workspace has running computers' },
        },
      },
    },

    // ── Computers ───────────────────────────────────────────────────────────
    '/api/v1/workspaces/{workspaceId}/computers': {
      post: {
        tags: ['Computers'],
        summary: 'Create a computer',
        parameters: [
          { name: 'workspaceId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name'],
                properties: {
                  name: { type: 'string' },
                  cpu: { type: 'integer', default: 2 },
                  ram: { type: 'integer', default: 4096, description: 'RAM in MB' },
                  gpu: { type: 'string' },
                  resolution: { type: 'string', default: '1280x720x24' },
                  template: { type: 'string', description: 'Docker template image name' },
                },
              },
            },
          },
        },
        responses: {
          202: {
            description: 'Computer creation started',
            content: { 'application/json': { schema: { type: 'object', properties: { computer: { $ref: '#/components/schemas/Computer' } } } } },
          },
        },
      },
      get: {
        tags: ['Computers'],
        summary: 'List computers in workspace',
        parameters: [
          { name: 'workspaceId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['creating', 'starting', 'running', 'stopping', 'stopped', 'error'] } },
        ],
        responses: {
          200: {
            description: 'Array of computers',
            content: { 'application/json': { schema: { type: 'object', properties: { computers: { type: 'array', items: { $ref: '#/components/schemas/Computer' } } } } } },
          },
        },
      },
    },
    '/api/v1/computers/{id}': {
      get: {
        tags: ['Computers'],
        summary: 'Get computer details',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          200: {
            description: 'Computer details with connection URLs when running',
            content: { 'application/json': { schema: { type: 'object', properties: { computer: { $ref: '#/components/schemas/Computer' } } } } },
          },
          404: { description: 'Computer not found' },
        },
      },
      delete: {
        tags: ['Computers'],
        summary: 'Destroy a computer',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          202: { description: 'Destroy initiated' },
          404: { description: 'Computer not found' },
        },
      },
    },
    '/api/v1/computers/{id}/start': {
      post: {
        tags: ['Computers'],
        summary: 'Start a stopped computer',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          202: { description: 'Start initiated' },
          409: { description: 'Invalid state transition' },
        },
      },
    },
    '/api/v1/computers/{id}/stop': {
      post: {
        tags: ['Computers'],
        summary: 'Stop a running computer',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          202: { description: 'Stop initiated' },
          409: { description: 'Invalid state transition' },
        },
      },
    },
    '/api/v1/computers/{id}/restart': {
      post: {
        tags: ['Computers'],
        summary: 'Restart a computer',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          200: { description: 'Restart initiated' },
          404: { description: 'Computer not found' },
        },
      },
    },

    // ── Actions ─────────────────────────────────────────────────────────────
    '/api/v1/computers/{id}/screenshot': {
      get: {
        tags: ['Actions'],
        summary: 'Take a screenshot',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          { name: 'format', in: 'query', schema: { type: 'string', enum: ['png', 'jpeg'], default: 'png' } },
          { name: 'quality', in: 'query', schema: { type: 'integer', default: 70, minimum: 1, maximum: 100 } },
        ],
        responses: {
          200: {
            description: 'Screenshot data (JSON with base64 or raw image depending on Accept header)',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Screenshot' } } },
          },
          502: { description: 'Action failed on the computer' },
        },
      },
    },
    '/api/v1/computers/{id}/click': {
      post: {
        tags: ['Actions'],
        summary: 'Left click at coordinates',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['x', 'y'], properties: { x: { type: 'integer' }, y: { type: 'integer' } } } } },
        },
        responses: {
          200: { description: 'Click executed', content: { 'application/json': { schema: { $ref: '#/components/schemas/ActionResult' } } } },
        },
      },
    },
    '/api/v1/computers/{id}/right-click': {
      post: {
        tags: ['Actions'],
        summary: 'Right click at coordinates',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['x', 'y'], properties: { x: { type: 'integer' }, y: { type: 'integer' } } } } },
        },
        responses: {
          200: { description: 'Right click executed' },
        },
      },
    },
    '/api/v1/computers/{id}/double-click': {
      post: {
        tags: ['Actions'],
        summary: 'Double click at coordinates',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['x', 'y'], properties: { x: { type: 'integer' }, y: { type: 'integer' } } } } },
        },
        responses: {
          200: { description: 'Double click executed' },
        },
      },
    },
    '/api/v1/computers/{id}/scroll': {
      post: {
        tags: ['Actions'],
        summary: 'Scroll at position',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['x', 'y', 'direction', 'amount'],
                properties: {
                  x: { type: 'integer' },
                  y: { type: 'integer' },
                  direction: { type: 'string', enum: ['up', 'down', 'left', 'right'] },
                  amount: { type: 'integer' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Scroll executed' },
        },
      },
    },
    '/api/v1/computers/{id}/drag': {
      post: {
        tags: ['Actions'],
        summary: 'Drag from one point to another',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['start_x', 'start_y', 'end_x', 'end_y'],
                properties: {
                  start_x: { type: 'integer' },
                  start_y: { type: 'integer' },
                  end_x: { type: 'integer' },
                  end_y: { type: 'integer' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Drag executed' },
        },
      },
    },
    '/api/v1/computers/{id}/move': {
      post: {
        tags: ['Actions'],
        summary: 'Move mouse cursor',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['x', 'y'], properties: { x: { type: 'integer' }, y: { type: 'integer' } } } } },
        },
        responses: {
          200: { description: 'Cursor moved' },
        },
      },
    },
    '/api/v1/computers/{id}/type': {
      post: {
        tags: ['Actions'],
        summary: 'Type text',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['text'], properties: { text: { type: 'string' } } } } },
        },
        responses: {
          200: { description: 'Text typed' },
          400: { description: 'Invalid input (null bytes)' },
        },
      },
    },
    '/api/v1/computers/{id}/key': {
      post: {
        tags: ['Actions'],
        summary: 'Press a key combination',
        description: 'Supports single keys (Return, Escape, Tab) and combos (ctrl+c, shift+alt+f1).',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['key'], properties: { key: { type: 'string', description: 'Key combo string, e.g. "ctrl+c", "Return", "alt+F4"' } } } } },
        },
        responses: {
          200: { description: 'Key pressed' },
          400: { description: 'Invalid key combo' },
        },
      },
    },
    '/api/v1/computers/{id}/clipboard': {
      get: {
        tags: ['Actions'],
        summary: 'Read clipboard contents',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          200: { description: 'Clipboard text', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, text: { type: 'string' } } } } } },
        },
      },
      post: {
        tags: ['Actions'],
        summary: 'Write to clipboard',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['text'], properties: { text: { type: 'string' } } } } },
        },
        responses: {
          200: { description: 'Clipboard written' },
        },
      },
    },
    '/api/v1/computers/{id}/bash': {
      post: {
        tags: ['Actions'],
        summary: 'Execute a bash command',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['command'],
                properties: {
                  command: { type: 'string' },
                  timeout: { type: 'integer', default: 30, description: 'Timeout in seconds' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Command result', content: { 'application/json': { schema: { $ref: '#/components/schemas/ExecResult' } } } },
        },
      },
    },
    '/api/v1/computers/{id}/exec': {
      post: {
        tags: ['Actions'],
        summary: 'Execute code in a language runtime',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['code', 'language'],
                properties: {
                  code: { type: 'string' },
                  language: { type: 'string', description: 'e.g. "python", "node"' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Execution result', content: { 'application/json': { schema: { $ref: '#/components/schemas/ExecResult' } } } },
        },
      },
    },
    '/api/v1/computers/{id}/actions': {
      post: {
        tags: ['Actions'],
        summary: 'Execute a batch of actions sequentially',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['actions'],
                properties: {
                  actions: {
                    type: 'array',
                    items: {
                      type: 'object',
                      required: ['action'],
                      properties: {
                        action: { type: 'string' },
                        params: { type: 'object' },
                      },
                    },
                  },
                  continue_on_error: { type: 'boolean', default: false },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Batch results',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    duration_ms: { type: 'number' },
                    results: { type: 'array', items: { $ref: '#/components/schemas/ActionResult' } },
                    completed: { type: 'integer' },
                    total: { type: 'integer' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/v1/computers/{id}/logs': {
      get: {
        tags: ['Computers'],
        summary: 'Get computer container logs',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          { name: 'tail', in: 'query', schema: { type: 'string', default: '100' } },
          { name: 'since', in: 'query', schema: { type: 'string', format: 'date-time' } },
        ],
        responses: {
          200: { description: 'Container logs' },
          404: { description: 'Computer not found' },
        },
      },
    },
    '/api/v1/computers/{id}/stats': {
      get: {
        tags: ['Computers'],
        summary: 'Get computer resource usage',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          200: {
            description: 'Resource stats',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    cpu: {
                      type: 'object',
                      properties: { percent: { type: 'number' }, cores: { type: 'integer' } },
                    },
                    memory: {
                      type: 'object',
                      properties: { usage: { type: 'integer' }, limit: { type: 'integer' }, percent: { type: 'number' } },
                    },
                    pids: { type: 'integer' },
                  },
                },
              },
            },
          },
        },
      },
    },

    // ── Templates ───────────────────────────────────────────────────────────
    '/api/v1/templates': {
      get: {
        tags: ['Templates'],
        summary: 'List available templates',
        responses: {
          200: {
            description: 'Array of templates',
            content: { 'application/json': { schema: { type: 'object', properties: { templates: { type: 'array', items: { $ref: '#/components/schemas/Template' } } } } } },
          },
        },
      },
    },
    '/api/v1/templates/build': {
      post: {
        tags: ['Templates'],
        summary: 'Build a custom template',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name'],
                properties: {
                  name: { type: 'string' },
                  base: { type: 'string', default: 'bottleneck-desktop-base:latest' },
                  instructions: {
                    type: 'array',
                    items: {
                      type: 'object',
                      required: ['type', 'args'],
                      properties: {
                        type: { type: 'string', enum: ['run', 'copy', 'env', 'workdir', 'clone'] },
                        args: { type: 'array', items: { type: 'string' } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Template built successfully' },
          400: { description: 'Missing template name' },
        },
      },
    },
    '/api/v1/templates/{name}': {
      delete: {
        tags: ['Templates'],
        summary: 'Delete a template',
        parameters: [
          { name: 'name', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          200: { description: 'Template deleted' },
          404: { description: 'Template not found' },
        },
      },
    },

    // ── Teams (Members) ─────────────────────────────────────────────────────
    '/api/v1/workspaces/{id}/members': {
      get: {
        tags: ['Teams'],
        summary: 'List workspace members',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          200: {
            description: 'Array of members',
            content: { 'application/json': { schema: { type: 'object', properties: { members: { type: 'array', items: { $ref: '#/components/schemas/Member' } } } } } },
          },
        },
      },
    },
    '/api/v1/workspaces/{id}/members/{userId}': {
      patch: {
        tags: ['Teams'],
        summary: 'Update member role (owner only)',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          { name: 'userId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['role'], properties: { role: { type: 'string', enum: ['admin', 'member'] } } } } },
        },
        responses: {
          200: { description: 'Role updated' },
          400: { description: 'Cannot change own role' },
        },
      },
      delete: {
        tags: ['Teams'],
        summary: 'Remove a member (owner/admin)',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          { name: 'userId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          200: { description: 'Member removed' },
          403: { description: 'Cannot remove owner or insufficient permissions' },
        },
      },
    },
    '/api/v1/workspaces/{id}/leave': {
      post: {
        tags: ['Teams'],
        summary: 'Leave a workspace',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          200: { description: 'Left workspace' },
          400: { description: 'Owners cannot leave' },
        },
      },
    },

    // ── Invites ─────────────────────────────────────────────────────────────
    '/api/v1/workspaces/{id}/invites': {
      post: {
        tags: ['Teams'],
        summary: 'Send a workspace invite',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'role'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  role: { type: 'string', enum: ['admin', 'member'] },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Invite sent', content: { 'application/json': { schema: { type: 'object', properties: { invite: { $ref: '#/components/schemas/Invite' } } } } } },
          400: { description: 'User already a member or invite pending' },
        },
      },
      get: {
        tags: ['Teams'],
        summary: 'List pending invites',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          200: { description: 'Pending invites' },
        },
      },
    },
    '/api/v1/workspaces/{id}/invites/{inviteId}': {
      delete: {
        tags: ['Teams'],
        summary: 'Revoke an invite',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          { name: 'inviteId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          200: { description: 'Invite revoked' },
          400: { description: 'Invite not pending' },
        },
      },
    },
    '/api/v1/invites/{token}/accept': {
      post: {
        tags: ['Teams'],
        summary: 'Accept a workspace invite',
        security: [],
        parameters: [
          { name: 'token', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          200: { description: 'Joined workspace or signup required' },
          400: { description: 'Invite expired, revoked, or already accepted' },
        },
      },
    },

    // ── V1 OpenAI-compatible ────────────────────────────────────────────────
    '/v1/chat/completions': {
      post: {
        tags: ['V1'],
        summary: 'Chat completions (OpenAI-compatible)',
        description:
          'Routes to Anthropic, OpenAI, or Google based on the model name. Supports streaming, tool use, and automatic computer_use tool execution when computer_id is set.',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ChatCompletionRequest' } } },
        },
        responses: {
          200: { description: 'Chat completion response (OpenAI format)' },
          400: { description: 'Missing model or messages, or no provider key' },
          502: { description: 'Provider error' },
        },
      },
    },
    '/v1/models': {
      get: {
        tags: ['V1'],
        summary: 'List available models',
        responses: {
          200: {
            description: 'Model list (OpenAI format)',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    object: { type: 'string', enum: ['list'] },
                    data: { type: 'array', items: { $ref: '#/components/schemas/Model' } },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/v1/models/{model}': {
      get: {
        tags: ['V1'],
        summary: 'Get model details',
        parameters: [
          { name: 'model', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          200: { description: 'Model details', content: { 'application/json': { schema: { $ref: '#/components/schemas/Model' } } } },
          404: { description: 'Model not found' },
        },
      },
    },
  },
} as const;
