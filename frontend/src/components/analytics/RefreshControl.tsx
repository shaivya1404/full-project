import React, { useState, useEffect, useRef } from 'react';
import { RefreshCw } from 'lucide-react';
import clsx from 'clsx';

interface RefreshControlProps {
  onRefresh: () => void;
  isLoading?: boolean;
  lastRefresh?: Date;
}

export const RefreshControl: React.FC<RefreshControlProps> = ({ onRefresh, isLoading, lastRefresh }) => {
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [timeUntilRefresh, setTimeUntilRefresh] = useState(30);
  const intervalRef = useRef<number | undefined>(undefined);

  // Handle auto-refresh countdown
  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = window.setInterval(() => {
        setTimeUntilRefresh((prev) => {
          if (prev <= 1) {
            onRefresh();
            return 30;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = undefined;
      }
    };
  }, [autoRefresh, onRefresh]);

  const handleRefresh = () => {
    onRefresh();
    if (autoRefresh) {
      setTimeUntilRefresh(30);
    }
  };

  const toggleAutoRefresh = () => {
    const newValue = !autoRefresh;
    setAutoRefresh(newValue);
    if (!newValue) {
      // Reset timer when turning off auto-refresh
      setTimeUntilRefresh(30);
    }
  };

  const formatLastRefresh = () => {
    if (!lastRefresh) return 'Never';
    const now = new Date();
    const diff = Math.floor((now.getTime() - lastRefresh.getTime()) / 1000);

    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return `${Math.floor(diff / 3600)}h ago`;
  };

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={handleRefresh}
        disabled={isLoading}
        className={clsx(
          'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
          isLoading
            ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed'
            : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
        )}
      >
        <RefreshCw size={16} className={clsx({ 'animate-spin': isLoading })} />
        Refresh
      </button>

      <div className="flex items-center gap-2">
        <button
          onClick={toggleAutoRefresh}
          className={clsx(
            'relative w-11 h-6 rounded-full transition-colors',
            autoRefresh ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'
          )}
        >
          <span
            className={clsx(
              'absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow-sm',
              autoRefresh ? 'left-5.5' : 'left-0.5'
            )}
          />
        </button>
        <span className="text-sm text-gray-700 dark:text-gray-300">Auto-refresh</span>
      </div>

      {autoRefresh && (
        <span className="text-xs text-gray-500 dark:text-gray-400 min-w-[60px]">
          {timeUntilRefresh}s
        </span>
      )}

      <span className="text-sm text-gray-500 dark:text-gray-400">
        Last: {formatLastRefresh()}
      </span>
    </div>
  );
};
