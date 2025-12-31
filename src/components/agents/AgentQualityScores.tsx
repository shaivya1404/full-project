import { BarChart3, TrendingUp, CheckCircle, AlertTriangle, MessageSquare } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

type AgentQualityScoresProps = {
  data: any[];
  loading?: boolean;
};

export const AgentQualityScores = ({ data, loading }: AgentQualityScoresProps) => {
  const chartData = [
    { month: 'Jan', score: 85 },
    { month: 'Feb', score: 88 },
    { month: 'Mar', score: 82 },
    { month: 'Apr', score: 90 },
    { month: 'May', score: 92 },
    { month: 'Jun', score: 89 },
  ];

  const metrics = [
    { label: 'Script Adherence', value: '95%', status: 'excellent', icon: CheckCircle },
    { label: 'Empathy Score', value: '4.8/5', status: 'excellent', icon: TrendingUp },
    { label: 'Compliance', value: '100%', status: 'excellent', icon: ShieldCheck },
    { label: 'Avg. Silence', value: '12s', status: 'warning', icon: AlertTriangle },
  ];

  function ShieldCheck(props: any) {
    return (
      <svg
        {...props}
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
        <path d="m9 12 2 2 4-4" />
      </svg>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
          <BarChart3 size={20} className="mr-2 text-primary" />
          Quality & Compliance
        </h3>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {metrics.map((metric) => (
            <div key={metric.label} className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="flex justify-between items-start mb-2">
                <metric.icon size={18} className={metric.status === 'excellent' ? 'text-green-500' : 'text-yellow-500'} />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">{metric.label}</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white mt-0.5">{metric.value}</p>
            </div>
          ))}
        </div>

        <div className="mb-6">
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Quality Score Trend</h4>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" opacity={0.1} />
                <XAxis 
                  dataKey="month" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 12, fill: '#9CA3AF' }}
                />
                <YAxis 
                  domain={[0, 100]} 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 12, fill: '#9CA3AF' }}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px', color: '#F3F4F6' }}
                  itemStyle={{ color: '#3B82F6' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="score" 
                  stroke="#3B82F6" 
                  strokeWidth={3} 
                  dot={{ r: 4, fill: '#3B82F6', strokeWidth: 2, stroke: '#fff' }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Recent Quality Feedback</h4>
          {[1, 2].map((i) => (
            <div key={i} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                  <div className="px-2 py-0.5 bg-green-100 text-green-800 text-[10px] font-bold rounded uppercase">Score: 92</div>
                  <span className="text-xs text-gray-500">Oct 24, 2025 by John Supervisor</span>
                </div>
                <button className="text-xs text-primary hover:underline font-medium">View Full Review</button>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 italic flex items-start gap-2">
                <MessageSquare size={14} className="mt-1 flex-shrink-0" />
                "Great handle on technical aspects. Empathy was high during the billing dispute. Suggest working on the wrap-up speed."
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
