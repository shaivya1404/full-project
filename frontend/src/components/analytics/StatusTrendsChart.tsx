import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Card } from '../Card';
import type { CallStats, CallStatus } from '../../types';

interface StatusTrendsChartProps {
  data?: CallStats['statusTrends'];
  isLoading?: boolean;
}

const COLORS: Record<string, string> = {
  completed: '#10b981',
  failed: '#ef4444',
  'in-progress': '#3b82f6',
  active: '#8b5cf6',
  missed: '#f59e0b',
};

interface TooltipProps {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    color: string;
  }>;
  label?: string;
}

const CustomTooltip = ({ active, payload, label }: TooltipProps) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
        <p className="text-sm font-medium text-gray-900 dark:text-white mb-2">{label}</p>
        {payload.map((entry) => (
          <p key={entry.name} className="text-sm text-gray-600 dark:text-gray-400">
            <span
              className="inline-block w-2 h-2 rounded-full mr-2"
              style={{ backgroundColor: entry.color }}
            />
            <span className="capitalize">{entry.name.replace('-', ' ')}: </span>
            <span className="font-semibold">{entry.value}</span>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export const StatusTrendsChart: React.FC<StatusTrendsChartProps> = ({ data, isLoading }) => {
  if (isLoading) {
    return <Card className="h-80 animate-pulse bg-gray-100 dark:bg-gray-800" />;
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Call Status Trends</h3>
        <div className="h-64 flex items-center justify-center text-gray-500 dark:text-gray-400">
          No data available
        </div>
      </Card>
    );
  }

  const statuses = Array.from(new Set(data.map((d) => d.status)));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chartData = data.reduce((acc: any[], item) => {
    const existing = acc.find((d) => d.date === item.date);
    if (existing) {
      existing[item.status] = item.count;
    } else {
      acc.push({
        date: item.date,
        [item.status]: item.count,
      });
    }
    return acc;
  }, []);

  const formattedData = chartData.map((d) => ({
    ...d,
    formattedDate: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  }));

  return (
    <Card>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Call Status Trends</h3>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={formattedData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
          <XAxis
            dataKey="formattedDate"
            className="text-gray-600 dark:text-gray-400 text-xs"
          />
          <YAxis className="text-gray-600 dark:text-gray-400 text-xs" />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            formatter={(value: string) => (
              <span className="text-sm text-gray-700 dark:text-gray-300 capitalize">{value.replace('-', ' ')}</span>
            )}
          />
          {statuses.map((status) => (
            <Area
              key={status}
              type="monotone"
              dataKey={status}
              stackId="1"
              stroke={COLORS[status as CallStatus]}
              fill={COLORS[status as CallStatus]}
              fillOpacity={0.6}
              name={status.replace('-', ' ')}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </Card>
  );
};
