/**
 * Unit Tests for Agent Browser Tools - Orgo Integration
 *
 * Tests Orgo-specific browser tools and tool definitions
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { orgoTools, getOrgoToolDefinitions, registerOrgoTools } from './agentBrowserTools';
import * as orgoProviderModule from './orgoComputeProvider';

// Mock the Orgo compute provider
vi.mock('./orgoComputeProvider');

describe('Orgo Tools', () => {
  let mockProvider: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockProvider = {
      createSession: vi.fn(),
      destroySession: vi.fn(),
      getSessionStatus: vi.fn(),
      navigate: vi.fn(),
      screenshot: vi.fn(),
      click: vi.fn(),
      type: vi.fn(),
      runAgentLoop: vi.fn(),
    };

    vi.mocked(orgoProviderModule.orgoComputeProvider).createSession = mockProvider.createSession;
    vi.mocked(orgoProviderModule.orgoComputeProvider).destroySession = mockProvider.destroySession;
    vi.mocked(orgoProviderModule.orgoComputeProvider).getSessionStatus = mockProvider.getSessionStatus;
    vi.mocked(orgoProviderModule.orgoComputeProvider).navigate = mockProvider.navigate;
    vi.mocked(orgoProviderModule.orgoComputeProvider).screenshot = mockProvider.screenshot;
    vi.mocked(orgoProviderModule.orgoComputeProvider).click = mockProvider.click;
    vi.mocked(orgoProviderModule.orgoComputeProvider).type = mockProvider.type;
    vi.mocked(orgoProviderModule.orgoComputeProvider).runAgentLoop = mockProvider.runAgentLoop;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('orgo_create_session', () => {
    it('should create a session successfully', async () => {
      mockProvider.createSession.mockResolvedValueOnce({
        sessionId: 'orgo_sess_123',
        computerId: 'comp_123',
      });

      const result = await orgoTools.orgo_create_session({});

      expect(result.success).toBe(true);
      expect(result.sessionId).toBe('orgo_sess_123');
      expect(mockProvider.createSession).toHaveBeenCalled();
    });

    it('should include userId and executionId in session creation', async () => {
      mockProvider.createSession.mockResolvedValueOnce({
        sessionId: 'orgo_sess_456',
        computerId: 'comp_456',
      });

      await orgoTools.orgo_create_session({
        userId: 1,
        executionId: 123,
      });

      expect(mockProvider.createSession).toHaveBeenCalledWith({
        userId: 1,
        executionId: 123,
      });
    });

    it('should return error on failure', async () => {
      mockProvider.createSession.mockRejectedValueOnce(new Error('Session creation failed'));

      const result = await orgoTools.orgo_create_session({});

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('orgo_navigate', () => {
    it('should navigate to URL', async () => {
      mockProvider.navigate.mockResolvedValueOnce(undefined);

      const result = await orgoTools.orgo_navigate({
        sessionId: 'orgo_sess_123',
        url: 'https://example.com',
      });

      expect(result.success).toBe(true);
      expect(mockProvider.navigate).toHaveBeenCalledWith('orgo_sess_123', 'https://example.com');
    });

    it('should return error on navigation failure', async () => {
      mockProvider.navigate.mockRejectedValueOnce(new Error('Navigation failed'));

      const result = await orgoTools.orgo_navigate({
        sessionId: 'orgo_sess_123',
        url: 'https://invalid.com',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('orgo_screenshot', () => {
    it('should take a screenshot', async () => {
      const base64Data = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      mockProvider.screenshot.mockResolvedValueOnce(base64Data);

      const result = await orgoTools.orgo_screenshot({
        sessionId: 'orgo_sess_123',
      });

      expect(result.success).toBe(true);
      expect(result.screenshot).toBe(base64Data);
      expect(mockProvider.screenshot).toHaveBeenCalledWith('orgo_sess_123');
    });

    it('should return error on screenshot failure', async () => {
      mockProvider.screenshot.mockRejectedValueOnce(new Error('Screenshot failed'));

      const result = await orgoTools.orgo_screenshot({
        sessionId: 'orgo_sess_123',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('orgo_click', () => {
    it('should click at coordinates', async () => {
      mockProvider.click.mockResolvedValueOnce(undefined);

      const result = await orgoTools.orgo_click({
        sessionId: 'orgo_sess_123',
        x: 100,
        y: 200,
      });

      expect(result.success).toBe(true);
      expect(mockProvider.click).toHaveBeenCalledWith('orgo_sess_123', 100, 200);
    });

    it('should return error on click failure', async () => {
      mockProvider.click.mockRejectedValueOnce(new Error('Click failed'));

      const result = await orgoTools.orgo_click({
        sessionId: 'orgo_sess_123',
        x: 100,
        y: 200,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('orgo_type', () => {
    it('should type text', async () => {
      mockProvider.type.mockResolvedValueOnce(undefined);

      const result = await orgoTools.orgo_type({
        sessionId: 'orgo_sess_123',
        text: 'hello',
      });

      expect(result.success).toBe(true);
      expect(mockProvider.type).toHaveBeenCalledWith('orgo_sess_123', 'hello');
    });

    it('should return error on type failure', async () => {
      mockProvider.type.mockRejectedValueOnce(new Error('Type failed'));

      const result = await orgoTools.orgo_type({
        sessionId: 'orgo_sess_123',
        text: 'hello',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('orgo_exec', () => {
    it('should execute a command', async () => {
      const mockResult = { exitCode: 0, stdout: 'success', stderr: '' };
      mockProvider.runAgentLoop.mockResolvedValueOnce(undefined);

      const result = await orgoTools.orgo_exec({
        sessionId: 'orgo_sess_123',
        command: 'echo hello',
      });

      expect(result.success).toBe(true);
    });

    it('should return error on exec failure', async () => {
      mockProvider.runAgentLoop.mockRejectedValueOnce(new Error('Exec failed'));

      const result = await orgoTools.orgo_exec({
        sessionId: 'orgo_sess_123',
        command: 'invalid command',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('orgo_close_session', () => {
    it('should close a session', async () => {
      mockProvider.destroySession.mockResolvedValueOnce(undefined);

      const result = await orgoTools.orgo_close_session({
        sessionId: 'orgo_sess_123',
      });

      expect(result.success).toBe(true);
      expect(mockProvider.destroySession).toHaveBeenCalledWith('orgo_sess_123');
    });

    it('should return error on close failure', async () => {
      mockProvider.destroySession.mockRejectedValueOnce(new Error('Close failed'));

      const result = await orgoTools.orgo_close_session({
        sessionId: 'orgo_sess_123',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});

describe('getOrgoToolDefinitions', () => {
  it('should return array of tool definitions', () => {
    const definitions = getOrgoToolDefinitions();

    expect(Array.isArray(definitions)).toBe(true);
    expect(definitions.length).toBeGreaterThan(0);
  });

  it('should include orgo_create_session tool', () => {
    const definitions = getOrgoToolDefinitions();
    const createSessionTool = definitions.find(t => t.name === 'orgo_create_session');

    expect(createSessionTool).toBeDefined();
    expect(createSessionTool?.description).toBeDefined();
    expect(createSessionTool?.input_schema).toBeDefined();
  });

  it('should include orgo_navigate tool', () => {
    const definitions = getOrgoToolDefinitions();
    const navigateTool = definitions.find(t => t.name === 'orgo_navigate');

    expect(navigateTool).toBeDefined();
    expect(navigateTool?.input_schema.properties).toHaveProperty('sessionId');
    expect(navigateTool?.input_schema.properties).toHaveProperty('url');
  });

  it('should include orgo_screenshot tool', () => {
    const definitions = getOrgoToolDefinitions();
    const screenshotTool = definitions.find(t => t.name === 'orgo_screenshot');

    expect(screenshotTool).toBeDefined();
    expect(screenshotTool?.input_schema.properties).toHaveProperty('sessionId');
  });

  it('should include orgo_click tool', () => {
    const definitions = getOrgoToolDefinitions();
    const clickTool = definitions.find(t => t.name === 'orgo_click');

    expect(clickTool).toBeDefined();
    expect(clickTool?.description).toContain('Click');
    expect(clickTool?.input_schema.properties).toHaveProperty('x');
    expect(clickTool?.input_schema.properties).toHaveProperty('y');
  });

  it('should include orgo_type tool', () => {
    const definitions = getOrgoToolDefinitions();
    const typeTool = definitions.find(t => t.name === 'orgo_type');

    expect(typeTool).toBeDefined();
    expect(typeTool?.description).toContain('Type');
    expect(typeTool?.input_schema.properties).toHaveProperty('text');
  });

  it('should include orgo_exec tool', () => {
    const definitions = getOrgoToolDefinitions();
    const execTool = definitions.find(t => t.name === 'orgo_exec');

    expect(execTool).toBeDefined();
    expect(execTool?.input_schema.properties).toHaveProperty('command');
  });

  it('should include orgo_close_session tool', () => {
    const definitions = getOrgoToolDefinitions();
    const closeTool = definitions.find(t => t.name === 'orgo_close_session');

    expect(closeTool).toBeDefined();
    expect(closeTool?.input_schema.properties).toHaveProperty('sessionId');
  });

  it('should have valid input_schema for each tool', () => {
    const definitions = getOrgoToolDefinitions();

    for (const tool of definitions) {
      expect(tool.input_schema).toBeDefined();
      expect(tool.input_schema.type).toBe('object');
      expect(tool.input_schema.properties).toBeDefined();
      expect(Array.isArray(tool.input_schema.required)).toBe(true);
    }
  });

  it('should have descriptions for all tools', () => {
    const definitions = getOrgoToolDefinitions();

    for (const tool of definitions) {
      expect(tool.description).toBeDefined();
      expect(tool.description.length).toBeGreaterThan(0);
    }
  });
});

describe('registerOrgoTools', () => {
  it('should register all Orgo tools', () => {
    const tools = registerOrgoTools();

    expect(Array.isArray(tools)).toBe(true);
    expect(tools.length).toBeGreaterThan(0);

    // Check that tools are registered with correct names
    const toolNames = tools.map(t => t.name);
    expect(toolNames).toContain('orgo_create_session');
    expect(toolNames).toContain('orgo_navigate');
    expect(toolNames).toContain('orgo_screenshot');
    expect(toolNames).toContain('orgo_click');
    expect(toolNames).toContain('orgo_type');
    expect(toolNames).toContain('orgo_exec');
    expect(toolNames).toContain('orgo_close_session');
  });

  it('should register tools with handlers', () => {
    const tools = registerOrgoTools();

    for (const tool of tools) {
      expect(orgoTools[tool.name as keyof typeof orgoTools]).toBeDefined();
    }
  });
});
