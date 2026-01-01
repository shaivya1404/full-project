import {
  Users,
  PhoneCall,
  Clock,
  TrendingUp,
  Download,
} from 'lucide-react';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from 'recharts';
import type { CampaignAnalyticsData } from '../../types';
import { Button } from '../index';
import { Card } from '../Card';

type CampaignAnalyticsProps = {
  analytics: CampaignAnalyticsData;
  callTrends: { date: string; count: number }[];
  contactStatus: { status: string; count: number }[];
  onExport: (format: 'csv' | 'pdf') => void;
  loading?: boolean;
};

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

export const CampaignAnalytics = ({
  analytics,
  callTrends,
  contactStatus,
  onExport,
  loading,
}: CampaignAnalyticsProps) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  const statCards = [
    {
      title: 'Total Contacts',
      value: analytics.totalContacts,
      icon: Users,
      color: 'text-blue-600',
      bg: 'bg-blue-100 dark:bg-blue-900/20',
    },
    {
      title: 'Calls Made',
      value: analytics.callsMade,
      icon: PhoneCall,
      color: 'text-purple-600',
      bg: 'bg-purple-100 dark:bg-purple-900/20',
    },
    {
      title: 'Success Rate',
      value: `${analytics.successRate}%`,
      icon: TrendingUp,
      color: 'text-green-600',
      bg: 'bg-green-100 dark:bg-green-900/20',
    },
    {
      title: 'Avg. Duration',
      value: `${Math.round(analytics.averageDuration)}s`,
      icon: Clock,
      color: 'text-orange-600',
      bg: 'bg-orange-100 dark:bg-orange-900/20',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Campaign Performance</h2>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => onExport('csv')}>
            <Download size={16} className="mr-2" />
            Export CSV
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onExport('pdf')}>
            <Download size={16} className="mr-2" />
            Export PDF
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, index) => (
          <Card key={index} className="p-4">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-lg ${card.bg}`}>
                <card.icon className={`h-6 w-6 ${card.color}`} />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{card.title}</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{card.value}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Call Volume Trends</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={callTrends}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis 
                  dataKey="date" 
                  stroke="#9CA3AF" 
                  fontSize={12} 
                  tickLine={false} 
                  axisLine={false} 
                />
                <YAxis 
                  stroke="#9CA3AF" 
                  fontSize={12} 
                  tickLine={false} 
                  axisLine={false} 
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#FFF', 
                    borderRadius: '8px', 
                    border: 'none', 
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' 
                  }} 
                />
                <Line 
                  type="monotone" 
                  dataKey="count" 
                  stroke="#3B82F6" 
                  strokeWidth={2} 
                  dot={{ r: 4, fill: '#3B82F6' }} 
                  activeDot={{ r: 6 }} 
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Contact Status Distribution</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={contactStatus}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="count"
                  nameKey="status"
                >
                  {contactStatus.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Status Breakdown</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg text-center border border-gray-100 dark:border-gray-800">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-1">Pending</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{analytics.statusBreakdown.pending}</p>
          </div>
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-center border border-blue-100 dark:border-blue-800">
            <p className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase mb-1">Called</p>
            <p className="text-xl font-bold text-blue-700 dark:text-blue-300">{analytics.statusBreakdown.called}</p>
          </div>
          <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg text-center border border-green-100 dark:border-green-800">
            <p className="text-xs font-medium text-green-600 dark:text-green-400 uppercase mb-1">Completed</p>
            <p className="text-xl font-bold text-green-700 dark:text-green-300">{analytics.statusBreakdown.completed}</p>
          </div>
          <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg text-center border border-red-100 dark:border-red-800">
            <p className="text-xs font-medium text-red-600 dark:text-red-400 uppercase mb-1">Failed</p>
            <p className="text-xl font-bold text-red-700 dark:text-red-300">{analytics.statusBreakdown.failed}</p>
          </div>
          <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg text-center border border-purple-100 dark:border-purple-800">
            <p className="text-xs font-medium text-purple-600 dark:text-purple-400 uppercase mb-1">Transferred</p>
            <p className="text-xl font-bold text-purple-700 dark:text-purple-300">{analytics.statusBreakdown.transferred}</p>
          </div>
        </div>
      </Card>
    </div>
  );
};
