export const createComputerSchema = {
  body: {
    type: 'object',
    required: ['name'],
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 255 },
      cpu: { type: 'integer', minimum: 1, maximum: 16, default: 2 },
      ram: { type: 'integer', minimum: 512, maximum: 32768, default: 4096 },
      gpu: { type: 'string', maxLength: 128 },
      resolution: {
        type: 'string',
        pattern: '^\\d+x\\d+x\\d+$',
        default: '1280x720x24',
      },
      template: { type: 'string', maxLength: 255 },
    },
    additionalProperties: false,
  },
  params: {
    type: 'object',
    required: ['workspaceId'],
    properties: {
      workspaceId: { type: 'string', format: 'uuid' },
    },
  },
} as const;

export const computerParamsSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string', format: 'uuid' },
    },
  },
} as const;

export const listComputersSchema = {
  params: {
    type: 'object',
    required: ['workspaceId'],
    properties: {
      workspaceId: { type: 'string', format: 'uuid' },
    },
  },
  querystring: {
    type: 'object',
    properties: {
      status: {
        type: 'string',
        enum: ['creating', 'starting', 'running', 'stopping', 'stopped', 'error'],
      },
    },
  },
} as const;
