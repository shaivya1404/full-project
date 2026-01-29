import { Play, XCircle, Clock, User, Phone } from 'lucide-react';
import type { AgentQueueItem } from '../../types';
import { Button } from '../Button';
import { Badge } from '../Badge';

type AgentQueuePanelProps = {
  queue: AgentQueueItem[];
  onAccept: (callId: string) => void;
  onDecline: (callId: string) => void;
};

export const AgentQueuePanel = ({ queue, onAccept, onDecline }: AgentQueuePanelProps) => {
  const formatWaitTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
          <Phone size={20} className="mr-2 text-primary" />
          Active Queue
          {queue.length > 0 && (
            <span className="ml-2 px-2 py-0.5 bg-primary text-white text-xs rounded-full font-bold">
              {queue.length}
            </span>
          )}
        </h3>
      </div>

      <div className="p-4">
        {queue.length === 0 ? (
          <div className="text-center py-8">
            <div className="bg-gray-100 dark:bg-gray-900 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
              <Phone size={24} className="text-gray-400" />
            </div>
            <p className="text-gray-500 dark:text-gray-400">Queue is currently empty</p>
          </div>
        ) : (
          <div className="space-y-3">
            {queue.map((item) => (
              <div
                key={item.callId}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900/50 hover:border-primary/50 transition-colors"
              >
                <div className="flex items-center gap-4 mb-3 sm:mb-0">
                  <div className="h-10 w-10 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold">
                    {item.position}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-gray-900 dark:text-white">{item.customerName}</p>
                      <Badge variant="neutral">{item.skillRequired}</Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <Clock size={14} />
                        Wait: {formatWaitTime(item.waitTime)}
                      </span>
                      <span className="flex items-center gap-1">
                        <User size={14} />
                        ID: {item.customerId}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="flex-1 sm:flex-none border-red-200 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                    onClick={() => onDecline(item.callId)}
                  >
                    <XCircle size={16} className="mr-1" /> Decline
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    className="flex-1 sm:flex-none"
                    onClick={() => onAccept(item.callId)}
                  >
                    <Play size={16} className="mr-1" /> Accept
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
