import { describe, it, expect } from 'vitest';
import {
  COMPUTER_TOOLS,
  TOOL_TO_ACTION,
} from '../services/tool-definitions.js';

describe('COMPUTER_TOOLS', () => {
  it('is a non-empty array of tool definitions', () => {
    expect(Array.isArray(COMPUTER_TOOLS)).toBe(true);
    expect(COMPUTER_TOOLS.length).toBeGreaterThan(0);
  });

  it('each tool has type "function"', () => {
    for (const tool of COMPUTER_TOOLS) {
      expect(tool.type).toBe('function');
    }
  });

  it('each tool has a name, description, and parameters', () => {
    for (const tool of COMPUTER_TOOLS) {
      expect(tool.function.name).toBeTruthy();
      expect(typeof tool.function.name).toBe('string');
      expect(tool.function.description).toBeTruthy();
      expect(typeof tool.function.description).toBe('string');
      expect(tool.function.parameters).toBeDefined();
      expect(typeof tool.function.parameters).toBe('object');
    }
  });

  it('includes expected tools', () => {
    const names = COMPUTER_TOOLS.map((t) => t.function.name);
    expect(names).toContain('computer_screenshot');
    expect(names).toContain('computer_click');
    expect(names).toContain('computer_type');
    expect(names).toContain('computer_key');
    expect(names).toContain('computer_bash');
    expect(names).toContain('computer_scroll');
    expect(names).toContain('computer_drag');
    expect(names).toContain('computer_right_click');
    expect(names).toContain('computer_double_click');
  });

  it('all tool names are unique', () => {
    const names = COMPUTER_TOOLS.map((t) => t.function.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('parameters have type "object"', () => {
    for (const tool of COMPUTER_TOOLS) {
      expect(tool.function.parameters.type).toBe('object');
    }
  });
});

describe('TOOL_TO_ACTION', () => {
  it('maps every COMPUTER_TOOLS entry to an action', () => {
    for (const tool of COMPUTER_TOOLS) {
      const actionName = TOOL_TO_ACTION[tool.function.name];
      expect(actionName).toBeDefined();
      expect(typeof actionName).toBe('string');
    }
  });

  it('has correct mappings for known tools', () => {
    expect(TOOL_TO_ACTION['computer_screenshot']).toBe('screenshot');
    expect(TOOL_TO_ACTION['computer_click']).toBe('click');
    expect(TOOL_TO_ACTION['computer_right_click']).toBe('right_click');
    expect(TOOL_TO_ACTION['computer_double_click']).toBe('double_click');
    expect(TOOL_TO_ACTION['computer_type']).toBe('type');
    expect(TOOL_TO_ACTION['computer_key']).toBe('key');
    expect(TOOL_TO_ACTION['computer_scroll']).toBe('scroll');
    expect(TOOL_TO_ACTION['computer_bash']).toBe('bash');
    expect(TOOL_TO_ACTION['computer_drag']).toBe('drag');
  });

  it('returns undefined for unknown tool names', () => {
    expect(TOOL_TO_ACTION['nonexistent_tool']).toBeUndefined();
  });

  it('has no extra entries beyond what COMPUTER_TOOLS defines', () => {
    const toolNames = COMPUTER_TOOLS.map((t) => t.function.name);
    const mappedNames = Object.keys(TOOL_TO_ACTION);
    for (const name of mappedNames) {
      expect(toolNames).toContain(name);
    }
  });
});
