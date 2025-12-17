import { DashboardLayout, Card } from '../components';
import { AnalyticsCards, AnalyticsChart } from '../components/dashboard';
import { useCallStats } from '../api/calls';
import { TrendingUp, Clock, Smile } from 'lucide-react';

export const AnalyticsPage = () => {
  const { data: stats, isLoading } = useCallStats();

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Analytics
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Detailed analytics and insights into call performance
          </p>
        </div>

        {/* Key Metrics */}
        <AnalyticsCards stats={stats} isLoading={isLoading} />

        {/* Main Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <AnalyticsChart data={stats?.callVolumeHistory} isLoading={isLoading} />
          
          {/* Sentiment Distribution */}
          <Card>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
              <Smile size={20} className="text-primary" />
              Sentiment Distribution
            </h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Positive</span>
                  <span className="text-sm font-semibold text-green-600 dark:text-green-400">45%</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div className="bg-green-500 h-2 rounded-full" style={{ width: '45%' }}></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Neutral</span>
                  <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">35%</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div className="bg-gray-500 h-2 rounded-full" style={{ width: '35%' }}></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Negative</span>
                  <span className="text-sm font-semibold text-red-600 dark:text-red-400">20%</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div className="bg-red-500 h-2 rounded-full" style={{ width: '20%' }}></div>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Additional Insights */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <TrendingUp size={20} className="text-primary" />
              Call Trends
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Peak Hours:</span>
                <span className="font-semibold text-gray-900 dark:text-white">2-4 PM</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Average Calls/Hour:</span>
                <span className="font-semibold text-gray-900 dark:text-white">24.5</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Week-over-Week Growth:</span>
                <span className="font-semibold text-green-600 dark:text-green-400">+12.5%</span>
              </div>
            </div>
          </Card>

          <Card>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Clock size={20} className="text-primary" />
              Duration Analytics
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Shortest Call:</span>
                <span className="font-semibold text-gray-900 dark:text-white">15 seconds</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Longest Call:</span>
                <span className="font-semibold text-gray-900 dark:text-white">45 minutes</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Median Duration:</span>
                <span className="font-semibold text-gray-900 dark:text-white">4 minutes 30 seconds</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};
