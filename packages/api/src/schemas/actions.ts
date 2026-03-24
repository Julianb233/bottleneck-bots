// ─── Action JSON Schemas ────────────────────────────────────────────────────
// Fastify JSON Schema validation for desktop action endpoints.

export const coordinateProperties = {
  x: { type: 'number', minimum: 0, maximum: 32767 },
  y: { type: 'number', minimum: 0, maximum: 32767 },
} as const;

export const screenshotQuerySchema = {
  querystring: {
    type: 'object',
    properties: {
      format: { type: 'string', enum: ['png', 'jpeg'], default: 'png' },
      quality: { type: 'number', minimum: 1, maximum: 100, default: 70 },
    },
  },
} as const;

export const clickSchema = {
  body: {
    type: 'object',
    required: ['x', 'y'],
    properties: {
      ...coordinateProperties,
    },
    additionalProperties: false,
  },
} as const;

export const scrollSchema = {
  body: {
    type: 'object',
    properties: {
      x: { type: 'number', minimum: 0, maximum: 32767 },
      y: { type: 'number', minimum: 0, maximum: 32767 },
      direction: { type: 'string', enum: ['up', 'down', 'left', 'right'], default: 'down' },
      amount: { type: 'number', minimum: 1, maximum: 50, default: 3 },
    },
    additionalProperties: false,
  },
} as const;

export const dragSchema = {
  body: {
    type: 'object',
    required: ['start_x', 'start_y', 'end_x', 'end_y'],
    properties: {
      start_x: { type: 'number', minimum: 0, maximum: 32767 },
      start_y: { type: 'number', minimum: 0, maximum: 32767 },
      end_x: { type: 'number', minimum: 0, maximum: 32767 },
      end_y: { type: 'number', minimum: 0, maximum: 32767 },
    },
    additionalProperties: false,
  },
} as const;

export const moveSchema = {
  body: {
    type: 'object',
    required: ['x', 'y'],
    properties: {
      ...coordinateProperties,
    },
    additionalProperties: false,
  },
} as const;

export const typeSchema = {
  body: {
    type: 'object',
    required: ['text'],
    properties: {
      text: { type: 'string', minLength: 1, maxLength: 10000 },
    },
    additionalProperties: false,
  },
} as const;

export const keySchema = {
  body: {
    type: 'object',
    required: ['key'],
    properties: {
      key: {
        type: 'string',
        minLength: 1,
        maxLength: 100,
        pattern: '^[a-zA-Z0-9_+\\-]+$',
      },
    },
    additionalProperties: false,
  },
} as const;

export const clipboardWriteSchema = {
  body: {
    type: 'object',
    required: ['text'],
    properties: {
      text: { type: 'string', maxLength: 1048576 },
    },
    additionalProperties: false,
  },
} as const;

export const bashSchema = {
  body: {
    type: 'object',
    required: ['command'],
    properties: {
      command: { type: 'string', minLength: 1 },
      timeout: { type: 'number', minimum: 1, maximum: 300, default: 30 },
    },
    additionalProperties: false,
  },
} as const;

export const execSchema = {
  body: {
    type: 'object',
    required: ['code'],
    properties: {
      code: { type: 'string', minLength: 1 },
      language: {
        type: 'string',
        enum: ['python', 'python3', 'node', 'javascript', 'bash', 'shell'],
        default: 'bash',
      },
      timeout: { type: 'number', minimum: 1, maximum: 300, default: 30 },
    },
    additionalProperties: false,
  },
} as const;

export const batchActionsSchema = {
  body: {
    type: 'object',
    required: ['actions'],
    properties: {
      actions: {
        type: 'array',
        items: {
          type: 'object',
          required: ['action'],
          properties: {
            action: {
              type: 'string',
              enum: [
                'click', 'right-click', 'double-click', 'scroll', 'drag', 'move',
                'type', 'key', 'clipboard_read', 'clipboard_write',
                'bash', 'exec', 'screenshot',
              ],
            },
            params: { type: 'object', default: {} },
          },
          additionalProperties: false,
        },
        minItems: 1,
        maxItems: 50,
      },
      continue_on_error: { type: 'boolean', default: false },
    },
    additionalProperties: false,
  },
} as const;

// ─── Validation Helpers ─────────────────────────────────────────────────────

const VALID_MODIFIER_KEYS = ['ctrl', 'alt', 'shift', 'super', 'meta', 'cmd'];
const VALID_SPECIAL_KEYS = [
  'enter', 'return', 'tab', 'escape', 'esc', 'backspace', 'delete', 'del',
  'space', 'up', 'down', 'left', 'right', 'home', 'end', 'pageup', 'pagedown',
  'f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8', 'f9', 'f10', 'f11', 'f12',
  'insert', 'pause', 'capslock', 'numlock', 'scrolllock', 'printscreen',
];
const ALL_VALID_KEYS = [...VALID_MODIFIER_KEYS, ...VALID_SPECIAL_KEYS];

/**
 * Validate a key combo string.
 * Accepts formats like "ctrl+c", "shift+alt+f1", "a", "enter".
 */
export function validateKeyCombo(key: string): boolean {
  if (!key || key.length > 100) return false;
  if (key.includes('\0')) return false;

  const parts = key.toLowerCase().split('+');
  if (parts.length === 0) return false;

  const mainKey = parts[parts.length - 1]!;
  const modifiers = parts.slice(0, -1);

  for (const mod of modifiers) {
    if (!VALID_MODIFIER_KEYS.includes(mod)) return false;
  }

  if (ALL_VALID_KEYS.includes(mainKey)) return true;
  if (mainKey.length === 1 && /^[a-z0-9]$/.test(mainKey)) return true;

  return false;
}

/**
 * Check if text contains null bytes.
 */
export function containsNullBytes(text: string): boolean {
  return text.includes('\0');
}
