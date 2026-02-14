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
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCountRef = useRef<number>(0);
  const mountedRef = useRef(true);

  // Store callbacks in refs to avoid re-creating the connect function
  const onMessageRef = useRef(onMessage);
  const onConnectRef = useRef(onConnect);
  const onDisconnectRef = useRef(onDisconnect);
  const channelsRef = useRef(channels);

  onMessageRef.current = onMessage;
  onConnectRef.current = onConnect;
  onDisconnectRef.current = onDisconnect;
  channelsRef.current = channels;

  const [state, setState] = useState<WebSocketState>({
    isConnected: false,
    lastMessage: null,
    subscribedChannels: [],
  });

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.onclose = null; // Prevent reconnect on intentional close
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    if (!isAuthenticated || !token) return;
    if (!mountedRef.current) return;

    // Close existing connection
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
      wsRef.current = null;
    }

    // Build WebSocket URL - go through nginx proxy
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = import.meta.env.VITE_WS_URL || window.location.host;
    const wsUrl = `${wsProtocol}//${wsHost}/ws?token=${token}`;

    let wasConnected = false;

    try {
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        wasConnected = true;
        retryCountRef.current = 0;
        if (mountedRef.current) {
          setState((prev) => ({ ...prev, isConnected: true }));
        }
        onConnectRef.current?.();

        // Subscribe to channels
        const ch = channelsRef.current;
        if (ch.length > 0) {
          ws.send(JSON.stringify({ type: 'subscribe', channels: ch }));
        }
      };

      ws.onmessage = (event) => {
        try {
          const message: WSMessage = JSON.parse(event.data);

          if (message.type === 'system') {
            if (message.event === 'connected') {
              if (mountedRef.current) {
                setState((prev) => ({
                  ...prev,
                  subscribedChannels: message.payload.subscribedChannels || [],
                }));
              }
            } else if (message.event === 'subscribed') {
              if (mountedRef.current) {
                setState((prev) => ({
                  ...prev,
                  subscribedChannels: message.payload.channels || [],
                }));
              }
            }
          }

          if (mountedRef.current) {
            setState((prev) => ({ ...prev, lastMessage: message }));
          }
          onMessageRef.current?.(message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onclose = () => {
        if (mountedRef.current) {
          setState((prev) => ({ ...prev, isConnected: false }));
        }
        onDisconnectRef.current?.();

        if (!wasConnected) {
          retryCountRef.current++;
        }

        // Stop retrying after 3 failed attempts
        if (retryCountRef.current >= 3) {
          console.warn('WebSocket: stopped reconnecting after 3 failed attempts');
          return;
        }

        // Auto-reconnect
        if (autoReconnect && mountedRef.current) {
          const backoff = Math.min(reconnectInterval * Math.pow(2, retryCountRef.current), 30000);
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, wasConnected ? reconnectInterval : backoff);
        }
      };

      ws.onerror = () => {
        // onclose handles reconnect
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('Error creating WebSocket:', error);
    }
  // Only reconnect when token or auth status changes
  }, [isAuthenticated, token, autoReconnect, reconnectInterval]);

  const subscribe = useCallback((newChannels: NotificationChannel[]) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'subscribe', channels: newChannels }));
    }
  }, []);

  const unsubscribe = useCallback((channelsToRemove: NotificationChannel[]) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'unsubscribe', channels: channelsToRemove }));
    }
  }, []);

  const sendPing = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'ping' }));
    }
  }, []);

  // Connect on mount, disconnect on unmount
  useEffect(() => {
    mountedRef.current = true;
    connect();

    return () => {
      mountedRef.current = false;
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
