import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Card } from '../Card';
import type { CallStats } from '../../types';

interface DurationDistributionChartProps {
  data?: CallStats['durationDistribution'];
  isLoading?: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
        <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">{label}</p>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Calls: <span className="font-semibold text-primary">{payload[0].value}</span>
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Percentage: <span className="font-semibold">{payload[0].payload.percentage}%</span>
        </p>
      </div>
    );
  }
  return null;
};

export const DurationDistributionChart: React.FC<DurationDistributionChartProps> = ({ data, isLoading }) => {
  if (isLoading) {
    return <Card className="h-80 animate-pulse bg-gray-100 dark:bg-gray-800" />;
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Call Duration Distribution</h3>
        <div className="h-64 flex items-center justify-center text-gray-500 dark:text-gray-400">
          No data available
        </div>
      </Card>
    );
  }

  const chartData = data.map((item) => ({
    ...item,
    name: item.range,
  }));

  return (
    <Card>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Call Duration Distribution</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
          <XAxis
            dataKey="name"
            className="text-gray-600 dark:text-gray-400 text-xs"
            tick={{ fontSize: 11 }}
          />
          <YAxis className="text-gray-600 dark:text-gray-400 text-xs" />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          <Bar
            dataKey="count"
            fill="#8b5cf6"
            name="Number of Calls"
            radius={[8, 8, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>

      {/* Duration Summary */}
      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        {data.map((item) => (
          <div
            key={item.range}
            className="p-3 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800"
          >
            <p className="text-xs text-purple-700 dark:text-purple-300 mb-1">{item.range}</p>
            <p className="text-lg font-semibold text-purple-900 dark:text-purple-100">
              {item.count}
            </p>
            <p className="text-xs text-purple-600 dark:text-purple-400">{item.percentage}%</p>
          </div>
        ))}
      </div>
    </Card>
  );
};
