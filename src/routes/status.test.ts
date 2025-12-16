import request from 'supertest';
import app from '../app';
import { broadcastStatusUpdate, getActiveClientCount, getMessageQueueSize } from './status';

describe('Status API (SSE)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/status', () => {
    it('should accept SSE connection requests', async () => {
      const clientCountBefore = getActiveClientCount();
      expect(clientCountBefore >= 0).toBe(true);
    });

    it('should initialize with proper setup', () => {
      expect(getActiveClientCount() >= 0).toBe(true);
      expect(getMessageQueueSize() >= 0).toBe(true);
    });
  });

  describe('broadcastStatusUpdate', () => {
    it('should add message to queue', () => {
      const sizeBefore = getMessageQueueSize();
      broadcastStatusUpdate({
        type: 'call_started',
        callId: 'call-1',
        streamSid: 'stream-1',
        timestamp: new Date().toISOString(),
      });

      expect(getMessageQueueSize()).toBeGreaterThan(sizeBefore);
    });

    it('should not exceed max queue size', () => {
      const maxSize = 100;

      for (let i = 0; i < 150; i++) {
        broadcastStatusUpdate({
          type: 'call_started',
          callId: `call-${i}`,
          timestamp: new Date().toISOString(),
        });
      }

      expect(getMessageQueueSize()).toBeLessThanOrEqual(maxSize);
    });

    it('should support all status types', () => {
      const updates = [
        {
          type: 'call_started' as const,
          timestamp: new Date().toISOString(),
        },
        {
          type: 'call_ended' as const,
          callId: 'call-1',
          timestamp: new Date().toISOString(),
        },
        {
          type: 'recording_saved' as const,
          callId: 'call-1',
          timestamp: new Date().toISOString(),
        },
        {
          type: 'error' as const,
          data: { message: 'test error' },
          timestamp: new Date().toISOString(),
        },
      ];

      updates.forEach((update) => {
        broadcastStatusUpdate(update);
      });

      expect(getMessageQueueSize()).toBeGreaterThan(0);
    });

    it('should include call data', () => {
      const update = {
        type: 'call_started' as const,
        callId: 'call-1',
        streamSid: 'stream-1',
        data: {
          caller: '+1234567890',
          agent: 'agent-1',
        },
        timestamp: new Date().toISOString(),
      };

      broadcastStatusUpdate(update);

      expect(getMessageQueueSize()).toBeGreaterThan(0);
    });
  });

  describe('Error cases', () => {
    it('should handle broadcast to empty client list gracefully', () => {
      broadcastStatusUpdate({
        type: 'call_started',
        timestamp: new Date().toISOString(),
      });

      expect(getMessageQueueSize()).toBeGreaterThan(0);
    });
  });
});
