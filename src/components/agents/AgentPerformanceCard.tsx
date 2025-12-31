import { TrendingUp, TrendingDown, Minus, Target, Clock, PhoneCall, Star } from 'lucide-react';
import type { AgentPerformanceData } from '../../types';

type AgentPerformanceCardProps = {
  performance: AgentPerformanceData | null;
  loading?: boolean;
};

export const AgentPerformanceCard = ({ performance, loading }: AgentPerformanceCardProps) => {
  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 animate-pulse">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-6"></div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 bg-gray-100 dark:bg-gray-900 rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  if (!performance) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <p className="text-gray-500 dark:text-gray-400 text-center">No performance data available for the selected period.</p>
      </div>
    );
  }

  const MetricItem = ({ label, value, icon: Icon, color, suffix = '', trend = 0 }: any) => (
    <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="flex justify-between items-start mb-2">
        <div className={`p-2 rounded-lg bg-${color}-100 dark:bg-${color}-900/30 text-${color}-600 dark:text-${color}-400`}>
          <Icon size={20} />
        </div>
        {trend !== 0 && (
          <div className={`flex items-center text-xs font-medium ${trend > 0 ? 'text-green-600' : 'text-red-600'}`}>
            {trend > 0 ? <TrendingUp size={14} className="mr-0.5" /> : <TrendingDown size={14} className="mr-0.5" />}
            {Math.abs(trend)}%
          </div>
        )}
      </div>
      <div>
        <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">{label}</p>
        <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
          {value}{suffix}
        </p>
      </div>
    </div>
  );

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Performance Overview</h3>
        <span className="text-xs text-gray-500 font-medium">Last 30 Days</span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricItem
          label="Total Calls"
          value={performance.totalCalls}
          icon={PhoneCall}
          color="blue"
          trend={12}
        />
        <MetricItem
          label="Avg. Handle Time"
          value={Math.round(performance.averageHandleTime / 60)}
          suffix="m"
          icon={Clock}
          color="purple"
          trend={-5}
        />
        <MetricItem
          label="CSAT Score"
          value={performance.customerSatisfactionScore.toFixed(1)}
          suffix="/5"
          icon={Star}
          color="yellow"
          trend={2}
        />
        <MetricItem
          label="FCR Rate"
          value={performance.firstCallResolution}
          suffix="%"
          icon={Target}
          color="green"
          trend={8}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
        <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Quality Score</p>
          <div className="flex items-end gap-2">
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{performance.callQualityScore}%</p>
            <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-700 rounded-full mb-2 overflow-hidden">
              <div className="h-full bg-green-500" style={{ width: `${performance.callQualityScore}%` }}></div>
            </div>
          </div>
        </div>
        <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Schedule Adherence</p>
          <div className="flex items-end gap-2">
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{performance.scheduleAdherence}%</p>
            <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-700 rounded-full mb-2 overflow-hidden">
              <div className="h-full bg-blue-500" style={{ width: `${performance.scheduleAdherence}%` }}></div>
            </div>
          </div>
        </div>
        <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Attendance</p>
          <div className="flex items-end gap-2">
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{performance.attendance}%</p>
            <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-700 rounded-full mb-2 overflow-hidden">
              <div className="h-full bg-purple-500" style={{ width: `${performance.attendance}%` }}></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
