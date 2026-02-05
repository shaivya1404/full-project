import { useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { useWebSocket, WSMessage } from '../hooks/useWebSocket';
import { useAuthStore } from '../store/authStore';

/**
 * WebSocket provider component that shows toast notifications for real-time events
 */
export const WebSocketProvider = () => {
  const { isAuthenticated } = useAuthStore();

  const handleMessage = useCallback((message: WSMessage) => {
    // Handle different notification types
    switch (message.type) {
      case 'calls':
        handleCallNotification(message);
        break;
      case 'orders':
        handleOrderNotification(message);
        break;
      case 'queue':
        handleQueueNotification(message);
        break;
      case 'alerts':
        handleAlertNotification(message);
        break;
      case 'notifications':
        handleUserNotification(message);
        break;
      default:
        break;
    }
  }, []);

  const handleConnect = useCallback(() => {
    console.log('WebSocket connected');
  }, []);

  const handleDisconnect = useCallback(() => {
    console.log('WebSocket disconnected');
  }, []);

  // Connect to WebSocket with all channels
  const { isConnected } = useWebSocket({
    channels: ['calls', 'orders', 'queue', 'alerts', 'notifications'],
    onMessage: handleMessage,
    onConnect: handleConnect,
    onDisconnect: handleDisconnect,
  });

  // Log connection status changes
  useEffect(() => {
    if (isAuthenticated && isConnected) {
      console.log('Real-time notifications active');
    }
  }, [isAuthenticated, isConnected]);

  return null; // This component doesn't render anything
};

// Notification handlers

function handleCallNotification(message: WSMessage) {
  const { event, payload } = message;

  switch (event) {
    case 'call.started':
      toast.success(`New call: ${payload.callId?.slice(-6) || 'incoming'}`, {
        icon: '\u{1F4DE}',
        duration: 5000,
      });
      break;

    case 'call.transferred':
      toast(`Call transferred to ${payload.agentName || 'agent'}`, {
        icon: '\u{1F504}',
        duration: 4000,
      });
      break;

    case 'call.sentiment_alert':
      if (payload.score < 0.3) {
        toast.error(`Customer sentiment alert: ${payload.sentiment}`, {
          icon: '\u{26A0}\u{FE0F}',
          duration: 6000,
        });
      }
      break;

    case 'call.ended':
      // Don't show toast for ended calls, too noisy
      break;

    default:
      break;
  }
}

function handleOrderNotification(message: WSMessage) {
  const { event, payload } = message;

  switch (event) {
    case 'order.created':
    case 'order.status_changed':
      if (payload.status === 'pending') {
        toast.success(`New order: ${payload.orderNumber || payload.orderId?.slice(-6)}`, {
          icon: '\u{1F4E6}',
          duration: 5000,
        });
      } else if (payload.status === 'cancelled') {
        toast.error(`Order cancelled: ${payload.orderNumber || payload.orderId?.slice(-6)}`, {
          icon: '\u{274C}',
          duration: 5000,
        });
      }
      break;

    case 'order.payment_received':
      toast.success(`Payment received for ${payload.orderNumber || 'order'}`, {
        icon: '\u{1F4B3}',
        duration: 4000,
      });
      break;

    default:
      break;
  }
}

function handleQueueNotification(message: WSMessage) {
  const { event, payload } = message;

  switch (event) {
    case 'queue.call_added':
      toast(`Call added to queue: ${payload.reason || 'Transfer requested'}`, {
        icon: '\u{23F3}',
        duration: 4000,
      });
      break;

    case 'queue.call_assigned':
      toast.success(`Call assigned to ${payload.agentName || 'agent'}`, {
        icon: '\u{2705}',
        duration: 4000,
      });
      break;

    default:
      break;
  }
}

function handleAlertNotification(message: WSMessage) {
  const { event, payload } = message;
  const alertType = event.replace('alert.', '');

  switch (alertType) {
    case 'high_priority':
      toast.error(payload.message || 'High priority alert', {
        icon: '\u{1F6A8}',
        duration: 8000,
      });
      break;

    case 'low_stock':
      toast(payload.message || 'Low stock alert', {
        icon: '\u{1F4E6}',
        duration: 5000,
      });
      break;

    case 'compliance':
      toast.error(payload.message || 'Compliance alert', {
        icon: '\u{26A0}\u{FE0F}',
        duration: 6000,
      });
      break;

    case 'system':
      toast(payload.message || 'System notification', {
        icon: '\u{2139}\u{FE0F}',
        duration: 5000,
      });
      break;

    default:
      break;
  }
}

function handleUserNotification(message: WSMessage) {
  const { event, payload } = message;

  if (event === 'notification.new') {
    toast(
      <div>
        <strong>{payload.title}</strong>
        <p className="text-sm mt-1">{payload.message}</p>
      </div>,
      {
        icon: '\u{1F514}',
        duration: 5000,
      }
    );
  }
}

export default WebSocketProvider;
