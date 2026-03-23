/**
 * Unit Tests for Orgo tRPC Router
 *
 * Tests all tRPC endpoints for Orgo desktop VM management
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { TRPCError } from '@trpc/server';
import { orgoRouter } from './orgo';
import * as orgoClientModule from '../../_core/orgoClient';

// Mock the orgoClient
vi.mock('../../_core/orgoClient');

// Create a test harness for tRPC procedures
function createTestCaller() {
  const mockOrgoClient = {
    getConfigurationStatus: vi.fn(),
    listComputers: vi.fn(),
    createComputer: vi.fn(),
    getComputer: vi.fn(),
    startComputer: vi.fn(),
    stopComputer: vi.fn(),
    destroyComputer: vi.fn(),
    screenshot: vi.fn(),
    click: vi.fn(),
    doubleClick: vi.fn(),
    type: vi.fn(),
    keyPress: vi.fn(),
    scroll: vi.fn(),
    drag: vi.fn(),
    exec: vi.fn(),
    bash: vi.fn(),
    healthCheck: vi.fn(),
  };

  vi.mocked(orgoClientModule.orgoClient).getConfigurationStatus = mockOrgoClient.getConfigurationStatus;
  vi.mocked(orgoClientModule.orgoClient).listComputers = mockOrgoClient.listComputers;
  vi.mocked(orgoClientModule.orgoClient).createComputer = mockOrgoClient.createComputer;
  vi.mocked(orgoClientModule.orgoClient).getComputer = mockOrgoClient.getComputer;
  vi.mocked(orgoClientModule.orgoClient).startComputer = mockOrgoClient.startComputer;
  vi.mocked(orgoClientModule.orgoClient).stopComputer = mockOrgoClient.stopComputer;
  vi.mocked(orgoClientModule.orgoClient).destroyComputer = mockOrgoClient.destroyComputer;
  vi.mocked(orgoClientModule.orgoClient).screenshot = mockOrgoClient.screenshot;
  vi.mocked(orgoClientModule.orgoClient).click = mockOrgoClient.click;
  vi.mocked(orgoClientModule.orgoClient).doubleClick = mockOrgoClient.doubleClick;
  vi.mocked(orgoClientModule.orgoClient).type = mockOrgoClient.type;
  vi.mocked(orgoClientModule.orgoClient).keyPress = mockOrgoClient.keyPress;
  vi.mocked(orgoClientModule.orgoClient).scroll = mockOrgoClient.scroll;
  vi.mocked(orgoClientModule.orgoClient).drag = mockOrgoClient.drag;
  vi.mocked(orgoClientModule.orgoClient).exec = mockOrgoClient.exec;
  vi.mocked(orgoClientModule.orgoClient).bash = mockOrgoClient.bash;
  vi.mocked(orgoClientModule.orgoClient).healthCheck = mockOrgoClient.healthCheck;

  // Create a context object with authenticated user
  const mockCtx = {
    user: { id: 1, email: 'test@example.com' },
    session: {},
  };

  return {
    mockOrgoClient,
    mockCtx,
  };
}

describe('Orgo tRPC Router', () => {
  let caller: ReturnType<typeof createTestCaller>;

  beforeEach(() => {
    vi.clearAllMocks();
    caller = createTestCaller();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('configStatus', () => {
    it('should return configuration status', async () => {
      const mockStatus = {
        configured: true,
        apiUrl: 'http://localhost:3100',
        hasApiKey: true,
        hasWorkspace: true,
      };

      caller.mockOrgoClient.getConfigurationStatus.mockReturnValueOnce(mockStatus);

      const result = await orgoRouter.createCaller(caller.mockCtx).configStatus();

      expect(result).toEqual(mockStatus);
    });

    it('should return status when not configured', async () => {
      const mockStatus = {
        configured: false,
        apiUrl: 'http://localhost:3100',
        hasApiKey: false,
        hasWorkspace: false,
      };

      caller.mockOrgoClient.getConfigurationStatus.mockReturnValueOnce(mockStatus);

      const result = await orgoRouter.createCaller(caller.mockCtx).configStatus();

      expect(result.configured).toBe(false);
    });
  });

  describe('listComputers', () => {
    it('should return list of computers', async () => {
      const mockComputers = [
        { id: 'comp_1', name: 'vm1', status: 'running' as const, createdAt: new Date().toISOString() },
        { id: 'comp_2', name: 'vm2', status: 'stopped' as const, createdAt: new Date().toISOString() },
      ];

      caller.mockOrgoClient.listComputers.mockResolvedValueOnce(mockComputers);

      const result = await orgoRouter.createCaller(caller.mockCtx).listComputers();

      expect(result).toEqual(mockComputers);
    });

    it('should throw TRPCError on client error', async () => {
      caller.mockOrgoClient.listComputers.mockRejectedValueOnce(
        new orgoClientModule.OrgoClientError('API error', 'API_ERROR', 401)
      );

      await expect(orgoRouter.createCaller(caller.mockCtx).listComputers()).rejects.toThrow(
        TRPCError
      );
    });
  });

  describe('createComputer', () => {
    it('should create a computer with valid input', async () => {
      const mockComputer = {
        id: 'comp_new',
        name: 'test-vm',
        status: 'creating' as const,
        createdAt: new Date().toISOString(),
      };

      caller.mockOrgoClient.createComputer.mockResolvedValueOnce(mockComputer);

      const result = await orgoRouter.createCaller(caller.mockCtx).createComputer({
        name: 'test-vm',
      });

      expect(result).toEqual(mockComputer);
      expect(caller.mockOrgoClient.createComputer).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'test-vm' })
      );
    });

    it('should validate name input', async () => {
      await expect(
        orgoRouter.createCaller(caller.mockCtx).createComputer({ name: '' })
      ).rejects.toThrow();
    });

    it('should validate cpu range', async () => {
      await expect(
        orgoRouter.createCaller(caller.mockCtx).createComputer({
          name: 'test',
          cpu: 64, // exceeds max of 32
        })
      ).rejects.toThrow();
    });

    it('should accept optional specs', async () => {
      const mockComputer = {
        id: 'comp_gpu',
        name: 'test-gpu',
        status: 'creating' as const,
        cpu: 8,
        ramMb: 16000,
        gpu: true,
        createdAt: new Date().toISOString(),
      };

      caller.mockOrgoClient.createComputer.mockResolvedValueOnce(mockComputer);

      const result = await orgoRouter.createCaller(caller.mockCtx).createComputer({
        name: 'test-gpu',
        cpu: 8,
        ramMb: 16000,
        gpu: true,
      });

      expect(result.gpu).toBe(true);
    });
  });

  describe('getComputer', () => {
    it('should get a computer by ID', async () => {
      const mockComputer = {
        id: 'comp_123',
        name: 'test-vm',
        status: 'running' as const,
        createdAt: new Date().toISOString(),
      };

      caller.mockOrgoClient.getComputer.mockResolvedValueOnce(mockComputer);

      const result = await orgoRouter.createCaller(caller.mockCtx).getComputer({
        computerId: 'comp_123',
      });

      expect(result).toEqual(mockComputer);
    });

    it('should validate computerId input', async () => {
      await expect(
        orgoRouter.createCaller(caller.mockCtx).getComputer({ computerId: '' })
      ).rejects.toThrow();
    });

    it('should throw TRPCError on not found', async () => {
      caller.mockOrgoClient.getComputer.mockRejectedValueOnce(
        new orgoClientModule.OrgoClientError('Not found', 'API_ERROR', 404)
      );

      await expect(
        orgoRouter.createCaller(caller.mockCtx).getComputer({ computerId: 'nonexistent' })
      ).rejects.toThrow(TRPCError);
    });
  });

  describe('startComputer', () => {
    it('should start a computer', async () => {
      caller.mockOrgoClient.startComputer.mockResolvedValueOnce(undefined);

      const result = await orgoRouter.createCaller(caller.mockCtx).startComputer({
        computerId: 'comp_123',
      });

      expect(result).toEqual({ success: true, computerId: 'comp_123' });
      expect(caller.mockOrgoClient.startComputer).toHaveBeenCalledWith('comp_123');
    });

    it('should validate computerId', async () => {
      await expect(
        orgoRouter.createCaller(caller.mockCtx).startComputer({ computerId: '' })
      ).rejects.toThrow();
    });
  });

  describe('stopComputer', () => {
    it('should stop a computer', async () => {
      caller.mockOrgoClient.stopComputer.mockResolvedValueOnce(undefined);

      const result = await orgoRouter.createCaller(caller.mockCtx).stopComputer({
        computerId: 'comp_123',
      });

      expect(result).toEqual({ success: true, computerId: 'comp_123' });
      expect(caller.mockOrgoClient.stopComputer).toHaveBeenCalledWith('comp_123');
    });
  });

  describe('destroyComputer', () => {
    it('should destroy a computer', async () => {
      caller.mockOrgoClient.destroyComputer.mockResolvedValueOnce(undefined);

      const result = await orgoRouter.createCaller(caller.mockCtx).destroyComputer({
        computerId: 'comp_123',
      });

      expect(result).toEqual({ success: true, computerId: 'comp_123' });
      expect(caller.mockOrgoClient.destroyComputer).toHaveBeenCalledWith('comp_123');
    });
  });

  describe('screenshot', () => {
    it('should get a screenshot', async () => {
      const mockResponse = {
        data: 'base64data',
        width: 1024,
        height: 768,
      };

      caller.mockOrgoClient.screenshot.mockResolvedValueOnce(mockResponse);

      const result = await orgoRouter.createCaller(caller.mockCtx).screenshot({
        computerId: 'comp_123',
      });

      expect(result).toEqual(mockResponse);
    });

    it('should validate computerId', async () => {
      await expect(
        orgoRouter.createCaller(caller.mockCtx).screenshot({ computerId: '' })
      ).rejects.toThrow();
    });
  });

  describe('executeAction', () => {
    it('should execute click action', async () => {
      caller.mockOrgoClient.click.mockResolvedValueOnce(undefined);

      const result = await orgoRouter.createCaller(caller.mockCtx).executeAction({
        computerId: 'comp_123',
        action: 'click',
        params: { x: 100, y: 200 },
      });

      expect(result).toEqual({ success: true, action: 'click' });
      expect(caller.mockOrgoClient.click).toHaveBeenCalledWith('comp_123', 100, 200, undefined);
    });

    it('should execute doubleClick action', async () => {
      caller.mockOrgoClient.doubleClick.mockResolvedValueOnce(undefined);

      const result = await orgoRouter.createCaller(caller.mockCtx).executeAction({
        computerId: 'comp_123',
        action: 'doubleClick',
        params: { x: 100, y: 200 },
      });

      expect(result).toEqual({ success: true, action: 'doubleClick' });
    });

    it('should execute type action', async () => {
      caller.mockOrgoClient.type.mockResolvedValueOnce(undefined);

      const result = await orgoRouter.createCaller(caller.mockCtx).executeAction({
        computerId: 'comp_123',
        action: 'type',
        params: { text: 'hello' },
      });

      expect(result).toEqual({ success: true, action: 'type' });
      expect(caller.mockOrgoClient.type).toHaveBeenCalledWith('comp_123', 'hello');
    });

    it('should execute keyPress action', async () => {
      caller.mockOrgoClient.keyPress.mockResolvedValueOnce(undefined);

      const result = await orgoRouter.createCaller(caller.mockCtx).executeAction({
        computerId: 'comp_123',
        action: 'keyPress',
        params: { key: 'Enter' },
      });

      expect(result).toEqual({ success: true, action: 'keyPress' });
    });

    it('should execute scroll action', async () => {
      caller.mockOrgoClient.scroll.mockResolvedValueOnce(undefined);

      const result = await orgoRouter.createCaller(caller.mockCtx).executeAction({
        computerId: 'comp_123',
        action: 'scroll',
        params: { x: 500, y: 400, deltaX: 0, deltaY: -100 },
      });

      expect(result).toEqual({ success: true, action: 'scroll' });
    });

    it('should execute drag action', async () => {
      caller.mockOrgoClient.drag.mockResolvedValueOnce(undefined);

      const result = await orgoRouter.createCaller(caller.mockCtx).executeAction({
        computerId: 'comp_123',
        action: 'drag',
        params: { startX: 100, startY: 100, endX: 200, endY: 200 },
      });

      expect(result).toEqual({ success: true, action: 'drag' });
    });

    it('should execute exec action with result', async () => {
      const mockResult = { exitCode: 0, stdout: 'success', stderr: '' };
      caller.mockOrgoClient.exec.mockResolvedValueOnce(mockResult);

      const result = await orgoRouter.createCaller(caller.mockCtx).executeAction({
        computerId: 'comp_123',
        action: 'exec',
        params: { command: ['ls', '-la'] },
      });

      expect(result).toEqual({ success: true, action: 'exec', result: mockResult });
    });

    it('should execute bash action with result', async () => {
      const mockResult = { exitCode: 0, stdout: 'result', stderr: '' };
      caller.mockOrgoClient.bash.mockResolvedValueOnce(mockResult);

      const result = await orgoRouter.createCaller(caller.mockCtx).executeAction({
        computerId: 'comp_123',
        action: 'bash',
        params: { command: 'echo hello' },
      });

      expect(result).toEqual({ success: true, action: 'bash', result: mockResult });
    });

    it('should validate action enum', async () => {
      await expect(
        orgoRouter.createCaller(caller.mockCtx).executeAction({
          computerId: 'comp_123',
          action: 'invalid' as any,
          params: {},
        })
      ).rejects.toThrow();
    });

    it('should throw TRPCError on action execution error', async () => {
      caller.mockOrgoClient.click.mockRejectedValueOnce(
        new orgoClientModule.OrgoClientError('Click failed', 'API_ERROR', 400)
      );

      await expect(
        orgoRouter.createCaller(caller.mockCtx).executeAction({
          computerId: 'comp_123',
          action: 'click',
          params: { x: 100, y: 200 },
        })
      ).rejects.toThrow(TRPCError);
    });
  });

  describe('healthCheck', () => {
    it('should return health status', async () => {
      const mockHealth = { status: 'ok', healthy: true };
      const mockConfig = {
        configured: true,
        apiUrl: 'http://localhost:3100',
        hasApiKey: true,
        hasWorkspace: true,
      };

      caller.mockOrgoClient.healthCheck.mockResolvedValueOnce(mockHealth);
      caller.mockOrgoClient.getConfigurationStatus.mockReturnValueOnce(mockConfig);

      const result = await orgoRouter.createCaller(caller.mockCtx).healthCheck();

      expect(result.healthy).toBe(true);
      expect(result.status).toBe('ok');
      expect(result.config).toEqual(mockConfig);
    });

    it('should return unhealthy status on error', async () => {
      caller.mockOrgoClient.healthCheck.mockRejectedValueOnce(new Error('Connection failed'));
      caller.mockOrgoClient.getConfigurationStatus.mockReturnValueOnce({
        configured: false,
        apiUrl: 'http://localhost:3100',
        hasApiKey: false,
        hasWorkspace: false,
      });

      const result = await orgoRouter.createCaller(caller.mockCtx).healthCheck();

      expect(result.healthy).toBe(false);
    });
  });
});
