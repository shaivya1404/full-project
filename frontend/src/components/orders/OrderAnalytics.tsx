import React from 'react';
import { BarChart3, Clock, DollarSign, ShoppingCart } from 'lucide-react';

export const OrderAnalytics: React.FC = () => {
  // Mock analytics data - in real app, this would come from API
  const stats = [
    { label: 'Total Orders', value: '1,247', change: '+12%', icon: ShoppingCart, color: 'blue' },
    { label: 'Revenue', value: '$45,231', change: '+8%', icon: DollarSign, color: 'green' },
    { label: 'Average Order', value: '$36.28', change: '+3%', icon: BarChart3, color: 'purple' },
    { label: 'Processing', value: '23', change: '-5%', icon: Clock, color: 'yellow' }
  ];

  const recentOrders = [
    { id: 'ORD-001', customer: 'John Smith', amount: 129.99, status: 'processing', time: '2 hours ago' },
    { id: 'ORD-002', customer: 'Sarah Johnson', amount: 89.50, status: 'confirmed', time: '3 hours ago' },
    { id: 'ORD-003', customer: 'Mike Davis', amount: 245.00, status: 'ready', time: '5 hours ago' },
  ];

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div key={index} className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">{stat.label}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
                  <p className={`text-sm mt-2 ${stat.change.startsWith('+') ? 'text-green-600' : 'text-red-600'}`}>
                    {stat.change} from last month
                  </p>
                </div>
                <div className={`h-12 w-12 bg-${stat.color}-100 rounded-lg flex items-center justify-center`}>
                  <Icon className={`h-6 w-6 text-${stat.color}-600`} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Order Status Distribution */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Order Status Distribution</h3>
          <div className="space-y-3">
            {[
              { status: 'Pending', count: 45, percentage: 25, color: 'bg-yellow-500' },
              { status: 'Confirmed', count: 68, percentage: 38, color: 'bg-blue-500' },
              { status: 'Processing', count: 23, percentage: 13, color: 'bg-purple-500' },
              { status: 'Ready', count: 31, percentage: 17, color: 'bg-green-500' },
              { status: 'Delivered', count: 12, percentage: 7, color: 'bg-gray-500' }
            ].map((item) => (
              <div key={item.status}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-700">{item.status}</span>
                  <span className="text-gray-900 font-medium">{item.count} ({item.percentage}%)</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`${item.color} h-2 rounded-full`}
                    style={{ width: `${item.percentage}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Revenue Trend */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue Trend (Last 7 Days)</h3>
          <div className="space-y-3">
            {[
              { day: 'Mon', revenue: 3200 },
              { day: 'Tue', revenue: 4800 },
              { day: 'Wed', revenue: 3900 },
              { day: 'Thu', revenue: 5400 },
              { day: 'Fri', revenue: 6200 },
              { day: 'Sat', revenue: 7100 },
              { day: 'Sun', revenue: 5800 }
            ].map((item, index) => {
              const maxRevenue = 8000;
              const percentage = (item.revenue / maxRevenue) * 100;
              return (
                <div key={index} className="flex items-center gap-3">
                  <span className="text-sm text-gray-600 w-12">{item.day}</span>
                  <div className="flex-1 bg-gray-200 rounded-full h-6 relative">
                    <div
                      className="absolute left-0 top-0 bg-green-500 h-6 rounded-full flex items-center justify-end pr-2"
                      style={{ width: `${percentage}%` }}
                    >
                      <span className="text-xs text-white font-medium">
                        ${(item.revenue / 1000).toFixed(1)}k
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Recent Orders */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Recent Orders</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Order
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Time
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {recentOrders.map((order) => (
                <tr key={order.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {order.id}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    {order.customer}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                    ${order.amount.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${order.status === 'processing' ? 'bg-yellow-100 text-yellow-800' :
                      order.status === 'confirmed' ? 'bg-blue-100 text-blue-800' :
                        order.status === 'ready' ? 'bg-green-100 text-green-800' :
                          'bg-gray-100 text-gray-800'
                      }`}>
                      {order.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {order.time}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};