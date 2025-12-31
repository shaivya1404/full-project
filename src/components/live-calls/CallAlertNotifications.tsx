import { useState, useEffect } from 'react';
import { AlertTriangle, X, Clock, Zap, User, Phone, Volume2, VolumeX } from 'lucide-react';
import type { CallAlert } from '../../types';
import { Button } from '../Button';
import { Badge } from '../Badge';
import { getCallAlerts, markAlertAsRead, dismissAlert } from '../../services/api';
import { formatRelativeTime } from '../../utils/formatters';

interface CallAlertNotificationsProps {
  teamId: string;
  maxAlerts?: number;
}

export const CallAlertNotifications = ({ teamId, maxAlerts = 5 }: CallAlertNotificationsProps) => {
  const [alerts, setAlerts] = useState<CallAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(false);

  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const response = await getCallAlerts(teamId);
        setAlerts(response.filter(alert => !alert.read));
        setLoading(false);
      } catch (error) {
        console.error('Error fetching call alerts:', error);
        setLoading(false);
      }
    };

    fetchAlerts();
    
    // Poll for new alerts every 5 seconds
    const interval = setInterval(fetchAlerts, 5000);
    
    return () => clearInterval(interval);
  }, [teamId]);

  // Play sound for new critical alerts
  useEffect(() => {
    if (soundEnabled && alerts.some(alert => alert.severity === 'critical' && alert.read === false)) {
      // Play notification sound (would need audio file)
      // new Audio('/sounds/alert.mp3').play();
    }
  }, [alerts, soundEnabled]);

  const handleMarkAsRead = async (alertId: string) => {
    try {
      await markAlertAsRead(alertId);
      setAlerts(prev => prev.filter(alert => alert.id !== alertId));
    } catch (error) {
      console.error('Error marking alert as read:', error);
    }
  };

  const handleDismissAlert = async (alertId: string) => {
    try {
      await dismissAlert(alertId);
      setAlerts(prev => prev.filter(alert => alert.id !== alertId));
    } catch (error) {
      console.error('Error dismissing alert:', error);
    }
  };

  const getAlertIcon = (type: CallAlert['type']) => {
    switch (type) {
      case 'sentiment_drop':
        return <AlertTriangle className="text-red-500" size={16} />;
      case 'quality_issue':
        return <VolumeX className="text-yellow-500" size={16} />;
      case 'long_duration':
        return <Clock className="text-blue-500" size={16} />;
      case 'escalation':
        return <Zap className="text-red-500" size={16} />;
      case 'compliance':
        return <AlertTriangle className="text-orange-500" size={16} />;
      default:
        return <AlertTriangle className="text-gray-500" size={16} />;
    }
  };

  const getSeverityColor = (severity: CallAlert['severity']) => {
    switch (severity) {
      case 'critical':
        return 'border-red-500 bg-red-50 dark:bg-red-900/20';
      case 'warning':
        return 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20';
      default:
        return 'border-blue-500 bg-blue-50 dark:bg-blue-900/20';
    }
  };

  const getAlertTypeLabel = (type: CallAlert['type']) => {
    switch (type) {
      case 'sentiment_drop':
        return 'Sentiment Drop';
      case 'quality_issue':
        return 'Quality Issue';
      case 'long_duration':
        return 'Long Call';
      case 'escalation':
        return 'Escalation Request';
      case 'compliance':
        return 'Compliance Alert';
      default:
        return 'Alert';
    }
  };

  if (loading || alerts.length === 0) {
    return null;
  }

  const displayAlerts = alerts.slice(0, maxAlerts);
  const unreadCount = alerts.filter(alert => !alert.read).length;

  return (
    <div className="space-y-3">
      {/* Header with Sound Toggle */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-900 dark:text-white">
          Live Call Alerts
          {unreadCount > 0 && (
            <Badge variant="destructive" className="ml-2">
              {unreadCount}
            </Badge>
          )}
        </h3>
        
        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="text-xs"
          >
            {soundEnabled ? (
              <Volume2 size={14} className="mr-1" />
            ) : (
              <VolumeX size={14} className="mr-1" />
            )}
            {soundEnabled ? 'Sound On' : 'Sound Off'}
          </Button>
        </div>
      </div>

      {/* Alert List */}
      <div className="space-y-2">
        {displayAlerts.map((alert) => (
          <div
            key={alert.id}
            className={`border-l-4 rounded-r-lg p-4 ${getSeverityColor(alert.severity)} transition-all duration-200 hover:shadow-md`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-3 flex-1">
                <div className="flex-shrink-0 mt-0.5">
                  {getAlertIcon(alert.type)}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {getAlertTypeLabel(alert.type)}
                    </span>
                    <Badge 
                      variant={alert.severity === 'critical' ? 'destructive' : 'secondary'}
                      className="text-xs"
                    >
                      {alert.severity}
                    </Badge>
                  </div>
                  
                  <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                    {alert.message}
                  </p>
                  
                  <div className="flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400">
                    <div className="flex items-center space-x-1">
                      <Phone size={12} />
                      <span>Call ID: {alert.callId.slice(-8)}</span>
                    </div>
                    <span>{formatRelativeTime(alert.timestamp)}</span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center space-x-2 ml-4">
                {!alert.read && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleMarkAsRead(alert.id)}
                    className="text-xs"
                  >
                    Mark Read
                  </Button>
                )}
                
                <button
                  onClick={() => handleDismissAlert(alert.id)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          </div>
        ))}
        
        {alerts.length > maxAlerts && (
          <div className="text-center">
            <Button variant="outline" size="sm">
              View {alerts.length - maxAlerts} more alert{alerts.length - maxAlerts !== 1 ? 's' : ''}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};