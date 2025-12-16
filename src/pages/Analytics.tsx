import { DashboardLayout, Card } from '../components';
import { BarChart3 } from 'lucide-react';

export const AnalyticsPage = () => {
  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Analytics
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Detailed analytics and insights
          </p>
        </div>

        <Card className="flex flex-col items-center justify-center py-16">
          <BarChart3 size={48} className="text-gray-400 mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Analytics Dashboard
          </h2>
          <p className="text-gray-600 dark:text-gray-400 text-center">
            This page is ready for analytics visualization.
            <br />
            Integrate charting libraries like Recharts or Chart.js here.
          </p>
        </Card>
      </div>
    </DashboardLayout>
  );
};
