import React from 'react';
import {
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  XAxis,
  YAxis
} from 'recharts';
import {
  RotateCcw,
  TrendingUp,
  AlertCircle,
  FileText,
  TrendingDown,
  Clock
} from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';

type RefundAnalyticsProps = {
  totalRefunds: number;
  refundAmount: number;
  refundRate: number;
  avgProcessingTime: number;
  reasonBreakdown: { name: string; value: number }[];
  refundTrend: { date: string; count: number }[];
};

const COLORS = ['#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6', '#10b981', '#6b7280'];

export const RefundAnalytics: React.FC<RefundAnalyticsProps> = ({
  totalRefunds,
  refundAmount,
  refundRate,
  avgProcessingTime,
  reasonBreakdown,
  refundTrend,
}) => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-center text-gray-500 mb-2">
            <RotateCcw className="w-4 h-4 mr-2" />
            <span className="text-xs font-bold uppercase tracking-wider">Total Refunds</span>
          </div>
          <div className="text-3xl font-black text-gray-900">{totalRefunds}</div>
          <div className="flex items-center mt-1 text-red-600 text-xs font-bold">
            <TrendingUp className="w-3 h-3 mr-1" />
            12% from last month
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-center text-gray-500 mb-2">
            <TrendingUp className="w-4 h-4 mr-2" />
            <span className="text-xs font-bold uppercase tracking-wider">Refund Amount</span>
          </div>
          <div className="text-3xl font-black text-gray-900">{formatCurrency(refundAmount, 'INR')}</div>
          <div className="flex items-center mt-1 text-green-600 text-xs font-bold">
            <TrendingDown className="w-3 h-3 mr-1" />
            5% from last month
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-center text-gray-500 mb-2">
            <AlertCircle className="w-4 h-4 mr-2" />
            <span className="text-xs font-bold uppercase tracking-wider">Refund Rate</span>
          </div>
          <div className="text-3xl font-black text-gray-900">{refundRate}%</div>
          <div className="flex items-center mt-1 text-gray-500 text-xs font-medium">
            Threshold: 3.5%
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-center text-gray-500 mb-2">
            <Clock className="w-4 h-4 mr-2" />
            <span className="text-xs font-bold uppercase tracking-wider">Avg. Time</span>
          </div>
          <div className="text-3xl font-black text-gray-900">{avgProcessingTime}d</div>
          <div className="flex items-center mt-1 text-green-600 text-xs font-bold">
            <TrendingDown className="w-3 h-3 mr-1" />
            -1.5 days improved
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Refund Trend Line Chart */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <h3 className="font-bold text-gray-900 mb-6">Refund Requests Over Time</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={refundTrend}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: '#64748b' }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: '#64748b' }}
                />
                <Tooltip
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="#ef4444"
                  strokeWidth={3}
                  dot={{ r: 4, fill: '#ef4444', strokeWidth: 2, stroke: '#fff' }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Reason Breakdown Pie Chart */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col">
          <h3 className="font-bold text-gray-900 mb-6">Refund Reasons Breakdown</h3>
          <div className="flex-1 flex flex-col md:flex-row items-center justify-center">
            <div className="w-full md:w-1/2 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={reasonBreakdown}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {reasonBreakdown.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="w-full md:w-1/2 space-y-3 mt-6 md:mt-0 md:pl-6">
              {reasonBreakdown.map((reason, i) => (
                <div key={reason.name} className="flex items-center justify-between">
                  <div className="flex items-center">
                    <span className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: COLORS[i % COLORS.length] }}></span>
                    <span className="text-sm text-gray-600 truncate max-w-[140px]">{reason.name}</span>
                  </div>
                  <span className="text-sm font-bold text-gray-900">{reason.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-red-50 border border-red-100 rounded-2xl p-6">
        <div className="flex items-start">
          <div className="p-3 bg-red-100 rounded-xl mr-4 text-red-600">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-red-900">Fraud Prevention Insight</h3>
            <p className="text-sm text-red-700 mt-1 leading-relaxed">
              We've noticed a 25% spike in "Product Not Received" refund requests from customers using prepaid cards.
              <strong> 12 of these customers</strong> have been flagged for potential refund abuse.
              We recommend enforcing stricter courier verification for these high-risk zones.
            </p>
            <button className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-bold hover:bg-red-700 transition-colors">
              View Detailed Risk Report
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
