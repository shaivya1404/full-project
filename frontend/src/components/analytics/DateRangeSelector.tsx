import React from 'react';
import { Calendar } from 'lucide-react';
import type { DateRange, DateRangePreset } from '../../types';

interface DateRangeSelectorProps {
  dateRange: DateRange;
  onDateRangeChange: (range: DateRange) => void;
}

export const DateRangeSelector: React.FC<DateRangeSelectorProps> = ({ dateRange, onDateRangeChange }) => {
  const presets: { label: string; value: DateRangePreset }[] = [
    { label: 'Last 7 days', value: '7d' },
    { label: 'Last 30 days', value: '30d' },
    { label: 'Last 90 days', value: '90d' },
    { label: 'Custom', value: 'custom' },
  ];

  const handlePresetChange = (preset: DateRangePreset) => {
    const now = new Date();
    let startDate: Date;

    switch (preset) {
      case '7d':
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '30d':
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 30);
        break;
      case '90d':
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 90);
        break;
      default:
        return;
    }

    onDateRangeChange({
      startDate: startDate.toISOString().split('T')[0],
      endDate: now.toISOString().split('T')[0],
      preset,
    });
  };

  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onDateRangeChange({
      ...dateRange,
      startDate: e.target.value,
      preset: 'custom',
    });
  };

  const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onDateRangeChange({
      ...dateRange,
      endDate: e.target.value,
      preset: 'custom',
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="flex items-center gap-2">
        <Calendar size={18} className="text-gray-500" />
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Date Range:</span>
      </div>

      <div className="flex gap-2">
        {presets.map((preset) => (
          <button
            key={preset.value}
            onClick={() => handlePresetChange(preset.value)}
            className={`
              px-4 py-2 rounded-lg text-sm font-medium transition-all
              ${dateRange.preset === preset.value
                ? 'bg-primary text-white shadow-md'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
              }
            `}
          >
            {preset.label}
          </button>
        ))}
      </div>

      {(dateRange.preset === 'custom' || !dateRange.preset) && (
        <div className="flex items-center gap-2 ml-2">
          <input
            type="date"
            value={dateRange.startDate}
            onChange={handleStartDateChange}
            className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
          />
          <span className="text-gray-500">to</span>
          <input
            type="date"
            value={dateRange.endDate}
            onChange={handleEndDateChange}
            className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>
      )}
    </div>
  );
};
