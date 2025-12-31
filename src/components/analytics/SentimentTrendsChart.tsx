import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Card } from '../Card';
import type { CallStats, Sentiment } from '../../types';

interface SentimentTrendsChartProps {
  data?: CallStats['sentimentTrends'];
  isLoading?: boolean;
}

const COLORS: Record<Sentiment, string> = {
  positive: '#10b981',
  neutral: '#6b7280',
  negative: '#ef4444',
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
        <p className="text-sm font-medium text-gray-900 dark:text-white mb-2">{label}</p>
        {payload.map((entry: any) => (
          <div key={entry.name} className="text-sm text-gray-600 dark:text-gray-400">
            <span
              className="inline-block w-2 h-2 rounded-full mr-2"
              style={{ backgroundColor: entry.color }}
            />
            <span className="capitalize">{entry.name}: </span>
            <span className="font-semibold">{entry.value}</span>
            {entry.payload.score && (
              <span className="ml-2 text-xs text-gray-500">
                (Score: {entry.payload.score})
              </span>
            )}
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export const SentimentTrendsChart: React.FC<SentimentTrendsChartProps> = ({ data, isLoading }) => {
  if (isLoading) {
    return <Card className="h-80 animate-pulse bg-gray-100 dark:bg-gray-800" />;
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Sentiment Trends Over Time</h3>
        <div className="h-64 flex items-center justify-center text-gray-500 dark:text-gray-400">
          No data available
        </div>
      </Card>
    );
  }

  const sentiments = Array.from(new Set(data.map((d) => d.sentiment))) as Sentiment[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chartData = data.reduce((acc: any[], item) => {
    const existing = acc.find((d) => d.date === item.date);
    if (existing) {
      existing[`${item.sentiment}Count`] = item.count;
      existing[`${item.sentiment}Score`] = item.score;
    } else {
      acc.push({
        date: item.date,
        [`${item.sentiment}Count`]: item.count,
        [`${item.sentiment}Score`]: item.score,
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
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Sentiment Trends Over Time</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={formattedData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
          <XAxis
            dataKey="formattedDate"
            className="text-gray-600 dark:text-gray-400 text-xs"
          />
          <YAxis yAxisId="left" className="text-gray-600 dark:text-gray-400 text-xs" />
          <YAxis
            yAxisId="right"
            orientation="right"
            domain={[0, 100]}
            className="text-gray-600 dark:text-gray-400 text-xs"
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            formatter={(value: string) => (
              <span className="text-sm text-gray-700 dark:text-gray-300 capitalize">
                {value.replace('Count', '').replace('Score', ' (Score)')}
              </span>
            )}
          />
          {sentiments.map((sentiment) => (
            <Line
              key={`${sentiment}Count`}
              type="monotone"
              dataKey={`${sentiment}Count`}
              stroke={COLORS[sentiment]}
              strokeWidth={2}
              dot={{ fill: COLORS[sentiment], r: 4 }}
              activeDot={{ r: 6 }}
              yAxisId="left"
              name={sentiment}
            />
          ))}
          {sentiments.map((sentiment) => (
            <Line
              key={`${sentiment}Score`}
              type="monotone"
              dataKey={`${sentiment}Score`}
              stroke={COLORS[sentiment]}
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={{ fill: COLORS[sentiment], r: 3 }}
              activeDot={{ r: 4 }}
              yAxisId="right"
              name={`${sentiment}Score`}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>

      {/* Legend for dashed lines */}
      <div className="mt-4 flex items-center justify-center gap-4 text-xs text-gray-500 dark:text-gray-400">
        <div className="flex items-center gap-1">
          <div className="w-8 h-0.5 bg-gray-400" />
          <span>Call Count</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-8 h-0.5 border-t border-dashed border-gray-400" />
          <span>Sentiment Score (0-100)</span>
        </div>
      </div>
    </Card>
  );
};
