import { useState } from 'react';
import { DashboardLayout, Card } from '../components';
import { useCallStats } from '../api/calls';
import {
  DateRangeSelector,
  CallVolumeChart,
  CallStatusChart,
  DurationDistributionChart,
  StatusTrendsChart,
  SentimentPieChart,
  SentimentTrendsChart,
  PeakHoursHeatmap,
  DayOfWeekBreakdown,
  AgentPerformanceTable,
  CallQualityMetrics,
  RefreshControl,
  ExportControls,
} from '../components/analytics';
import { AnalyticsCards } from '../components/dashboard';
import type { DateRange } from '../types';
import { useQueryClient } from '@tanstack/react-query';

export const AnalyticsPage = () => {
  const queryClient = useQueryClient();
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // Default date range: last 30 days
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    return {
      startDate: thirtyDaysAgo.toISOString().split('T')[0],
      endDate: now.toISOString().split('T')[0],
      preset: '30d',
    };
  });

  const { data: stats, isLoading } = useCallStats(dateRange);

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['callStats'] });
    setLastRefresh(new Date());
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header Section */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              Analytics Dashboard
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Comprehensive insights into call performance, trends, and quality metrics
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <RefreshControl onRefresh={handleRefresh} isLoading={isLoading} lastRefresh={lastRefresh} />
          </div>
        </div>

        {/* Controls Section */}
        <Card className="p-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <DateRangeSelector dateRange={dateRange} onDateRangeChange={setDateRange} />
            <ExportControls dateRange={dateRange} data={stats} />
          </div>
        </Card>

        {/* Key Metrics Cards */}
        <AnalyticsCards stats={stats} isLoading={isLoading} />

        {/* Call Quality Metrics */}
        <CallQualityMetrics metrics={stats?.callQualityMetrics} isLoading={isLoading} />

        {/* Main Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <CallVolumeChart data={stats?.callVolumeHistory} isLoading={isLoading} />
          <CallStatusChart data={stats?.statusBreakdown} isLoading={isLoading} />
        </div>

        {/* Second Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <DurationDistributionChart data={stats?.durationDistribution} isLoading={isLoading} />
          <StatusTrendsChart data={stats?.statusTrends} isLoading={isLoading} />
        </div>

        {/* Sentiment Analysis Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SentimentPieChart data={stats?.sentimentBreakdown} isLoading={isLoading} />
          <SentimentTrendsChart data={stats?.sentimentTrends} isLoading={isLoading} />
        </div>

        {/* Peak Hours and Day of Week Analysis */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <PeakHoursHeatmap data={stats?.peakHours} isLoading={isLoading} />
          <DayOfWeekBreakdown data={stats?.dayOfWeekBreakdown} isLoading={isLoading} />
        </div>

        {/* Agent Performance */}
        <AgentPerformanceTable data={stats?.agentPerformance} isLoading={isLoading} />

        {/* Quick Stats Summary */}
        {!isLoading && stats && (
          <Card>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Quick Summary</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                <p className="text-xs text-blue-700 dark:text-blue-300 mb-1">Success Rate</p>
                <p className="text-lg font-semibold text-blue-900 dark:text-blue-100">
                  {(() => {
                    const completed = stats.statusBreakdown.find(s => s.status === 'completed')?.count || 0;
                    const total = stats.totalCalls;
                    return total > 0 ? ((completed / total) * 100).toFixed(1) : '0.0';
                  })()}%
                </p>
              </div>

              <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                <p className="text-xs text-green-700 dark:text-green-300 mb-1">Positive Sentiment</p>
                <p className="text-lg font-semibold text-green-900 dark:text-green-100">
                  {stats.sentimentBreakdown.find(s => s.sentiment === 'positive')?.percentage || 0}%
                </p>
              </div>

              <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800">
                <p className="text-xs text-purple-700 dark:text-purple-300 mb-1">Avg Call Duration</p>
                <p className="text-lg font-semibold text-purple-900 dark:text-purple-100">
                  {Math.floor(stats.avgDuration / 60)}m {stats.avgDuration % 60}s
                </p>
              </div>

              <div className="p-3 rounded-lg bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800">
                <p className="text-xs text-orange-700 dark:text-orange-300 mb-1">Peak Hour</p>
                <p className="text-lg font-semibold text-orange-900 dark:text-orange-100">
                  {(() => {
                    const peak = stats.peakHours.reduce((max, h) => h.count > max.count ? h : max, stats.peakHours[0] || { hour: 0, count: 0 });
                    return `${peak.hour}:00`;
                  })()}
                </p>
              </div>

              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                <p className="text-xs text-red-700 dark:text-red-300 mb-1">Failed Calls</p>
                <p className="text-lg font-semibold text-red-900 dark:text-red-100">
                  {stats.statusBreakdown.find(s => s.status === 'failed')?.count || 0}
                </p>
              </div>

              <div className="p-3 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800">
                <p className="text-xs text-indigo-700 dark:text-indigo-300 mb-1">Connection Quality</p>
                <p className="text-lg font-semibold text-indigo-900 dark:text-indigo-100">
                  {stats.callQualityMetrics.connectionQuality}/100
                </p>
              </div>
            </div>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};
