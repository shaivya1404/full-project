import React from 'react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';
import { Card } from '../Card';
import type { CallStats } from '../../types';
import clsx from 'clsx';

interface CallStatusChartProps {
  data?: CallStats['statusBreakdown'];
  isLoading?: boolean;
  variant?: 'pie' | 'donut';
}

const COLORS: Record<string, string> = {
  completed: '#10b981',
  failed: '#ef4444',
  'in-progress': '#3b82f6',
  active: '#8b5cf6',
  missed: '#f59e0b',
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
        <p className="text-sm font-medium text-gray-900 dark:text-white mb-1 capitalize">
          {payload[0].payload.status.replace('-', ' ')}
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Count: <span className="font-semibold">{payload[0].payload.count}</span>
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Percentage: <span className="font-semibold">{payload[0].payload.percentage}%</span>
        </p>
      </div>
    );
  }
  return null;
};

export const CallStatusChart: React.FC<CallStatusChartProps> = ({ data, isLoading, variant = 'donut' }) => {
  if (isLoading) {
    return <Card className="h-80 animate-pulse bg-gray-100 dark:bg-gray-800" />;
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Call Status Distribution</h3>
        <div className="h-64 flex items-center justify-center text-gray-500 dark:text-gray-400">
          No data available
        </div>
      </Card>
    );
  }

  const chartData = data.map((item) => ({
    ...item,
    name: item.status.replace('-', ' '),
  }));

  return (
    <Card>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Call Status Distribution</h3>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            labelLine={false}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            label={({ name, payload }: any) => `${name}: ${payload.percentage}%`}
            outerRadius={variant === 'donut' ? 80 : 100}
            innerRadius={variant === 'donut' ? 50 : 0}
            paddingAngle={2}
            dataKey="count"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[entry.status as keyof typeof COLORS] || '#6b7280'} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend
            verticalAlign="bottom"
            height={36}
            iconType="circle"
            formatter={(value: string) => (
              <span className="text-sm text-gray-700 dark:text-gray-300 capitalize">{value}</span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>

      {/* Status Summary */}
      <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-3">
        {data.map((item) => (
          <div
            key={item.status}
            className="flex items-center justify-between p-2 rounded-lg bg-gray-50 dark:bg-gray-800/50"
          >
            <div className="flex items-center gap-2">
              <div
                className={clsx('w-3 h-3 rounded-full', {
                  'bg-green-500': item.status === 'completed',
                  'bg-red-500': item.status === 'failed',
                  'bg-blue-500': item.status === 'in-progress' || item.status === 'active',
                  'bg-yellow-500': item.status === 'missed',
                })}
              />
              <span className="text-sm text-gray-700 dark:text-gray-300 capitalize">
                {item.status.replace('-', ' ')}
              </span>
            </div>
            <span className="text-sm font-semibold text-gray-900 dark:text-white">
              {item.count} ({item.percentage}%)
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
};
