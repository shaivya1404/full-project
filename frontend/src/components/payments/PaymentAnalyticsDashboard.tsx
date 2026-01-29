import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  RefreshCcw,
  CheckCircle,
  AlertCircle,
  Calendar,
  Download
} from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';
import type { PaymentAnalytics } from '../../types';

type PaymentAnalyticsDashboardProps = {
  analytics: PaymentAnalytics;
  revenueTrend: { date: string; amount: number }[];
  methodDistribution: { name: string; value: number }[];
  statusDistribution: { status: string; count: number }[];
  onExport: () => void;
};

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export const PaymentAnalyticsDashboard: React.FC<PaymentAnalyticsDashboardProps> = ({
  analytics,
  revenueTrend,
  methodDistribution,
  statusDistribution,
  onExport,
}) => {
  const stats = [
    {
      label: 'Total Revenue',
      value: formatCurrency(analytics.totalRevenue, 'INR'),
      icon: <DollarSign className="w-5 h-5 text-blue-600" />,
      change: '+12.5%',
      isPositive: true,
      bg: 'bg-blue-50'
    },
    {
      label: 'Success Rate',
      value: `${analytics.successRate}%`,
      icon: <CheckCircle className="w-5 h-5 text-green-600" />,
      change: '+2.1%',
      isPositive: true,
      bg: 'bg-green-50'
    },
    {
      label: 'Refund Rate',
      value: `${analytics.refundRate}%`,
      icon: <RefreshCcw className="w-5 h-5 text-purple-600" />,
      change: '-0.4%',
      isPositive: true,
      bg: 'bg-purple-50'
    },
    {
      label: 'Failed Payments',
      value: analytics.failedPayments,
      icon: <AlertCircle className="w-5 h-5 text-red-600" />,
      change: '+5',
      isPositive: false,
      bg: 'bg-red-50'
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-gray-900">Payment Analytics</h2>
        <div className="flex space-x-2">
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <select className="pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none appearance-none">
              <option>Last 30 Days</option>
              <option>Last 7 Days</option>
              <option>This Month</option>
              <option>Custom Range</option>
            </select>
          </div>
          <button
            onClick={onExport}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors"
          >
            <Download className="w-4 h-4 mr-2" />
            Export Report
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <div key={i} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <div className="flex justify-between items-start mb-4">
              <div className={`p-3 rounded-xl ${stat.bg}`}>
                {stat.icon}
              </div>
              <div className={`flex items-center text-xs font-bold ${stat.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                {stat.isPositive ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
                {stat.change}
              </div>
            </div>
            <div className="text-2xl font-black text-gray-900">{stat.value}</div>
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mt-1">{stat.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Trend Area Chart */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-gray-900">Revenue Trend</h3>
            <div className="flex space-x-2">
              <span className="flex items-center text-xs text-gray-500">
                <span className="w-3 h-3 bg-blue-500 rounded-full mr-1"></span>
                Daily Revenue
              </span>
            </div>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueTrend}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: '#94a3b8' }}
                  dy={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: '#94a3b8' }}
                  tickFormatter={(val) => `₹${val / 1000}k`}
                />
                <Tooltip
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  formatter={(val: number | undefined) => [formatCurrency(val || 0, 'INR'), 'Revenue']}
                />
                <Area
                  type="monotone"
                  dataKey="amount"
                  stroke="#3b82f6"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorRevenue)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Payment Method Distribution */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <h3 className="font-bold text-gray-900 mb-6">Payment Methods</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={methodDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {methodDistribution.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 space-y-2">
            {methodDistribution.map((method, i) => (
              <div key={method.name} className="flex items-center justify-between">
                <div className="flex items-center">
                  <span className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: COLORS[i % COLORS.length] }}></span>
                  <span className="text-sm text-gray-600">{method.name}</span>
                </div>
                <span className="text-sm font-bold text-gray-900">{method.value}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Status Distribution */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <h3 className="font-bold text-gray-900 mb-6">Transaction Status</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusDistribution} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" hide />
                <YAxis
                  dataKey="status"
                  type="category"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: '#64748b', fontWeight: 'bold' }}
                  width={100}
                />
                <Tooltip
                  cursor={{ fill: 'transparent' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {statusDistribution.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={
                        entry.status === 'Completed' ? '#10b981' :
                          entry.status === 'Processing' ? '#3b82f6' :
                            entry.status === 'Failed' ? '#ef4444' :
                              '#94a3b8'
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Failed Payment Analysis */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <h3 className="font-bold text-gray-900 mb-6">Common Failure Reasons</h3>
          <div className="space-y-4">
            {[
              { reason: 'Insufficient Funds', count: 45, percentage: 38 },
              { reason: 'Incorrect Card Details', count: 32, percentage: 27 },
              { reason: 'Authentication Failed (3DS)', count: 24, percentage: 20 },
              { reason: 'Gateway Timeout', count: 12, percentage: 10 },
              { reason: 'Expired Card', count: 6, percentage: 5 },
            ].map((failure, i) => (
              <div key={i}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium text-gray-700">{failure.reason}</span>
                  <span className="text-gray-500">{failure.count} occurrences</span>
                </div>
                <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-red-500 h-full rounded-full"
                    style={{ width: `${failure.percentage}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
