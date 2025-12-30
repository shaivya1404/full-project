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

interface PeakHoursHeatmapProps {
  data?: CallStats['peakHours'];
  isLoading?: boolean;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const getHeatmapColor = (count: number, max: number) => {
  const intensity = count / max;
  if (intensity === 0) return 'bg-gray-100 dark:bg-gray-800';
  if (intensity < 0.25) return 'bg-blue-100 dark:bg-blue-900/30';
  if (intensity < 0.5) return 'bg-blue-200 dark:bg-blue-800/40';
  if (intensity < 0.75) return 'bg-blue-300 dark:bg-blue-700/50';
  return 'bg-blue-400 dark:bg-blue-600/60';
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
        <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">
          {payload[0].payload.day} at {payload[0].payload.hour}:00
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Calls: <span className="font-semibold text-primary">{payload[0].value}</span>
        </p>
      </div>
    );
  }
  return null;
};

export const PeakHoursHeatmap: React.FC<PeakHoursHeatmapProps> = ({ data, isLoading }) => {
  if (isLoading) {
    return <Card className="h-80 animate-pulse bg-gray-100 dark:bg-gray-800" />;
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Peak Hours Analysis</h3>
        <div className="h-64 flex items-center justify-center text-gray-500 dark:text-gray-400">
          No data available
        </div>
      </Card>
    );
  }

  const maxCount = Math.max(...data.map((d) => d.count), 1);
  const chartData = data.map((item) => ({
    ...item,
    day: item.day.substring(0, 3),
  }));

  // Find peak hour
  const peakHour = data.reduce((max, item) => (item.count > max.count ? item : max), data[0]);

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Peak Hours Analysis</h3>
        {peakHour && (
          <div className="text-sm">
            <span className="text-gray-500 dark:text-gray-400">Peak: </span>
            <span className="font-semibold text-primary">
              {peakHour.day.substring(0, 3)} {peakHour.hour}:00 ({peakHour.count} calls)
            </span>
          </div>
        )}
      </div>

      {/* Heatmap Grid */}
      <div className="mb-4 overflow-x-auto">
        <div className="min-w-[600px]">
          <div className="grid grid-cols-25 gap-1">
            {/* Header row with hours */}
            <div className="col-span-1"></div>
            {Array.from({ length: 24 }, (_, i) => (
              <div
                key={`header-${i}`}
                className="text-xs text-gray-500 dark:text-gray-400 text-center py-1"
              >
                {i}
              </div>
            ))}

            {/* Data rows for each day */}
            {DAYS.map((day) => (
              <React.Fragment key={day}>
                <div className="text-xs font-medium text-gray-600 dark:text-gray-300 text-right pr-2 py-1">
                  {day}
                </div>
                {Array.from({ length: 24 }, (_, hour) => {
                  const cellData = data.find(
                    (d) => d.day.toLowerCase().startsWith(day.toLowerCase()) && d.hour === hour
                  );
                  const count = cellData?.count || 0;
                  return (
                    <div
                      key={`${day}-${hour}`}
                      className={`
                        h-8 rounded flex items-center justify-center text-xs
                        cursor-pointer transition-all hover:scale-110
                        ${getHeatmapColor(count, maxCount)}
                        ${count > 0 ? 'text-gray-700 dark:text-gray-300' : 'text-gray-300 dark:text-gray-600'}
                      `}
                      title={`${day} ${hour}:00 - ${count} calls`}
                    >
                      {count > 0 ? count : ''}
                    </div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      {/* Heatmap Legend */}
      <div className="flex items-center justify-center gap-2 mb-4">
        <span className="text-xs text-gray-500 dark:text-gray-400">Low</span>
        <div className="flex gap-1">
          <div className="w-6 h-4 bg-blue-100 dark:bg-blue-900/30 rounded" />
          <div className="w-6 h-4 bg-blue-200 dark:bg-blue-800/40 rounded" />
          <div className="w-6 h-4 bg-blue-300 dark:bg-blue-700/50 rounded" />
          <div className="w-6 h-4 bg-blue-400 dark:bg-blue-600/60 rounded" />
        </div>
        <span className="text-xs text-gray-500 dark:text-gray-400">High</span>
      </div>

      {/* Bar Chart for Hourly Breakdown */}
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
          <XAxis
            dataKey="hour"
            className="text-gray-600 dark:text-gray-400 text-xs"
            tickFormatter={(value) => `${value}:00`}
          />
          <YAxis className="text-gray-600 dark:text-gray-400 text-xs" />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          <Bar
            dataKey="count"
            fill="#3b82f6"
            name="Number of Calls"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
};
