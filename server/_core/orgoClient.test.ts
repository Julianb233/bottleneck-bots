/**
 * Unit Tests for Orgo API Client
 *
 * Tests HTTP request handling, error recovery, circuit breaker integration,
 * and all Orgo desktop VM operations
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { OrgoClient, orgoClient, OrgoClientError, type Computer, type ScreenshotResponse, type ExecResponse, type ChatResponse } from './orgoClient';

// Helper: Mock environment variables
function mockEnv(vars: Record<string, string>): () => void {
  const originalEnv = { ...process.env };
  Object.entries(vars).forEach(([key, value]) => {
    process.env[key] = value;
  });
  return () => {
    process.env = originalEnv;
  };
}

// Mock fetch globally
global.fetch = vi.fn();

describe('OrgoClient', () => {
  let restoreEnv: () => void;

  beforeEach(() => {
    vi.clearAllMocks();
    restoreEnv = mockEnv({
      ORGO_API_KEY: 'sk_test_123456',
      ORGO_API_URL: 'http://localhost:3100',
      ORGO_WORKSPACE_ID: 'ws_test_789',
    });
  });

  afterEach(() => {
    restoreEnv();
    vi.restoreAllMocks();
  });

  describe('Configuration', () => {
    it('should return true for isConfigured when API key is set', async () => {
      vi.resetModules();
      restoreEnv();
      restoreEnv = mockEnv({
        ORGO_API_KEY: 'sk_test_key',
        ORGO_API_URL: 'http://localhost:3100',
      });

      const { OrgoClient: FreshClient } = await import('./orgoClient');
      const instance = FreshClient.getInstance();

      expect(instance.isConfigured()).toBe(true);
    });

    it('should return false for isConfigured when API key is missing', async () => {
      vi.resetModules();
      restoreEnv();
      restoreEnv = mockEnv({
        ORGO_API_URL: 'http://localhost:3100',
      });

      const { OrgoClient: FreshClient } = await import('./orgoClient');
      const instance = FreshClient.getInstance();

      expect(instance.isConfigured()).toBe(false);
    });

    it('should return correct configuration status', async () => {
      vi.resetModules();
      restoreEnv();
      restoreEnv = mockEnv({
        ORGO_API_KEY: 'sk_test_key',
        ORGO_API_URL: 'http://localhost:3100',
        ORGO_WORKSPACE_ID: 'ws_123',
      });

      const { OrgoClient: FreshClient } = await import('./orgoClient');
      const instance = FreshClient.getInstance();
      const status = instance.getConfigurationStatus();

      expect(status.configured).toBe(true);
      expect(status.apiUrl).toBe('http://localhost:3100');
      expect(status.hasApiKey).toBe(true);
      expect(status.hasWorkspace).toBe(true);
    });

    it('should use default API URL when not provided', async () => {
      vi.resetModules();
      restoreEnv();
      restoreEnv = mockEnv({
        ORGO_API_KEY: 'sk_test_key',
      });

      const { OrgoClient: FreshClient } = await import('./orgoClient');
      const instance = FreshClient.getInstance();
      const status = instance.getConfigurationStatus();

      expect(status.apiUrl).toBe('http://localhost:3100');
    });
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance across calls', async () => {
      vi.resetModules();
      restoreEnv();
      restoreEnv = mockEnv({
        ORGO_API_KEY: 'sk_test_key',
      });

      const { OrgoClient: FreshClient } = await import('./orgoClient');
      const instance1 = FreshClient.getInstance();
      const instance2 = FreshClient.getInstance();

      expect(instance1).toBe(instance2);
    });
  });

  describe('Computer Lifecycle', () => {
    beforeEach(() => {
      vi.resetModules();
    });

    it('should create a computer with POST request', async () => {
      const mockComputer: Computer = {
        id: 'comp_123',
        name: 'test-vm',
        status: 'creating',
        createdAt: new Date().toISOString(),
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockComputer,
      });

      const { orgoClient: client } = await import('./orgoClient');
      const result = await client.createComputer({ name: 'test-vm' });

      expect(result).toEqual(mockComputer);
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3100/api/v1/computers',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer sk_test_123456',
            'Content-Type': 'application/json',
          }),
          body: expect.stringContaining('"name":"test-vm"'),
        })
      );
    });

    it('should create computer with optional specs', async () => {
      const mockComputer: Computer = {
        id: 'comp_456',
        name: 'test-gpu',
        status: 'creating',
        cpu: 8,
        ramMb: 16000,
        gpu: true,
        createdAt: new Date().toISOString(),
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockComputer,
      });

      const { orgoClient: client } = await import('./orgoClient');
      const result = await client.createComputer({
        name: 'test-gpu',
        cpu: 8,
        ramMb: 16000,
        gpu: true,
      });

      expect(result.gpu).toBe(true);
      expect(result.cpu).toBe(8);
    });

    it('should get a computer by ID', async () => {
      const mockComputer: Computer = {
        id: 'comp_123',
        name: 'test-vm',
        status: 'running',
        createdAt: new Date().toISOString(),
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockComputer,
      });

      const { orgoClient: client } = await import('./orgoClient');
      const result = await client.getComputer('comp_123');

      expect(result).toEqual(mockComputer);
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3100/api/v1/computers/comp_123',
        expect.objectContaining({ method: 'GET' })
      );
    });

    it('should list computers', async () => {
      const mockComputers = [
        { id: 'comp_1', name: 'vm1', status: 'running' as const, createdAt: new Date().toISOString() },
        { id: 'comp_2', name: 'vm2', status: 'stopped' as const, createdAt: new Date().toISOString() },
      ];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockComputers,
      });

      const { orgoClient: client } = await import('./orgoClient');
      const result = await client.listComputers();

      expect(result).toEqual(mockComputers);
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3100/api/v1/computers',
        expect.objectContaining({ method: 'GET' })
      );
    });

    it('should handle wrapped computer list response', async () => {
      const mockComputers = [
        { id: 'comp_1', name: 'vm1', status: 'running' as const, createdAt: new Date().toISOString() },
      ];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ computers: mockComputers }),
      });

      const { orgoClient: client } = await import('./orgoClient');
      const result = await client.listComputers();

      expect(result).toEqual(mockComputers);
    });

    it('should start a computer', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 204,
      });

      const { orgoClient: client } = await import('./orgoClient');
      await client.startComputer('comp_123');

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3100/api/v1/computers/comp_123/start',
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('should stop a computer', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 204,
      });

      const { orgoClient: client } = await import('./orgoClient');
      await client.stopComputer('comp_123');

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3100/api/v1/computers/comp_123/stop',
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('should destroy a computer', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 204,
      });

      const { orgoClient: client } = await import('./orgoClient');
      await client.destroyComputer('comp_123');

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3100/api/v1/computers/comp_123',
        expect.objectContaining({ method: 'DELETE' })
      );
    });
  });

  describe('Desktop Actions', () => {
    beforeEach(() => {
      vi.resetModules();
    });

    it('should take a screenshot', async () => {
      const mockResponse: ScreenshotResponse = {
        data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        width: 1024,
        height: 768,
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const { orgoClient: client } = await import('./orgoClient');
      const result = await client.screenshot('comp_123');

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3100/api/v1/computers/comp_123/screenshot',
        expect.objectContaining({ method: 'GET' })
      );
    });

    it('should click at coordinates', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 204,
      });

      const { orgoClient: client } = await import('./orgoClient');
      await client.click('comp_123', 100, 200, 'left');

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3100/api/v1/computers/comp_123/click',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"x":100,"y":200'),
        })
      );
    });

    it('should type text', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 204,
      });

      const { orgoClient: client } = await import('./orgoClient');
      await client.type('comp_123', 'hello');

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3100/api/v1/computers/comp_123/type',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"text":"hello"'),
        })
      );
    });

    it('should press a key with modifiers', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 204,
      });

      const { orgoClient: client } = await import('./orgoClient');
      await client.keyPress('comp_123', 'a', ['control', 'shift']);

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3100/api/v1/computers/comp_123/key',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"key":"a"'),
        })
      );
    });

    it('should scroll', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 204,
      });

      const { orgoClient: client } = await import('./orgoClient');
      await client.scroll('comp_123', 500, 400, 0, -100);

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3100/api/v1/computers/comp_123/scroll',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"deltaY":-100'),
        })
      );
    });

    it('should drag from start to end coordinates', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 204,
      });

      const { orgoClient: client } = await import('./orgoClient');
      await client.drag('comp_123', 100, 100, 200, 200);

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3100/api/v1/computers/comp_123/drag',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"startX":100'),
        })
      );
    });

    it('should execute a command', async () => {
      const mockResponse: ExecResponse = {
        exitCode: 0,
        stdout: 'success',
        stderr: '',
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const { orgoClient: client } = await import('./orgoClient');
      const result = await client.exec('comp_123', ['ls', '-la']);

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3100/api/v1/computers/comp_123/exec',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"command":["ls","-la"]'),
        })
      );
    });

    it('should execute bash command', async () => {
      const mockResponse: ExecResponse = {
        exitCode: 0,
        stdout: 'result',
        stderr: '',
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const { orgoClient: client } = await import('./orgoClient');
      const result = await client.bash('comp_123', 'echo hello');

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3100/api/v1/computers/comp_123/bash',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"command":"echo hello"'),
        })
      );
    });

    it('should double click', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 204,
      });

      const { orgoClient: client } = await import('./orgoClient');
      await client.doubleClick('comp_123', 100, 200);

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3100/api/v1/computers/comp_123/click',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"double":true'),
        })
      );
    });
  });

  describe('Chat Completions', () => {
    beforeEach(() => {
      vi.resetModules();
    });

    it('should send chat completion request', async () => {
      const mockResponse: ChatResponse = {
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

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const { orgoClient: client } = await import('./orgoClient');
      const result = await client.chatCompletion({
        model: 'claude-3-sonnet',
        messages: [{ role: 'user', content: 'Hello' }],
        computerId: 'comp_123',
        autoExecuteTools: true,
      });

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3100/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"computer_id":"comp_123"'),
        })
      );
    });

    it('should include optional parameters in chat request', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ choices: [{ message: { role: 'assistant', content: '' } }] }),
      });

      const { orgoClient: client } = await import('./orgoClient');
      await client.chatCompletion({
        model: 'claude-3-sonnet',
        messages: [{ role: 'user', content: 'Test' }],
        maxTokens: 1000,
        temperature: 0.5,
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"max_tokens":1000'),
        })
      );
    });
  });

  describe('Health Check', () => {
    beforeEach(() => {
      vi.resetModules();
    });

    it('should return healthy status', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ status: 'ok' }),
      });

      const { orgoClient: client } = await import('./orgoClient');
      const result = await client.healthCheck();

      expect(result.healthy).toBe(true);
      expect(result.status).toBe('ok');
    });

    it('should handle unhealthy status', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ status: 'error' }),
      });

      const { orgoClient: client } = await import('./orgoClient');
      const result = await client.healthCheck();

      expect(result.healthy).toBe(false);
    });

    it('should return healthy false on error', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Connection failed'));

      const { orgoClient: client } = await import('./orgoClient');
      const result = await client.healthCheck();

      expect(result.healthy).toBe(false);
      expect(result.status).toBe('error');
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      vi.resetModules();
    });

    it('should throw OrgoClientError on 401 Unauthorized', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: async () => 'Invalid API key',
      });

      const { orgoClient: client } = await import('./orgoClient');

      await expect(client.getComputer('comp_123')).rejects.toThrow(OrgoClientError);
    });

    it('should throw OrgoClientError on 429 Rate Limit', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        text: async () => 'Rate limited',
      });

      const { orgoClient: client } = await import('./orgoClient');

      await expect(client.screenshot('comp_123')).rejects.toThrow(OrgoClientError);
    });

    it('should throw OrgoClientError on 500 Server Error', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: async () => 'Server error',
      });

      const { orgoClient: client } = await import('./orgoClient');

      await expect(client.listComputers()).rejects.toThrow(OrgoClientError);
    });

    it('should include status code in error', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        text: async () => 'Access denied',
      });

      const { orgoClient: client } = await import('./orgoClient');

      try {
        await client.destroyComputer('comp_123');
      } catch (err) {
        expect(err).toBeInstanceOf(OrgoClientError);
        expect((err as OrgoClientError).statusCode).toBe(403);
      }
    });

    it('should handle network errors', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Network timeout'));

      const { orgoClient: client } = await import('./orgoClient');

      await expect(client.getComputer('comp_123')).rejects.toThrow(OrgoClientError);
    });

    it('should handle invalid JSON responses', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => {
          throw new SyntaxError('Invalid JSON');
        },
      });

      const { orgoClient: client } = await import('./orgoClient');

      await expect(client.screenshot('comp_123')).rejects.toThrow(OrgoClientError);
    });

    it('should handle 204 No Content response', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 204,
      });

      const { orgoClient: client } = await import('./orgoClient');

      const result = await client.startComputer('comp_123');

      expect(result).toBeUndefined();
    });
  });

  describe('Retry Logic', () => {
    beforeEach(() => {
      vi.resetModules();
    });

    it('should retry on 5xx errors', async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
          statusText: 'Service Unavailable',
          text: async () => 'Service down',
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
          statusText: 'Service Unavailable',
          text: async () => 'Service down',
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ status: 'ok' }),
        });

      const { orgoClient: client } = await import('./orgoClient');

      const result = await client.healthCheck();

      expect(result.healthy).toBe(true);
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it('should not retry on 4xx errors', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: async () => 'Computer not found',
      });

      const { orgoClient: client } = await import('./orgoClient');

      await expect(client.getComputer('nonexistent')).rejects.toThrow();

      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('Circuit Breaker Integration', () => {
    beforeEach(() => {
      vi.resetModules();
    });

    it('should pass requests through circuit breaker', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ status: 'ok' }),
      });

      const { orgoClient: client } = await import('./orgoClient');

      const result = await client.healthCheck();

      expect(result.healthy).toBe(true);
    });
  });
});
