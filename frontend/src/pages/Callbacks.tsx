import { useState } from 'react';
import { DashboardLayout, Card, Button } from '../components';
import {
  useCallbacks,
  useUpcomingCallbacks,
  useCallbackStats,
  useCancelCallback,
  useCompleteCallback,
} from '../api/callbacks';
import {
  Phone,
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Plus,
  Filter,
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';

const statusColors = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300',
  completed: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300',
  cancelled: 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300',
  missed: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300',
};

export const CallbacksPage = () => {
  const { user } = useAuthStore();
  const teamId = user?.id || '';

  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [_showScheduleModal, setShowScheduleModal] = useState(false);
  const limit = 20;

  const { data: callbacksData, isLoading } = useCallbacks(teamId, page, limit, {
    status: statusFilter || undefined,
  });
  const { data: upcomingCallbacks } = useUpcomingCallbacks(teamId, 24);
  const { data: stats } = useCallbackStats(teamId);

  const cancelMutation = useCancelCallback();
  const completeMutation = useCompleteCallback();

  const handleCancel = async (id: string) => {
    try {
      await cancelMutation.mutateAsync(id);
      toast.success('Callback cancelled');
    } catch {
      toast.error('Failed to cancel callback');
    }
  };

  const handleComplete = async (id: string) => {
    try {
      await completeMutation.mutateAsync({ id });
      toast.success('Callback marked as complete');
    } catch {
      toast.error('Failed to complete callback');
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              Callback Scheduler
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Manage scheduled callbacks and follow-ups
            </p>
          </div>
          <Button onClick={() => setShowScheduleModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Schedule Callback
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Total</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {stats?.total || 0}
                </p>
              </div>
              <Calendar className="h-8 w-8 text-gray-400" />
            </div>
          </Card>

          <Card className="p-4 border-l-4 border-yellow-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Pending</p>
                <p className="text-2xl font-bold text-yellow-600">{stats?.pending || 0}</p>
              </div>
              <Clock className="h-8 w-8 text-yellow-500" />
            </div>
          </Card>

          <Card className="p-4 border-l-4 border-green-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Completed</p>
                <p className="text-2xl font-bold text-green-600">{stats?.completed || 0}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </Card>

          <Card className="p-4 border-l-4 border-red-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Missed</p>
                <p className="text-2xl font-bold text-red-600">{stats?.missed || 0}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>
          </Card>

          <Card className="p-4 border-l-4 border-blue-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Completion Rate</p>
                <p className="text-2xl font-bold text-blue-600">{stats?.completionRate || 0}%</p>
              </div>
              <Phone className="h-8 w-8 text-blue-500" />
            </div>
          </Card>
        </div>

        {/* Upcoming Callbacks */}
        {upcomingCallbacks && upcomingCallbacks.length > 0 && (
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Upcoming (Next 24 Hours)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {upcomingCallbacks.slice(0, 6).map((callback) => (
                <div
                  key={callback.id}
                  className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-gray-900 dark:text-white">
                      {callback.contact.name || callback.contact.phone}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-xs ${statusColors[callback.status]}`}>
                      {callback.status}
                    </span>
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      {formatTime(callback.scheduledTime)}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <Phone className="h-4 w-4" />
                      {callback.contact.phone}
                    </div>
                  </div>
                  {callback.reason && (
                    <p className="text-xs text-gray-400 mt-2">{callback.reason}</p>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Filter */}
        <Card className="p-4">
          <div className="flex items-center gap-4">
            <Filter className="h-5 w-5 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
              <option value="missed">Missed</option>
            </select>
          </div>
        </Card>

        {/* Callbacks Table */}
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Scheduled
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Reason
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Attempts
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center">
                      <div className="flex justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                      </div>
                    </td>
                  </tr>
                ) : callbacksData?.data?.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                      No callbacks found
                    </td>
                  </tr>
                ) : (
                  callbacksData?.data?.map((callback) => (
                    <tr key={callback.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white">
                            {callback.contact.name || 'Unknown'}
                          </div>
                          <div className="text-sm text-gray-500">{callback.contact.phone}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-white">
                          {formatDate(callback.scheduledTime)}
                        </div>
                        <div className="text-sm text-gray-500">{formatTime(callback.scheduledTime)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {callback.reason || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[callback.status]}`}>
                          {callback.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {callback.attempts}/{callback.maxAttempts}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {callback.status === 'pending' && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleComplete(callback.id)}
                              className="text-green-600 hover:text-green-800"
                              title="Mark Complete"
                            >
                              <CheckCircle className="h-5 w-5" />
                            </button>
                            <button
                              onClick={() => handleCancel(callback.id)}
                              className="text-red-600 hover:text-red-800"
                              title="Cancel"
                            >
                              <XCircle className="h-5 w-5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {callbacksData && callbacksData.total > limit && (
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <p className="text-sm text-gray-500">
                Showing {(page - 1) * limit + 1} to {Math.min(page * limit, callbacksData.total)} of{' '}
                {callbacksData.total}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page * limit >= callbacksData.total}
                  className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </DashboardLayout>
  );
};
