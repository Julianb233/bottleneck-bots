/**
 * Unit Tests for Orgo Compute Provider Service
 *
 * Tests session management, browser-like navigation, and agent loop integration
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { OrgoComputeProvider, getComputeProvider, type SessionCreateOptions } from './orgoComputeProvider';
import * as orgoClientModule from '../_core/orgoClient';

// Mock the orgoClient
vi.mock('../_core/orgoClient');

describe('OrgoComputeProvider', () => {
  let mockOrgoClient: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockOrgoClient = {
      createComputer: vi.fn(),
      startComputer: vi.fn(),
      destroyComputer: vi.fn(),
      getComputer: vi.fn(),
      screenshot: vi.fn(),
      click: vi.fn(),
      type: vi.fn(),
      bash: vi.fn(),
      chatCompletion: vi.fn(),
    };

    vi.mocked(orgoClientModule.orgoClient).createComputer = mockOrgoClient.createComputer;
    vi.mocked(orgoClientModule.orgoClient).startComputer = mockOrgoClient.startComputer;
    vi.mocked(orgoClientModule.orgoClient).destroyComputer = mockOrgoClient.destroyComputer;
    vi.mocked(orgoClientModule.orgoClient).getComputer = mockOrgoClient.getComputer;
    vi.mocked(orgoClientModule.orgoClient).screenshot = mockOrgoClient.screenshot;
    vi.mocked(orgoClientModule.orgoClient).click = mockOrgoClient.click;
    vi.mocked(orgoClientModule.orgoClient).type = mockOrgoClient.type;
    vi.mocked(orgoClientModule.orgoClient).bash = mockOrgoClient.bash;
    vi.mocked(orgoClientModule.orgoClient).chatCompletion = mockOrgoClient.chatCompletion;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance across calls', () => {
      const instance1 = OrgoComputeProvider.getInstance();
      const instance2 = OrgoComputeProvider.getInstance();

      expect(instance1).toBe(instance2);
    });
  });

  describe('Session Management', () => {
    it('should create a new session with computer lifecycle', async () => {
      const mockComputer = {
        id: 'comp_123',
        name: 'bb-agent-user-123',
        status: 'running',
        createdAt: new Date().toISOString(),
      };

      mockOrgoClient.createComputer.mockResolvedValueOnce(mockComputer);

      const provider = OrgoComputeProvider.getInstance();
      const result = await provider.createSession({ userId: 1, executionId: 123 });

      expect(result.sessionId).toBeDefined();
      expect(result.computerId).toBe('comp_123');
      expect(mockOrgoClient.createComputer).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'bb-agent-user-123',
        })
      );
    });

    it('should create session with custom specs', async () => {
      const mockComputer = {
        id: 'comp_gpu',
        name: 'bb-agent-anon-456',
        status: 'running',
        cpu: 8,
        ramMb: 16000,
        gpu: true,
        createdAt: new Date().toISOString(),
      };

      mockOrgoClient.createComputer.mockResolvedValueOnce(mockComputer);

      const provider = OrgoComputeProvider.getInstance();
      const result = await provider.createSession({
        specs: {
          cpu: 8,
          ramMb: 16000,
          gpu: true,
        },
      });

      expect(result.computerId).toBe('comp_gpu');
      expect(mockOrgoClient.createComputer).toHaveBeenCalledWith(
        expect.objectContaining({
          cpu: 8,
          ramMb: 16000,
          gpu: true,
        })
      );
    });

    it('should start computer if not running', async () => {
      const mockComputer = {
        id: 'comp_stopped',
        name: 'test-vm',
        status: 'stopped',
        createdAt: new Date().toISOString(),
      };

      mockOrgoClient.createComputer.mockResolvedValueOnce(mockComputer);

      const provider = OrgoComputeProvider.getInstance();
      await provider.createSession();

      expect(mockOrgoClient.startComputer).toHaveBeenCalledWith('comp_stopped');
    });

    it('should not start computer if already running', async () => {
      const mockComputer = {
        id: 'comp_running',
        name: 'test-vm',
        status: 'running',
        createdAt: new Date().toISOString(),
      };

      mockOrgoClient.createComputer.mockResolvedValueOnce(mockComputer);

      const provider = OrgoComputeProvider.getInstance();
      await provider.createSession();

      expect(mockOrgoClient.startComputer).not.toHaveBeenCalled();
    });

    it('should destroy session and computer', async () => {
      const mockComputer = {
        id: 'comp_123',
        name: 'test-vm',
        status: 'running',
        createdAt: new Date().toISOString(),
      };

      mockOrgoClient.createComputer.mockResolvedValueOnce(mockComputer);

      const provider = OrgoComputeProvider.getInstance();
      const { sessionId } = await provider.createSession();

      await provider.destroySession(sessionId);

      expect(mockOrgoClient.destroyComputer).toHaveBeenCalledWith('comp_123');
    });

    it('should handle destroy on non-existent session gracefully', async () => {
      const provider = OrgoComputeProvider.getInstance();

      await expect(provider.destroySession('nonexistent_session')).resolves.not.toThrow();
      expect(mockOrgoClient.destroyComputer).not.toHaveBeenCalled();
    });

    it('should handle destroy error gracefully', async () => {
      const mockComputer = {
        id: 'comp_fail',
        name: 'test-vm',
        status: 'running',
        createdAt: new Date().toISOString(),
      };

      mockOrgoClient.createComputer.mockResolvedValueOnce(mockComputer);
      mockOrgoClient.destroyComputer.mockRejectedValueOnce(new Error('Destroy failed'));

      const provider = OrgoComputeProvider.getInstance();
      const { sessionId } = await provider.createSession();

      await expect(provider.destroySession(sessionId)).resolves.not.toThrow();
    });

    it('should get session status', async () => {
      const mockComputer = {
        id: 'comp_123',
        name: 'test-vm',
        status: 'running',
        createdAt: new Date().toISOString(),
      };

      mockOrgoClient.createComputer.mockResolvedValueOnce(mockComputer);
      mockOrgoClient.getComputer.mockResolvedValueOnce(mockComputer);

      const provider = OrgoComputeProvider.getInstance();
      const { sessionId } = await provider.createSession();
      const status = await provider.getSessionStatus(sessionId);

      expect(status.status).toBe('running');
      expect(status.computerId).toBe('comp_123');
    });

    it('should return not_found for invalid session', async () => {
      const provider = OrgoComputeProvider.getInstance();
      const status = await provider.getSessionStatus('invalid_session');

      expect(status.status).toBe('not_found');
      expect(status.computerId).toBe('');
    });

    it('should return unknown status on getComputer error', async () => {
      const mockComputer = {
        id: 'comp_123',
        name: 'test-vm',
        status: 'running',
        createdAt: new Date().toISOString(),
      };

      mockOrgoClient.createComputer.mockResolvedValueOnce(mockComputer);
      mockOrgoClient.getComputer.mockRejectedValueOnce(new Error('API error'));

      const provider = OrgoComputeProvider.getInstance();
      const { sessionId } = await provider.createSession();
      const status = await provider.getSessionStatus(sessionId);

      expect(status.status).toBe('unknown');
      expect(status.computerId).toBe('comp_123');
    });
  });

  describe('Browser-like Actions', () => {
    let sessionId: string;

    beforeEach(async () => {
      const mockComputer = {
        id: 'comp_123',
        name: 'test-vm',
        status: 'running',
        createdAt: new Date().toISOString(),
      };

      mockOrgoClient.createComputer.mockResolvedValueOnce(mockComputer);

      const provider = OrgoComputeProvider.getInstance();
      const result = await provider.createSession();
      sessionId = result.sessionId;
    });

    it('should navigate to URL by launching chromium', async () => {
      const provider = OrgoComputeProvider.getInstance();
      await provider.navigate(sessionId, 'https://example.com');

      expect(mockOrgoClient.bash).toHaveBeenCalledWith(
        'comp_123',
        expect.stringContaining('chromium-browser')
      );
      expect(mockOrgoClient.bash).toHaveBeenCalledWith(
        'comp_123',
        expect.stringContaining('https://example.com')
      );
    });

    it('should get screenshot', async () => {
      const mockScreenshot = {
        data: 'base64data',
        width: 1024,
        height: 768,
      };

      mockOrgoClient.screenshot.mockResolvedValueOnce(mockScreenshot);

      const provider = OrgoComputeProvider.getInstance();
      const result = await provider.screenshot(sessionId);

      expect(result).toBe('base64data');
      expect(mockOrgoClient.screenshot).toHaveBeenCalledWith('comp_123');
    });

    it('should click at coordinates', async () => {
      const provider = OrgoComputeProvider.getInstance();
      await provider.click(sessionId, 100, 200);

      expect(mockOrgoClient.click).toHaveBeenCalledWith('comp_123', 100, 200, 'left');
    });

    it('should type text', async () => {
      const provider = OrgoComputeProvider.getInstance();
      await provider.type(sessionId, 'hello');

      expect(mockOrgoClient.type).toHaveBeenCalledWith('comp_123', 'hello');
    });

    it('should throw error for non-existent session', async () => {
      const provider = OrgoComputeProvider.getInstance();

      await expect(provider.navigate('invalid_session', 'https://example.com')).rejects.toThrow(
        'session not found'
      );
    });
  });

  describe('Agent Loop Integration', () => {
    it('should run agent loop with correct parameters', async () => {
      const mockResponse = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        model: 'claude-3-sonnet',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'Test response',
            },
            finish_reason: 'stop',
          },
        ],
      };

      mockOrgoClient.chatCompletion.mockResolvedValueOnce(mockResponse);

      const provider = OrgoComputeProvider.getInstance();
      const result = await provider.runAgentLoop({
        computerId: 'comp_123',
        model: 'claude-3-sonnet',
        prompt: 'Take a screenshot',
        maxSteps: 5,
      });

      expect(result).toEqual(mockResponse);
      expect(mockOrgoClient.chatCompletion).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'claude-3-sonnet',
          messages: [
            {
              role: 'user',
              content: 'Take a screenshot',
            },
          ],
          computerId: 'comp_123',
          autoExecuteTools: true,
        })
      );
    });
  });
});

describe('getComputeProvider', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should return orgo when COMPUTE_PROVIDER=orgo and ORGO_API_KEY set', () => {
    process.env.COMPUTE_PROVIDER = 'orgo';
    process.env.ORGO_API_KEY = 'sk_test_key';

    // Need to reimport to pick up new env vars
    delete require.cache[require.resolve('./orgoComputeProvider')];
    const { getComputeProvider: freshGetComputeProvider } = require('./orgoComputeProvider');

    expect(freshGetComputeProvider()).toBe('orgo');
  });

  it('should return browserbase when COMPUTE_PROVIDER not set', () => {
    delete process.env.COMPUTE_PROVIDER;
    delete process.env.ORGO_API_KEY;

    delete require.cache[require.resolve('./orgoComputeProvider')];
    const { getComputeProvider: freshGetComputeProvider } = require('./orgoComputeProvider');

    expect(freshGetComputeProvider()).toBe('browserbase');
  });

  it('should return browserbase when ORGO_API_KEY missing', () => {
    process.env.COMPUTE_PROVIDER = 'orgo';
    delete process.env.ORGO_API_KEY;

    delete require.cache[require.resolve('./orgoComputeProvider')];
    const { getComputeProvider: freshGetComputeProvider } = require('./orgoComputeProvider');

    expect(freshGetComputeProvider()).toBe('browserbase');
  });

  it('should return browserbase when COMPUTE_PROVIDER not orgo', () => {
    process.env.COMPUTE_PROVIDER = 'browserbase';
    process.env.ORGO_API_KEY = 'sk_test_key';

    delete require.cache[require.resolve('./orgoComputeProvider')];
    const { getComputeProvider: freshGetComputeProvider } = require('./orgoComputeProvider');

    expect(freshGetComputeProvider()).toBe('browserbase');
  });
});
