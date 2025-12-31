import { History, Phone, LogIn, LogOut, Coffee, Clock, FileText } from 'lucide-react';
import type { AgentActivityLogEntry } from '../../types';

type AgentActivityLogProps = {
  activities: AgentActivityLogEntry[];
  loading?: boolean;
};

export const AgentActivityLog = ({ activities, loading }: AgentActivityLogProps) => {
  const getIcon = (type: AgentActivityLogEntry['activityType']) => {
    switch (type) {
      case 'call': return { icon: Phone, color: 'text-blue-500', bg: 'bg-blue-100 dark:bg-blue-900/30' };
      case 'status_change': return { icon: Clock, color: 'text-yellow-500', bg: 'bg-yellow-100 dark:bg-yellow-900/30' };
      case 'login': return { icon: LogIn, color: 'text-green-500', bg: 'bg-green-100 dark:bg-green-900/30' };
      case 'logout': return { icon: LogOut, color: 'text-red-500', bg: 'bg-red-100 dark:bg-red-900/30' };
      case 'break': return { icon: Coffee, color: 'text-orange-500', bg: 'bg-orange-100 dark:bg-orange-900/30' };
      case 'note': return { icon: FileText, color: 'text-purple-500', bg: 'bg-purple-100 dark:bg-purple-900/30' };
      default: return { icon: History, color: 'text-gray-500', bg: 'bg-gray-100 dark:bg-gray-900/30' };
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return null;
    if (seconds < 60) return `${seconds}s`;
    return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
          <History size={20} className="mr-2 text-primary" />
          Activity Log
        </h3>
      </div>

      <div className="p-6">
        {activities.length === 0 ? (
          <p className="text-center text-gray-500 dark:text-gray-400 py-4">No recent activity found.</p>
        ) : (
          <div className="space-y-6">
            {activities.map((activity, index) => {
              const { icon: Icon, color, bg } = getIcon(activity.activityType);
              const isLast = index === activities.length - 1;

              return (
                <div key={activity.id} className="relative flex gap-4">
                  {!isLast && (
                    <div className="absolute left-[19px] top-8 bottom-[-24px] w-[2px] bg-gray-100 dark:bg-gray-700"></div>
                  )}
                  <div className={`flex-shrink-0 w-10 h-10 rounded-full ${bg} flex items-center justify-center z-10`}>
                    <Icon size={18} className={color} />
                  </div>
                  <div className="flex-1 pb-6">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm font-bold text-gray-900 dark:text-white capitalize">
                          {activity.activityType.replace('_', ' ')}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          {activity.description}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                          {new Date(activity.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                        {activity.duration && (
                          <p className="text-xs text-gray-400 mt-1">
                            Duration: {formatDuration(activity.duration)}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
