import React from 'react';
import { Card } from '../Card';
import { CallStats } from '../../types';

interface AnalyticsChartProps {
  data?: CallStats['callVolumeHistory'];
  isLoading: boolean;
}

export const AnalyticsChart: React.FC<AnalyticsChartProps> = ({ data, isLoading }) => {
  if (isLoading) {
    return <Card className="h-64 animate-pulse bg-gray-100 dark:bg-gray-800" />;
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Call Volume History</h3>
        <div className="h-48 flex items-center justify-center text-gray-500">No data available</div>
      </Card>
    );
  }

  const max = Math.max(...data.map(d => d.count), 1);

  return (
    <Card>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Call Volume History</h3>
      <div className="flex items-end justify-between h-48 gap-2 px-2 pb-2">
        {data.map((d) => (
           <div key={d.date} className="flex flex-col items-center flex-1 group h-full justify-end">
              <div 
                className="w-full max-w-[40px] bg-indigo-500/80 hover:bg-indigo-600 rounded-t transition-all relative"
                style={{ height: `${(d.count / max) * 100}%` }}
              >
                 <div className="opacity-0 group-hover:opacity-100 absolute -top-10 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs py-1 px-2 rounded whitespace-nowrap z-10 pointer-events-none transition-opacity">
                   {d.count} calls<br/>{d.date}
                 </div>
              </div>
              <span className="text-xs text-gray-500 mt-2 truncate w-full text-center">{d.date.split('-').slice(1).join('/')}</span>
           </div>
        ))}
      </div>
    </Card>
  );
};
