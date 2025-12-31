import React from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';
import { 
  CreditCard, 
  Smartphone, 
  Building2, 
  Wallet, 
  Link as LinkIcon, 
  Banknote,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';
import { formatCurrency, formatPercentage } from '../../utils/formatters';

type MethodStat = {
  method: string;
  count: number;
  revenue: number;
  successRate: number;
  avgTime: number; // in seconds
};

type PaymentMethodAnalyticsProps = {
  data: MethodStat[];
};

const getMethodIcon = (method: string) => {
  switch (method.toLowerCase()) {
    case 'card': return <CreditCard className="w-5 h-5" />;
    case 'upi': return <Smartphone className="w-5 h-5" />;
    case 'net_banking': return <Building2 className="w-5 h-5" />;
    case 'wallet': return <Wallet className="w-5 h-5" />;
    case 'link': return <LinkIcon className="w-5 h-5" />;
    case 'cod': return <Banknote className="w-5 h-5" />;
    default: return <CreditCard className="w-5 h-5" />;
  }
};

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export const PaymentMethodAnalytics: React.FC<PaymentMethodAnalyticsProps> = ({ data }) => {
  const topMethod = [...data].sort((a, b) => b.revenue - a.revenue)[0];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-6 text-white shadow-lg">
          <div className="flex items-center mb-4">
            <div className="p-2 bg-white/20 rounded-lg mr-3">
              <TrendingUp className="w-5 h-5" />
            </div>
            <span className="text-sm font-bold opacity-80 uppercase tracking-wider">Top Performing</span>
          </div>
          <div className="text-3xl font-black mb-1">{topMethod?.method || 'N/A'}</div>
          <p className="text-blue-100 text-sm">
            Contributing {topMethod ? formatPercentage((topMethod.revenue / data.reduce((s, d) => s + d.revenue, 0)) * 100) : '0%'} of total revenue
          </p>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <div className="flex items-center mb-4 text-gray-500">
            <CheckCircle className="w-5 h-5 mr-3" />
            <span className="text-sm font-bold uppercase tracking-wider">Highest Success Rate</span>
          </div>
          <div className="text-3xl font-black text-gray-900">
            {[...data].sort((a, b) => b.successRate - a.successRate)[0]?.method || 'N/A'}
          </div>
          <div className="flex items-center mt-1 text-green-600 font-bold">
            <TrendingUp className="w-4 h-4 mr-1" />
            {[...data].sort((a, b) => b.successRate - a.successRate)[0]?.successRate || 0}%
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <div className="flex items-center mb-4 text-gray-500">
            <Clock className="w-5 h-5 mr-3" />
            <span className="text-sm font-bold uppercase tracking-wider">Fastest Checkout</span>
          </div>
          <div className="text-3xl font-black text-gray-900">
            {[...data].sort((a, b) => a.avgTime - b.avgTime)[0]?.method || 'N/A'}
          </div>
          <div className="mt-1 text-gray-500 text-sm">
            Avg. {[...data].sort((a, b) => a.avgTime - b.avgTime)[0]?.avgTime || 0} seconds
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-bold text-gray-900">Revenue by Method</h3>
        </div>
        <div className="p-6">
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="method" 
                  axisLine={false} 
                  tickLine={false}
                  tick={{ fontSize: 12, fill: '#64748b' }}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false}
                  tick={{ fontSize: 12, fill: '#64748b' }}
                  tickFormatter={(val) => `₹${val/1000}k`}
                />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  formatter={(val: number) => [formatCurrency(val, 'INR'), 'Revenue']}
                />
                <Bar dataKey="revenue" radius={[6, 6, 0, 0]}>
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="font-bold text-gray-900">Method Performance Matrix</h3>
          </div>
          <div className="divide-y divide-gray-50">
            {data.map((item, i) => (
              <div key={item.method} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                <div className="flex items-center">
                  <div className={`p-2 rounded-lg mr-4 ${i % 2 === 0 ? 'bg-blue-50 text-blue-600' : 'bg-indigo-50 text-indigo-600'}`}>
                    {getMethodIcon(item.method)}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-gray-900">{item.method}</div>
                    <div className="text-xs text-gray-500">{item.count} transactions</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-black text-gray-900">{formatCurrency(item.revenue, 'INR')}</div>
                  <div className={`text-xs font-bold ${item.successRate > 90 ? 'text-green-600' : 'text-yellow-600'}`}>
                    {item.successRate}% success
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h3 className="font-bold text-gray-900 mb-6">Success Rate Comparison</h3>
          <div className="space-y-6">
            {data.map((item, i) => (
              <div key={item.method}>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-700">{item.method}</span>
                  <span className="text-sm font-bold text-gray-900">{item.successRate}%</span>
                </div>
                <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
                  <div 
                    className="h-full rounded-full transition-all duration-1000"
                    style={{ 
                      width: `${item.successRate}%`,
                      backgroundColor: item.successRate > 95 ? '#10b981' : item.successRate > 85 ? '#3b82f6' : '#f59e0b'
                    }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-8 bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-start">
            <AlertTriangle className="w-5 h-5 text-blue-600 mr-3 shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700 leading-relaxed">
              <strong>Recommendation:</strong> Net Banking shows a 15% lower success rate during peak hours (6 PM - 10 PM). Consider promoting UPI or Card payments during this window to reduce failure rates.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
