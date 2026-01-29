import React from 'react';
import { Card } from '../Card';
import type { CallQualityMetrics as CallQualityMetricsType } from '../../types';
import { Activity, Zap, Signal, Clock } from 'lucide-react';
import clsx from 'clsx';

interface CallQualityMetricsProps {
  metrics?: CallQualityMetricsType;
  isLoading?: boolean;
}

export const CallQualityMetrics: React.FC<CallQualityMetricsProps> = ({ metrics, isLoading }) => {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="h-32 animate-pulse bg-gray-100 dark:bg-gray-800" />
        ))}
      </div>
    );
  }

  if (!metrics) {
    return (
      <Card>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Call Quality Metrics</h3>
        <div className="h-64 flex items-center justify-center text-gray-500 dark:text-gray-400">
          No quality data available
        </div>
      </Card>
    );
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}m ${secs}s`;
  };

  const getQualityColor = (score: number) => {
    if (score >= 80) return { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-600 dark:text-green-400', bar: 'bg-green-500' };
    if (score >= 60) return { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-600 dark:text-yellow-400', bar: 'bg-yellow-500' };
    return { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-600 dark:text-red-400', bar: 'bg-red-500' };
  };

  const qualityColor = getQualityColor(metrics.connectionQuality);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Avg Talk Time */}
      <Card className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className={clsx('p-2 rounded-lg', 'bg-blue-100 dark:bg-blue-900/30')}>
            <Clock size={20} className="text-blue-600 dark:text-blue-400" />
          </div>
          <span className="text-xs text-gray-500 dark:text-gray-400">Avg Talk Time</span>
        </div>
        <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
          {formatDuration(metrics.avgTalkTime)}
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400">per call</p>
      </Card>

      {/* Interruption Rate */}
      <Card className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className={clsx('p-2 rounded-lg', 'bg-orange-100 dark:bg-orange-900/30')}>
            <Zap size={20} className="text-orange-600 dark:text-orange-400" />
          </div>
          <span className="text-xs text-gray-500 dark:text-gray-400">Interruption Rate</span>
        </div>
        <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
          {(metrics.interruptionRate * 100).toFixed(1)}%
        </p>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-2">
          <div
            className={clsx('h-2 rounded-full transition-all', qualityColor.bar)}
            style={{ width: `${metrics.interruptionRate * 100}%` }}
          />
        </div>
      </Card>

      {/* Avg Latency */}
      <Card className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className={clsx('p-2 rounded-lg', 'bg-purple-100 dark:bg-purple-900/30')}>
            <Activity size={20} className="text-purple-600 dark:text-purple-400" />
          </div>
          <span className="text-xs text-gray-500 dark:text-gray-400">Avg Latency</span>
        </div>
        <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
          {metrics.avgLatency.toFixed(0)}ms
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {metrics.avgLatency < 100 ? 'Excellent' : metrics.avgLatency < 200 ? 'Good' : 'Fair'}
        </p>
      </Card>

      {/* Connection Quality */}
      <Card className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className={clsx('p-2 rounded-lg', qualityColor.bg)}>
            <Signal size={20} className={qualityColor.text} />
          </div>
          <span className="text-xs text-gray-500 dark:text-gray-400">Connection Quality</span>
        </div>
        <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
          {metrics.connectionQuality}/100
        </p>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-2">
          <div
            className={clsx('h-2 rounded-full transition-all', qualityColor.bar)}
            style={{ width: `${metrics.connectionQuality}%` }}
          />
        </div>
      </Card>
    </div>
  );
};
