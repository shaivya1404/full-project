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
import type { CallStats, Sentiment } from '../../types';
import { Smile, Meh, Frown } from 'lucide-react';
import clsx from 'clsx';

interface SentimentPieChartProps {
  data?: CallStats['sentimentBreakdown'];
  isLoading?: boolean;
  variant?: 'pie' | 'donut';
}

const COLORS: Record<Sentiment, string> = {
  positive: '#10b981',
  neutral: '#6b7280',
  negative: '#ef4444',
};

const ICONS: Record<Sentiment, React.ElementType> = {
  positive: Smile,
  neutral: Meh,
  negative: Frown,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
        <p className="text-sm font-medium text-gray-900 dark:text-white mb-1 capitalize">
          {payload[0].payload.sentiment}
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

export const SentimentPieChart: React.FC<SentimentPieChartProps> = ({ data, isLoading, variant = 'donut' }) => {
  if (isLoading) {
    return <Card className="h-80 animate-pulse bg-gray-100 dark:bg-gray-800" />;
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Sentiment Distribution</h3>
        <div className="h-64 flex items-center justify-center text-gray-500 dark:text-gray-400">
          No data available
        </div>
      </Card>
    );
  }

  const chartData = data.map((item) => ({
    ...item,
    name: item.sentiment.charAt(0).toUpperCase() + item.sentiment.slice(1),
  }));

  return (
    <Card>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Sentiment Distribution</h3>
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
              <Cell key={`cell-${index}`} fill={COLORS[entry.sentiment as Sentiment]} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend
            verticalAlign="bottom"
            height={36}
            iconType="circle"
            formatter={(value: string) => (
              <span className="text-sm text-gray-700 dark:text-gray-300">{value}</span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>

      {/* Sentiment Summary */}
      <div className="mt-4 grid grid-cols-3 gap-3">
        {data.map((item) => {
          const Icon = ICONS[item.sentiment as Sentiment];
          return (
            <div
              key={item.sentiment}
              className={clsx(
                'flex flex-col items-center p-3 rounded-lg',
                {
                  'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800':
                    item.sentiment === 'positive',
                  'bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700':
                    item.sentiment === 'neutral',
                  'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800':
                    item.sentiment === 'negative',
                }
              )}
            >
              <Icon
                size={24}
                className={clsx('mb-2', {
                  'text-green-500': item.sentiment === 'positive',
                  'text-gray-500': item.sentiment === 'neutral',
                  'text-red-500': item.sentiment === 'negative',
                })}
              />
              <p className="text-xs text-gray-600 dark:text-gray-400 capitalize mb-1">
                {item.sentiment}
              </p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">
                {item.count}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{item.percentage}%</p>
            </div>
          );
        })}
      </div>
    </Card>
  );
};
