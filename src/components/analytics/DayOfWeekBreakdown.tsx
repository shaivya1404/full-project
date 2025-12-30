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
  Cell,
} from 'recharts';
import { Card } from '../Card';
import type { CallStats } from '../../types';

interface DayOfWeekBreakdownProps {
  data?: CallStats['dayOfWeekBreakdown'];
  isLoading?: boolean;
}

const DAY_ORDER = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
        <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">{label}</p>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Calls: <span className="font-semibold text-primary">{payload[0].value}</span>
        </p>
      </div>
    );
  }
  return null;
};

export const DayOfWeekBreakdown: React.FC<DayOfWeekBreakdownProps> = ({ data, isLoading }) => {
  if (isLoading) {
    return <Card className="h-80 animate-pulse bg-gray-100 dark:bg-gray-800" />;
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Day of Week Breakdown</h3>
        <div className="h-64 flex items-center justify-center text-gray-500 dark:text-gray-400">
          No data available
        </div>
      </Card>
    );
  }

  const totalCalls = data.reduce((sum, d) => sum + d.count, 0);
  const avgCalls = totalCalls / 7;

  const chartData = DAY_ORDER.map((day) => {
    const dayData = data.find((d) => d.day.toLowerCase() === day.toLowerCase());
    return {
      day: day.substring(0, 3),
      count: dayData?.count || 0,
      percentage: totalCalls > 0 ? Math.round(((dayData?.count || 0) / totalCalls) * 100) : 0,
      isAboveAverage: (dayData?.count || 0) > avgCalls,
    };
  });

  return (
    <Card>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Day of Week Breakdown</h3>

      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
          <XAxis
            dataKey="day"
            className="text-gray-600 dark:text-gray-400 text-xs"
          />
          <YAxis className="text-gray-600 dark:text-gray-400 text-xs" />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          <Bar
            dataKey="count"
            fill="#3b82f6"
            name="Number of Calls"
            radius={[8, 8, 0, 0]}
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.isAboveAverage ? '#3b82f6' : '#94a3b8'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Summary Cards */}
      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
          <p className="text-xs text-blue-700 dark:text-blue-300 mb-1">Busiest Day</p>
          <p className="text-lg font-semibold text-blue-900 dark:text-blue-100">
            {chartData.reduce((max, d) => (d.count > max.count ? d : max), chartData[0]).day}
          </p>
          <p className="text-xs text-blue-600 dark:text-blue-400">
            {chartData.reduce((max, d) => (d.count > max.count ? d : max), chartData[0]).count} calls
          </p>
        </div>

        <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-700 dark:text-gray-300 mb-1">Quietest Day</p>
          <p className="text-lg font-semibold text-gray-900 dark:text-white">
            {chartData.reduce((min, d) => (d.count < min.count ? d : min), chartData[0]).day}
          </p>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            {chartData.reduce((min, d) => (d.count < min.count ? d : min), chartData[0]).count} calls
          </p>
        </div>

        <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
          <p className="text-xs text-green-700 dark:text-green-300 mb-1">Average/Day</p>
          <p className="text-lg font-semibold text-green-900 dark:text-green-100">
            {Math.round(avgCalls)}
          </p>
          <p className="text-xs text-green-600 dark:text-green-400">calls</p>
        </div>

        <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800">
          <p className="text-xs text-purple-700 dark:text-purple-300 mb-1">Total Calls</p>
          <p className="text-lg font-semibold text-purple-900 dark:text-purple-100">
            {totalCalls.toLocaleString()}
          </p>
          <p className="text-xs text-purple-600 dark:text-purple-400">all days</p>
        </div>
      </div>
    </Card>
  );
};
