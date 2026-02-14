import React from 'react';
import { Search, Filter, Calendar, DollarSign } from 'lucide-react';

interface OrderFiltersPanelProps {
  filters: {
    search: string;
    status: string[];
    dateFrom: string;
    dateTo: string;
    minAmount: string;
    maxAmount: string;
  };
  onFiltersChange: (filters: any) => void;
  onSearchChange: (search: string) => void;
}

export const OrderFiltersPanel: React.FC<OrderFiltersPanelProps> = ({
  filters,
  onFiltersChange,
  onSearchChange
}) => {
  const statusOptions = ['pending', 'confirmed', 'processing', 'ready', 'delivered', 'cancelled'];

  return (
    <div className="bg-white rounded-lg shadow p-4 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <Filter className="h-4 w-4 text-gray-500" />
        <h3 className="text-sm font-medium text-gray-900">Filters</h3>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search orders..."
            value={filters.search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Status */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
          <select
            multiple
            value={filters.status}
            onChange={(e) => {
              const values = Array.from(e.target.selectedOptions).map(opt => opt.value);
              onFiltersChange({ ...filters, status: values });
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 h-24"
          >
            {statusOptions.map(status => (
              <option key={status} value={status}>
                {(status || '').charAt(0).toUpperCase() + (status || '').slice(1)}
              </option>
            ))}
          </select>
        </div>

        {/* Date Range */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Date From</label>
          <div className="relative">
            <Calendar className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => onFiltersChange({ ...filters, dateFrom: e.target.value })}
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Date To</label>
          <div className="relative">
            <Calendar className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => onFiltersChange({ ...filters, dateTo: e.target.value })}
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Amount Range */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Min Amount</label>
          <div className="relative">
            <DollarSign className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <input
              type="number"
              placeholder="0.00"
              value={filters.minAmount}
              onChange={(e) => onFiltersChange({ ...filters, minAmount: e.target.value })}
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Max Amount</label>
          <div className="relative">
            <DollarSign className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <input
              type="number"
              placeholder="9999.00"
              value={filters.maxAmount}
              onChange={(e) => onFiltersChange({ ...filters, maxAmount: e.target.value })}
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>
    </div>
  );
};