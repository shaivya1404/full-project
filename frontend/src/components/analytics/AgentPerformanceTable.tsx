import React, { useState, useMemo } from 'react';
import { Card } from '../Card';
import type { AgentPerformance } from '../../types';
import { ArrowUp, ArrowDown } from 'lucide-react';
import clsx from 'clsx';

interface AgentPerformanceTableProps {
  data?: AgentPerformance[];
  isLoading?: boolean;
}

type SortField = keyof AgentPerformance;
type SortOrder = 'asc' | 'desc';

export const AgentPerformanceTable: React.FC<AgentPerformanceTableProps> = ({ data, isLoading }) => {
  const [sortField, setSortField] = useState<SortField>('callsHandled');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const sortedData = useMemo(() => {
    if (!data) return [];
    return [...data].sort((a, b) => {
      const aValue = a[sortField];
      const bValue = b[sortField];

      if (aValue === bValue) return 0;

      const comparison = aValue < bValue ? -1 : 1;
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [data, sortField, sortOrder]);

  if (isLoading) {
    return <Card className="h-96 animate-pulse bg-gray-100 dark:bg-gray-800" />;
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Agent Performance</h3>
        <div className="h-64 flex items-center justify-center text-gray-500 dark:text-gray-400">
          No agent data available
        </div>
      </Card>
    );
  }

  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const getCompletionRateColor = (rate: number) => {
    if (rate >= 90) return 'text-green-600 dark:text-green-400';
    if (rate >= 70) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getSentimentColor = (score: number) => {
    if (score >= 70) return 'text-green-600 dark:text-green-400';
    if (score >= 40) return 'text-gray-600 dark:text-gray-400';
    return 'text-red-600 dark:text-red-400';
  };

  return (
    <Card>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Agent Performance</h3>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              {[
                { key: 'agentName' as SortField, label: 'Agent' },
                { key: 'callsHandled' as SortField, label: 'Calls Handled' },
                { key: 'avgDuration' as SortField, label: 'Avg Duration' },
                { key: 'completionRate' as SortField, label: 'Completion Rate' },
                { key: 'avgSentimentScore' as SortField, label: 'Avg Sentiment' },
              ].map((column) => (
                <th
                  key={column.key}
                  onClick={() => handleSort(column.key)}
                  className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors select-none"
                >
                  <div className="flex items-center gap-1">
                    {column.label}
                    {sortField === column.key && (
                      sortOrder === 'asc' ? (
                        <ArrowUp size={14} className="text-primary" />
                      ) : (
                        <ArrowDown size={14} className="text-primary" />
                      )
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedData.map((agent) => (
              <tr
                key={agent.agentId}
                className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-semibold text-sm">
                      {(agent.agentName || 'A').charAt(0).toUpperCase()}
                    </div>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {agent.agentName}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-700 dark:text-gray-300 font-medium">
                  {agent.callsHandled.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                  {formatDuration(agent.avgDuration)}
                </td>
                <td className="px-4 py-3">
                  <span className={clsx('font-semibold', getCompletionRateColor(agent.completionRate))}>
                    {agent.completionRate.toFixed(1)}%
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={clsx('font-semibold', getSentimentColor(agent.avgSentimentScore))}>
                    {agent.avgSentimentScore.toFixed(1)}/100
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Performance Summary */}
      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Top Performer</p>
          <p className="text-sm font-semibold text-gray-900 dark:text-white">
            {sortedData[0]?.agentName || '-'}
          </p>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            {sortedData[0]?.completionRate.toFixed(1)}% completion
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Most Calls</p>
          <p className="text-sm font-semibold text-gray-900 dark:text-white">
            {sortedData.sort((a, b) => b.callsHandled - a.callsHandled)[0]?.agentName || '-'}
          </p>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            {sortedData.sort((a, b) => b.callsHandled - a.callsHandled)[0]?.callsHandled} calls
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Best Sentiment</p>
          <p className="text-sm font-semibold text-gray-900 dark:text-white">
            {sortedData.sort((a, b) => b.avgSentimentScore - a.avgSentimentScore)[0]?.agentName || '-'}
          </p>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            {sortedData.sort((a, b) => b.avgSentimentScore - a.avgSentimentScore)[0]?.avgSentimentScore.toFixed(1)}/100
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Total Agents</p>
          <p className="text-sm font-semibold text-gray-900 dark:text-white">
            {data.length}
          </p>
          <p className="text-xs text-gray-600 dark:text-gray-400">active</p>
        </div>
      </div>
    </Card>
  );
};
