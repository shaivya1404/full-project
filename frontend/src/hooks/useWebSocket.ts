import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuthStore } from '../store/authStore';

export type NotificationChannel =
  | 'calls'
  | 'orders'
  | 'agents'
  | 'queue'
  | 'alerts'
  | 'notifications'
  | 'analytics';

export interface WSMessage {
  type: string;
  event: string;
  payload: any;
  timestamp: string;
}

export interface UseWebSocketOptions {
  channels?: NotificationChannel[];
  onMessage?: (message: WSMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  autoReconnect?: boolean;
  reconnectInterval?: number;
}

export interface WebSocketState {
  isConnected: boolean;
  lastMessage: WSMessage | null;
  subscribedChannels: NotificationChannel[];
}

/**
 * Hook for WebSocket real-time notifications
 */
export function useWebSocket(options: UseWebSocketOptions = {}) {
  const {
    channels = ['notifications'],
    onMessage,
    onConnect,
    onDisconnect,
    autoReconnect = true,
    reconnectInterval = 5000,
  } = options;

  const { accessToken: token, isAuthenticated } = useAuthStore();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef<number>(0);
  const [state, setState] = useState<WebSocketState>({
    isConnected: false,
    lastMessage: null,
    subscribedChannels: [],
  });

  const connect = useCallback(() => {
    if (!isAuthenticated || !token) return;

    // Close existing connection
    if (wsRef.current) {
      wsRef.current.close();
    }

    // Build WebSocket URL
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = import.meta.env.VITE_WS_URL || window.location.host;
    const wsUrl = `${protocol}//${host}/ws?token=${token}`;

    let wasConnected = false;

    try {
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        wasConnected = true;
        retryCountRef.current = 0;
        setState((prev) => ({ ...prev, isConnected: true }));
        onConnect?.();

        // Subscribe to channels
        if (channels.length > 0) {
          ws.send(JSON.stringify({
            type: 'subscribe',
            channels,
          }));
        }
      };

      ws.onmessage = (event) => {
        try {
          const message: WSMessage = JSON.parse(event.data);

          // Handle system events
          if (message.type === 'system') {
            if (message.event === 'connected') {
              setState((prev) => ({
                ...prev,
                subscribedChannels: message.payload.subscribedChannels || [],
              }));
            } else if (message.event === 'subscribed') {
              setState((prev) => ({
                ...prev,
                subscribedChannels: message.payload.channels || [],
              }));
            }
          }

          setState((prev) => ({ ...prev, lastMessage: message }));
          onMessage?.(message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onclose = (_event) => {
        setState((prev) => ({ ...prev, isConnected: false }));
        onDisconnect?.();

        // If the connection was rejected before opening (auth failure),
        // don't retry — the token is invalid
        if (!wasConnected) {
          retryCountRef.current++;
          // Stop retrying after 3 failed attempts (token is likely invalid)
          if (retryCountRef.current >= 3) {
            console.warn('WebSocket: stopping reconnect after repeated auth failures');
            return;
          }
        }

        // Auto-reconnect with exponential backoff
        if (autoReconnect && isAuthenticated) {
          const backoff = Math.min(reconnectInterval * Math.pow(2, retryCountRef.current - 1), 30000);
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, wasConnected ? reconnectInterval : backoff);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('Error creating WebSocket:', error);
    }
  }, [isAuthenticated, token, channels, onMessage, onConnect, onDisconnect, autoReconnect, reconnectInterval]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const subscribe = useCallback((newChannels: NotificationChannel[]) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'subscribe',
        channels: newChannels,
      }));
    }
  }, []);

  const unsubscribe = useCallback((channelsToRemove: NotificationChannel[]) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'unsubscribe',
        channels: channelsToRemove,
      }));
    }
  }, []);

  const sendPing = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'ping' }));
    }
  }, []);

  // Connect on mount
  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    ...state,
    connect,
    disconnect,
    subscribe,
    unsubscribe,
    sendPing,
  };
}

/**
 * Hook for call notifications
 */
export function useCallNotifications(onCallEvent?: (event: string, data: any) => void) {
  const handleMessage = useCallback((message: WSMessage) => {
    if (message.type === 'calls') {
      onCallEvent?.(message.event, message.payload);
    }
  }, [onCallEvent]);

  return useWebSocket({
    channels: ['calls'],
    onMessage: handleMessage,
  });
}

/**
 * Hook for order notifications
 */
export function useOrderNotifications(onOrderEvent?: (event: string, data: any) => void) {
  const handleMessage = useCallback((message: WSMessage) => {
    if (message.type === 'orders') {
      onOrderEvent?.(message.event, message.payload);
    }
  }, [onOrderEvent]);

  return useWebSocket({
    channels: ['orders'],
    onMessage: handleMessage,
  });
}

/**
 * Hook for queue notifications
 */
export function useQueueNotifications(onQueueEvent?: (event: string, data: any) => void) {
  const handleMessage = useCallback((message: WSMessage) => {
    if (message.type === 'queue') {
      onQueueEvent?.(message.event, message.payload);
    }
  }, [onQueueEvent]);

  return useWebSocket({
    channels: ['queue'],
    onMessage: handleMessage,
  });
}

/**
 * Hook for alert notifications
 */
export function useAlertNotifications(onAlert?: (alertType: string, message: string, data?: any) => void) {
  const handleMessage = useCallback((message: WSMessage) => {
    if (message.type === 'alerts') {
      const alertType = message.event.replace('alert.', '');
      onAlert?.(alertType, message.payload.message, message.payload);
    }
  }, [onAlert]);

  return useWebSocket({
    channels: ['alerts'],
    onMessage: handleMessage,
  });
}

/**
 * Hook for user notifications
 */
export function useNotifications(onNotification?: (title: string, message: string, actionUrl?: string) => void) {
  const handleMessage = useCallback((message: WSMessage) => {
    if (message.type === 'notifications' && message.event === 'notification.new') {
      const { title, message: msg, actionUrl } = message.payload;
      onNotification?.(title, msg, actionUrl);
    }
  }, [onNotification]);

  return useWebSocket({
    channels: ['notifications'],
    onMessage: handleMessage,
  });
}

export default useWebSocket;
