import React from 'react';
import { 
  X, 
  Search, 
  Filter, 
  Calendar,
  ChevronDown,
  RotateCcw
} from 'lucide-react';

type PaymentFilters = {
  search: string;
  status: string[];
  method: string[];
  refundStatus: string[];
  dateRange: { start: string; end: string };
  amountRange: { min: number; max: number };
};

type PaymentFiltersPanelProps = {
  filters: PaymentFilters;
  onFilterChange: (filters: PaymentFilters) => void;
  onReset: () => void;
};

export const PaymentFiltersPanel: React.FC<PaymentFiltersPanelProps> = ({
  filters,
  onFilterChange,
  onReset,
}) => {
  const statuses = ['pending', 'processing', 'completed', 'failed', 'cancelled'];
  const methods = ['card', 'upi', 'net_banking', 'wallet', 'link', 'cod'];
  const refundStatuses = ['none', 'pending', 'completed', 'failed'];

  const handleToggleStatus = (status: string) => {
    const newStatus = filters.status.includes(status)
      ? filters.status.filter(s => s !== status)
      : [...filters.status, status];
    onFilterChange({ ...filters, status: newStatus });
  };

  const handleToggleMethod = (method: string) => {
    const newMethod = filters.method.includes(method)
      ? filters.method.filter(m => m !== method)
      : [...filters.method, method];
    onFilterChange({ ...filters, method: newMethod });
  };

  return (
    <div className="bg-white border-b border-gray-200 p-6 space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-xl">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by transaction ID, order number, or customer name..."
            value={filters.search}
            onChange={(e) => onFilterChange({ ...filters, search: e.target.value })}
            className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
          />
        </div>
        <div className="flex items-center space-x-3">
          <button 
            onClick={onReset}
            className="flex items-center px-4 py-3 text-sm font-bold text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-xl transition-colors"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset
          </button>
          <div className="relative group">
            <button className="flex items-center px-6 py-3 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-100">
              <Filter className="w-4 h-4 mr-2" />
              Quick Filters
              <ChevronDown className="w-4 h-4 ml-2" />
            </button>
            <div className="absolute right-0 top-full mt-2 hidden group-hover:block bg-white border border-gray-100 shadow-2xl rounded-2xl p-2 z-20 min-w-[200px]">
              <button onClick={() => onFilterChange({...filters, dateRange: {start: new Date().toISOString(), end: new Date().toISOString()}})} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg">Today</button>
              <button className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg">Last 7 Days</button>
              <button onClick={() => onFilterChange({...filters, status: ['failed']})} className="w-full text-left px-4 py-2 text-sm text-red-600 font-bold hover:bg-red-50 rounded-lg">Failed Payments</button>
              <button onClick={() => onFilterChange({...filters, refundStatus: ['pending']})} className="w-full text-left px-4 py-2 text-sm text-purple-600 font-bold hover:bg-purple-50 rounded-lg">Pending Refunds</button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 pt-2">
        <div className="space-y-3">
          <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Payment Status</label>
          <div className="flex flex-wrap gap-2">
            {statuses.map((s) => (
              <button
                key={s}
                onClick={() => handleToggleStatus(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all border ${
                  filters.status.includes(s)
                    ? 'bg-blue-600 border-blue-600 text-white shadow-md'
                    : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Payment Method</label>
          <div className="flex flex-wrap gap-2">
            {methods.map((m) => (
              <button
                key={m}
                onClick={() => handleToggleMethod(m)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all border ${
                  filters.method.includes(m)
                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-md'
                    : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                {m.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Date Range</label>
          <div className="flex items-center space-x-2">
            <div className="relative flex-1">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="date"
                value={filters.dateRange.start.split('T')[0]}
                onChange={(e) => onFilterChange({ ...filters, dateRange: { ...filters.dateRange, start: e.target.value } })}
                className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <span className="text-gray-400">-</span>
            <div className="relative flex-1">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="date"
                value={filters.dateRange.end.split('T')[0]}
                onChange={(e) => onFilterChange({ ...filters, dateRange: { ...filters.dateRange, end: e.target.value } })}
                className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Amount Range</label>
          <div className="flex items-center space-x-2">
            <input
              type="number"
              placeholder="Min"
              value={filters.amountRange.min || ''}
              onChange={(e) => onFilterChange({ ...filters, amountRange: { ...filters.amountRange, min: Number(e.target.value) } })}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-none"
            />
            <span className="text-gray-400">-</span>
            <input
              type="number"
              placeholder="Max"
              value={filters.amountRange.max || ''}
              onChange={(e) => onFilterChange({ ...filters, amountRange: { ...filters.amountRange, max: Number(e.target.value) } })}
              className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
