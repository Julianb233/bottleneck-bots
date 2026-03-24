/**
 * Computer-use tool definitions in OpenAI function calling format.
 *
 * Each tool maps to a desktop action that can be executed via the
 * action-proxy against a running container.
 */

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export const COMPUTER_TOOLS: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'computer_screenshot',
      description:
        'Take a screenshot of the computer screen. Returns a base64-encoded image.',
      parameters: {
        type: 'object',
        properties: {
          format: {
            type: 'string',
            enum: ['png', 'jpeg'],
            description: 'Image format (default: png)',
          },
          quality: {
            type: 'integer',
            minimum: 1,
            maximum: 100,
            description: 'JPEG quality 1-100 (default: 70, only for jpeg)',
          },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'computer_click',
      description: 'Click at the specified x, y coordinates on screen.',
      parameters: {
        type: 'object',
        properties: {
          x: { type: 'integer', description: 'X coordinate' },
          y: { type: 'integer', description: 'Y coordinate' },
        },
        required: ['x', 'y'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'computer_right_click',
      description: 'Right-click at the specified x, y coordinates on screen.',
      parameters: {
        type: 'object',
        properties: {
          x: { type: 'integer', description: 'X coordinate' },
          y: { type: 'integer', description: 'Y coordinate' },
        },
        required: ['x', 'y'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'computer_double_click',
      description: 'Double-click at the specified x, y coordinates on screen.',
      parameters: {
        type: 'object',
        properties: {
          x: { type: 'integer', description: 'X coordinate' },
          y: { type: 'integer', description: 'Y coordinate' },
        },
        required: ['x', 'y'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'computer_type',
      description:
        'Type the given text string on the computer keyboard. For special keys, use computer_key instead.',
      parameters: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'Text to type' },
        },
        required: ['text'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'computer_key',
      description:
        'Press a key or key combination (e.g., "Enter", "ctrl+c", "shift+alt+f1").',
      parameters: {
        type: 'object',
        properties: {
          key: {
            type: 'string',
            description: 'Key or key combo, e.g. "Enter", "ctrl+c", "alt+Tab"',
          },
        },
        required: ['key'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'computer_scroll',
      description: 'Scroll at the specified position in the given direction.',
      parameters: {
        type: 'object',
        properties: {
          x: { type: 'integer', description: 'X coordinate' },
          y: { type: 'integer', description: 'Y coordinate' },
          direction: {
            type: 'string',
            enum: ['up', 'down', 'left', 'right'],
            description: 'Scroll direction',
          },
          amount: {
            type: 'integer',
            minimum: 1,
            description: 'Number of scroll units (default: 3)',
          },
        },
        required: ['x', 'y', 'direction'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'computer_bash',
      description:
        'Execute a bash command on the computer and return stdout/stderr.',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'Bash command to execute' },
          timeout: {
            type: 'integer',
            minimum: 1,
            maximum: 300,
            description: 'Timeout in seconds (default: 30)',
          },
        },
        required: ['command'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'computer_drag',
      description: 'Drag from one screen coordinate to another.',
      parameters: {
        type: 'object',
        properties: {
          start_x: { type: 'integer', description: 'Start X coordinate' },
          start_y: { type: 'integer', description: 'Start Y coordinate' },
          end_x: { type: 'integer', description: 'End X coordinate' },
          end_y: { type: 'integer', description: 'End Y coordinate' },
        },
        required: ['start_x', 'start_y', 'end_x', 'end_y'],
        additionalProperties: false,
      },
    },
  },
];

/**
 * Map from tool function name to the action-proxy action name.
 */
export const TOOL_TO_ACTION: Record<string, string> = {
  computer_screenshot: 'screenshot',
  computer_click: 'click',
  computer_right_click: 'right_click',
  computer_double_click: 'double_click',
  computer_type: 'type',
  computer_key: 'key',
  computer_scroll: 'scroll',
  computer_bash: 'bash',
  computer_drag: 'drag',
};
