import React from 'react';
import { Call, CallStatus, Sentiment } from '../../types';
import { Button } from '../Button';
import clsx from 'clsx';

interface CallHistoryTableProps {
  calls: Call[];
  isLoading: boolean;
  onSelectCall: (call: Call) => void;
}

const formatDuration = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const StatusBadge = ({ status }: { status: CallStatus }) => {
  const styles = {
    active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    completed: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    missed: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  };
  return (
    <span className={clsx('px-2.5 py-0.5 rounded-full text-xs font-medium uppercase', styles[status])}>
      {status}
    </span>
  );
};

const SentimentBadge = ({ sentiment }: { sentiment: Sentiment }) => {
  const styles = {
    positive: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    neutral: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
    negative: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  };
  return (
    <span className={clsx('px-2.5 py-0.5 rounded-full text-xs font-medium capitalize', styles[sentiment])}>
      {sentiment}
    </span>
  );
};

export const CallHistoryTable: React.FC<CallHistoryTableProps> = ({ calls, isLoading, onSelectCall }) => {
  if (isLoading) {
    return <div className="p-12 text-center text-gray-500">Loading calls...</div>;
  }

  if (calls.length === 0) {
    return <div className="p-12 text-center text-gray-500">No calls found matching your filters.</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left">
        <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400 border-b dark:border-gray-600">
          <tr>
            <th className="px-6 py-3">Caller</th>
            <th className="px-6 py-3">Agent</th>
            <th className="px-6 py-3">Date</th>
            <th className="px-6 py-3">Duration</th>
            <th className="px-6 py-3">Status</th>
            <th className="px-6 py-3">Sentiment</th>
            <th className="px-6 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {calls.map((call) => (
            <tr
              key={call.id}
              onClick={() => onSelectCall(call)}
              className="bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
            >
              <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{call.caller}</td>
              <td className="px-6 py-4 text-gray-700 dark:text-gray-300">{call.agent}</td>
              <td className="px-6 py-4 text-gray-700 dark:text-gray-300">
                {new Date(call.startTime).toLocaleString()}
              </td>
              <td className="px-6 py-4 text-gray-700 dark:text-gray-300">{formatDuration(call.duration)}</td>
              <td className="px-6 py-4">
                <StatusBadge status={call.status} />
              </td>
              <td className="px-6 py-4">
                 <SentimentBadge sentiment={call.sentiment} />
              </td>
              <td className="px-6 py-4 text-right">
                <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); onSelectCall(call); }}>
                  View Details
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
