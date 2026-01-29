import { useState, useEffect } from 'react';
import { X, Search } from 'lucide-react';
import { Button } from '../Button';
import { Input } from '../Input';
import { Select } from '../Select';

interface FilterState {
  status?: string;
  agent?: string;
  campaign?: string;
  sentiment?: string;
  duration?: string;
  quality?: string;
  search?: string;
}

interface LiveCallFiltersProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  onClose: () => void;
}

export const LiveCallFilters = ({ filters, onFiltersChange, onClose }: LiveCallFiltersProps) => {
  const [localFilters, setLocalFilters] = useState<FilterState>(filters);

  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  const handleFilterChange = (key: keyof FilterState, value: string) => {
    const newFilters = { ...localFilters };
    if (value === '') {
      delete newFilters[key];
    } else {
      newFilters[key] = value;
    }
    setLocalFilters(newFilters);
  };

  const applyFilters = () => {
    onFiltersChange(localFilters);
  };

  const resetFilters = () => {
    setLocalFilters({});
    onFiltersChange({});
  };

  const hasActiveFilters = Object.keys(localFilters).length > 0;

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">Filter Calls</h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <X size={20} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Search */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Search
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
            <Input
              placeholder="Search calls..."
              value={localFilters.search || ''}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Status */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Status
          </label>
          <Select
            value={localFilters.status || ''}
            onChange={(e) => handleFilterChange('status', e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="on-hold">On Hold</option>
            <option value="transferring">Transferring</option>
            <option value="recording">Recording</option>
          </Select>
        </div>

        {/* Sentiment */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Sentiment
          </label>
          <Select
            value={localFilters.sentiment || ''}
            onChange={(e) => handleFilterChange('sentiment', e.target.value)}
          >
            <option value="">All Sentiments</option>
            <option value="positive">Positive</option>
            <option value="neutral">Neutral</option>
            <option value="negative">Negative</option>
          </Select>
        </div>

        {/* Call Quality */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Call Quality
          </label>
          <Select
            value={localFilters.quality || ''}
            onChange={(e) => handleFilterChange('quality', e.target.value)}
          >
            <option value="">All Qualities</option>
            <option value="excellent">Excellent (90%+)</option>
            <option value="good">Good (70-89%)</option>
            <option value="poor">Poor (&lt;70%)</option>
          </Select>
        </div>

        {/* Duration */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Duration
          </label>
          <Select
            value={localFilters.duration || ''}
            onChange={(e) => handleFilterChange('duration', e.target.value)}
          >
            <option value="">All Durations</option>
            <option value="0-5min">0-5 minutes</option>
            <option value="5-10min">5-10 minutes</option>
            <option value="10+min">10+ minutes</option>
          </Select>
        </div>

        {/* Agent */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Agent
          </label>
          <Input
            placeholder="Filter by agent name..."
            value={localFilters.agent || ''}
            onChange={(e) => handleFilterChange('agent', e.target.value)}
          />
        </div>
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="text-sm text-gray-600 dark:text-gray-400">
          {hasActiveFilters ? (
            `${Object.keys(localFilters).length} filter${Object.keys(localFilters).length !== 1 ? 's' : ''} applied`
          ) : (
            'No filters applied'
          )}
        </div>
        
        <div className="flex items-center space-x-3">
          {hasActiveFilters && (
            <Button
              variant="outline"
              size="sm"
              onClick={resetFilters}
            >
              Reset
            </Button>
          )}
          <Button
            size="sm"
            onClick={applyFilters}
          >
            Apply Filters
          </Button>
        </div>
      </div>
    </div>
  );
};