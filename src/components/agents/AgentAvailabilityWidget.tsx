import { Clock, Moon, CheckCircle2, AlertCircle, LogOut } from 'lucide-react';
import { useState, useEffect } from 'react';
import type { Agent } from '../../types';
import { Button } from '../Button';

type AgentAvailabilityWidgetProps = {
  agent: Agent;
  onStatusChange: (status: Agent['status']) => void;
  loading?: boolean;
};

export const AgentAvailabilityWidget = ({ agent, onStatusChange, loading }: AgentAvailabilityWidgetProps) => {
  const [timeInStatus, setTimeInStatus] = useState(0);

  useEffect(() => {
    // Reset timer when status changes
    setTimeInStatus(0);
    const interval = setInterval(() => {
      setTimeInStatus((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [agent.status]);

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs > 0 ? hrs + 'h ' : ''}${mins}m ${secs}s`;
  };

  const statusConfig = {
    online: { icon: CheckCircle2, color: 'text-green-500', bg: 'bg-green-100', label: 'Online' },
    offline: { icon: LogOut, color: 'text-gray-500', bg: 'bg-gray-100', label: 'Offline' },
    break: { icon: Moon, color: 'text-yellow-500', bg: 'bg-yellow-100', label: 'On Break' },
    away: { icon: Clock, color: 'text-orange-500', bg: 'bg-orange-100', label: 'Away' },
    busy: { icon: AlertCircle, color: 'text-red-500', bg: 'bg-red-100', label: 'Busy' },
  };

  const currentStatus = statusConfig[agent.status];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Live Status</h3>
        <div className={`px-3 py-1 rounded-full ${currentStatus.bg} flex items-center gap-2`}>
          <currentStatus.icon size={16} className={currentStatus.color} />
          <span className={`text-sm font-bold ${currentStatus.color}`}>{currentStatus.label}</span>
        </div>
      </div>

      <div className="text-center mb-8">
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Time in Current Status</p>
        <p className="text-4xl font-bold text-gray-900 dark:text-white font-mono">{formatTime(timeInStatus)}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Button
          variant={agent.status === 'online' ? 'primary' : 'secondary'}
          onClick={() => onStatusChange('online')}
          disabled={agent.status === 'online' || loading}
          className="justify-center"
        >
          Go Online
        </Button>
        <Button
          variant={agent.status === 'busy' ? 'primary' : 'secondary'}
          onClick={() => onStatusChange('busy')}
          disabled={agent.status === 'busy' || loading}
          className="justify-center"
        >
          Mark Busy
        </Button>
        <Button
          variant={agent.status === 'break' ? 'primary' : 'secondary'}
          onClick={() => onStatusChange('break')}
          disabled={agent.status === 'break' || loading}
          className="justify-center"
        >
          Take Break
        </Button>
        <Button
          variant={agent.status === 'offline' ? 'primary' : 'secondary'}
          onClick={() => onStatusChange('offline')}
          disabled={agent.status === 'offline' || loading}
          className="justify-center"
        >
          Go Offline
        </Button>
      </div>

      <div className="mt-6 pt-6 border-t border-gray-100 dark:border-gray-700">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-gray-500 dark:text-gray-400">Daily Login Time</span>
          <span className="font-medium text-gray-900 dark:text-white">6h 45m</span>
        </div>
        <div className="w-full h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
          <div className="h-full bg-primary" style={{ width: '85%' }}></div>
        </div>
      </div>
    </div>
  );
};
