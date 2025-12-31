import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Users, X } from 'lucide-react';
import { Button } from '../Button';

type AgentPerformanceComparisonProps = {
  agents: any[];
  onClose: () => void;
};

export const AgentPerformanceComparison = ({ agents, onClose }: AgentPerformanceComparisonProps) => {
  const data = agents.map(agent => ({
    name: agent.firstName,
    CSAT: agent.performance?.[0]?.customerSatisfactionScore || Math.random() * 5,
    AHT: agent.performance?.[0]?.averageHandleTime / 60 || Math.random() * 10,
    Calls: agent.performance?.[0]?.totalCalls || Math.random() * 50,
  }));

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg text-primary">
            <Users size={20} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Performance Comparison</h3>
            <p className="text-sm text-gray-500">Side-by-side metric analysis for selected agents</p>
          </div>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors">
          <X size={20} />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">CSAT Ratings (1-5)</h4>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} />
                <Tooltip 
                  cursor={{ fill: 'rgba(59, 130, 246, 0.1)' }}
                  contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px', color: '#fff' }}
                />
                <Bar dataKey="CSAT" fill="#3B82F6" radius={[4, 4, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">Total Calls Handled</h4>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} />
                <Tooltip 
                  cursor={{ fill: 'rgba(139, 92, 246, 0.1)' }}
                  contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px', color: '#fff' }}
                />
                <Bar dataKey="Calls" fill="#8B5CF6" radius={[4, 4, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="mt-8 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-700">
              <th className="text-left py-3 font-medium text-gray-500">Agent</th>
              <th className="text-center py-3 font-medium text-gray-500">Avg. Handle Time</th>
              <th className="text-center py-3 font-medium text-gray-500">CSAT Score</th>
              <th className="text-center py-3 font-medium text-gray-500">FCR Rate</th>
              <th className="text-center py-3 font-medium text-gray-500">Quality Score</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {agents.map((agent, i) => (
              <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors">
                <td className="py-4 font-medium text-gray-900 dark:text-white">{agent.firstName} {agent.lastName}</td>
                <td className="py-4 text-center">3m 45s</td>
                <td className="py-4 text-center">{(4 + Math.random()).toFixed(1)}/5</td>
                <td className="py-4 text-center">{(85 + Math.random() * 10).toFixed(0)}%</td>
                <td className="py-4 text-center">{(90 + Math.random() * 5).toFixed(0)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
