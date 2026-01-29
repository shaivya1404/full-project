import { Download } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../index';
import type { AuditLog } from '../../types';

interface AuditLogTableProps {
  auditLogs: AuditLog[];
  loading?: boolean;
  onExport: () => void;
  onFilterChange: (filters: { actionType?: string; userId?: string }) => void;
}

const actionTypeOptions = [
  { value: '', label: 'All Actions' },
  { value: 'member_added', label: 'Member Added' },
  { value: 'member_removed', label: 'Member Removed' },
  { value: 'role_changed', label: 'Role Changed' },
  { value: 'settings_updated', label: 'Settings Updated' },
  { value: 'invite_sent', label: 'Invite Sent' },
  { value: 'invite_revoked', label: 'Invite Revoked' },
];

const actionTypeColors: Record<string, string> = {
  member_added: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  member_removed: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  role_changed: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  settings_updated: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  invite_sent: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  invite_revoked: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
};

export const AuditLogTable = ({ auditLogs, loading, onExport, onFilterChange }: AuditLogTableProps) => {
  const [actionTypeFilter, setActionTypeFilter] = useState('');
  const [userFilter, setUserFilter] = useState('');

  const handleFilterChange = (key: string, value: string) => {
    if (key === 'actionType') {
      setActionTypeFilter(value);
    } else if (key === 'userId') {
      setUserFilter(value);
    }

    onFilterChange({
      actionType: key === 'actionType' ? value : actionTypeFilter,
      userId: key === 'userId' ? value : userFilter,
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getActionTypeLabel = (actionType: string) => {
    const option = actionTypeOptions.find(opt => opt.value === actionType);
    return option?.label || actionType;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="flex gap-3 flex-wrap">
          <select
            value={actionTypeFilter}
            onChange={(e) => handleFilterChange('actionType', e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {actionTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <input
            type="text"
            placeholder="Filter by user name..."
            value={userFilter}
            onChange={(e) => handleFilterChange('userId', e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <Button variant="secondary" onClick={onExport}>
          <Download size={18} className="mr-2" />
          Export Logs
        </Button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  Action
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  Actor
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  Details
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  Timestamp
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center">
                    <div className="inline-flex items-center">
                      <svg className="animate-spin h-5 w-5 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span className="ml-2 text-gray-600 dark:text-gray-400">Loading...</span>
                    </div>
                  </td>
                </tr>
              ) : auditLogs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                    No audit logs found
                  </td>
                </tr>
              ) : (
                auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                          actionTypeColors[log.actionType] || 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {getActionTypeLabel(log.actionType)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{log.actor.name}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{log.actor.email}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-gray-600 dark:text-gray-400">{log.details}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-gray-600 dark:text-gray-400">{formatDate(log.timestamp)}</p>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
