import { useState, useEffect } from 'react';
import { X, Clock, Phone, FileText, Play, Download } from 'lucide-react';
import type { Call } from '../../types';
import { Button } from '../Button';
import { Badge } from '../Badge';
import { Modal } from '../Modal';
import { getCustomerCallHistory } from '../../services/api';
import { formatDuration, formatRelativeTime } from '../../utils/formatters';

interface CallHistoryPanelProps {
  customerId: string;
  onClose: () => void;
}

export const CallHistoryPanel = ({ customerId, onClose }: CallHistoryPanelProps) => {
  const [calls, setCalls] = useState<Call[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCall, setSelectedCall] = useState<Call | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCallHistory = async () => {
      try {
        const callHistory = await getCustomerCallHistory(customerId);
        setCalls(callHistory);
        setError(null);
      } catch (err) {
        setError('Failed to fetch call history');
        console.error('Error fetching call history:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchCallHistory();
  }, [customerId]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-50';
      case 'missed': return 'text-red-600 bg-red-50';
      case 'failed': return 'text-red-600 bg-red-50';
      case 'in-progress': return 'text-blue-600 bg-blue-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getSentimentColor = (sentiment?: string) => {
    switch (sentiment) {
      case 'positive': return 'text-green-600 bg-green-50';
      case 'negative': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const handlePlayRecording = (call: Call) => {
    if (call.recordingUrl) {
      window.open(call.recordingUrl, '_blank');
    } else {
      alert('No recording available for this call');
    }
  };

  const handleDownloadRecording = (call: Call) => {
    if (call.recordingUrl) {
      // Implementation would depend on backend API
      console.log('Download recording for call:', call.id);
    } else {
      alert('No recording available for this call');
    }
  };

  // Calculate summary statistics
  const totalCalls = calls.length;
  const completedCalls = calls.filter(call => call.status === 'completed').length;
  const avgDuration = totalCalls > 0
    ? calls.reduce((sum, call) => sum + call.duration, 0) / totalCalls
    : 0;
  const positiveSentimentCalls = calls.filter(call => call.sentiment === 'positive').length;
  const satisfactionRate = totalCalls > 0 ? (positiveSentimentCalls / totalCalls) * 100 : 0;

  return (
    <>
      <Modal isOpen={true} onClose={onClose} size="xl">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <Clock className="h-6 w-6 text-blue-500" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Customer Call History
              </h2>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X size={24} />
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <FileText className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
                {error}
              </h3>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Summary Statistics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">
                    {totalCalls}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    Total Calls
                  </div>
                </div>

                <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">
                    {completedCalls}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    Completed
                  </div>
                </div>

                <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">
                    {formatDuration(avgDuration)}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    Avg Duration
                  </div>
                </div>

                <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">
                    {Math.round(satisfactionRate)}%
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    Satisfaction
                  </div>
                </div>
              </div>

              {/* Call List */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  Recent Calls
                </h3>

                {calls.length === 0 ? (
                  <div className="text-center py-8 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <Phone className="mx-auto h-12 w-12 text-gray-400" />
                    <h4 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
                      No Call History
                    </h4>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      This customer hasn't had any previous calls.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {calls.map((call) => (
                      <div
                        key={call.id}
                        className="p-4 border border-gray-200 dark:border-gray-600 rounded-lg hover:shadow-md transition-all"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            <div className="flex-shrink-0">
                              <Phone className="h-5 w-5 text-gray-400" />
                            </div>

                            <div className="flex-1">
                              <div className="flex items-center space-x-3">
                                <span className="font-medium text-gray-900 dark:text-white">
                                  {formatRelativeTime(call.startTime)}
                                </span>
                                <Badge className={getStatusColor(call.status)}>
                                  {call.status}
                                </Badge>
                                {call.sentiment && (
                                  <Badge className={getSentimentColor(call.sentiment)}>
                                    {call.sentiment}
                                  </Badge>
                                )}
                              </div>

                              <div className="flex items-center space-x-4 mt-1 text-sm text-gray-500 dark:text-gray-400">
                                <span>Agent: {call.agent}</span>
                                <span>Duration: {formatDuration(call.duration)}</span>
                                <span>{new Date(call.startTime).toLocaleDateString()}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center space-x-2">
                            {call.recordingUrl && (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handlePlayRecording(call)}
                                >
                                  <Play size={14} className="mr-1" />
                                  Play
                                </Button>

                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleDownloadRecording(call)}
                                >
                                  <Download size={14} className="mr-1" />
                                  Download
                                </Button>
                              </>
                            )}

                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedCall(call)}
                            >
                              <FileText size={14} className="mr-1" />
                              Details
                            </Button>
                          </div>
                        </div>

                        {/* Notes Preview */}
                        {call.notes && (
                          <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-700 rounded text-sm">
                            <div className="font-medium text-gray-700 dark:text-gray-300 mb-1">
                              Notes:
                            </div>
                            <div className="text-gray-600 dark:text-gray-400">
                              {call.notes.length > 100
                                ? `${call.notes.substring(0, 100)}...`
                                : call.notes}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Call Details Modal */}
      {selectedCall && (
        <Modal isOpen={true} onClose={() => setSelectedCall(null)} size="lg">
          <div className="p-6">
            <div className="flex items-center space-x-3 mb-6">
              <Phone className="h-6 w-6 text-blue-500" />
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                Call Details
              </h3>
            </div>

            <div className="space-y-6">
              {/* Call Information */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Call ID
                  </div>
                  <div className="text-sm text-gray-900 dark:text-white">
                    {selectedCall.id.slice(-8)}
                  </div>
                </div>

                <div>
                  <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Date & Time
                  </div>
                  <div className="text-sm text-gray-900 dark:text-white">
                    {new Date(selectedCall.startTime).toLocaleString()}
                  </div>
                </div>

                <div>
                  <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Agent
                  </div>
                  <div className="text-sm text-gray-900 dark:text-white">
                    {selectedCall.agent}
                  </div>
                </div>

                <div>
                  <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Duration
                  </div>
                  <div className="text-sm text-gray-900 dark:text-white">
                    {formatDuration(selectedCall.duration)}
                  </div>
                </div>

                <div>
                  <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Status
                  </div>
                  <Badge className={getStatusColor(selectedCall.status)}>
                    {selectedCall.status}
                  </Badge>
                </div>

                <div>
                  <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Sentiment
                  </div>
                  {selectedCall.sentiment && (
                    <Badge className={getSentimentColor(selectedCall.sentiment)}>
                      {selectedCall.sentiment}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Transcript */}
              {selectedCall.transcript && (
                <div>
                  <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Transcript
                  </div>
                  <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg max-h-64 overflow-y-auto">
                    <pre className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap">
                      {selectedCall.transcript}
                    </pre>
                  </div>
                </div>
              )}

              {/* Notes */}
              {selectedCall.notes && (
                <div>
                  <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Notes
                  </div>
                  <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <p className="text-sm text-gray-900 dark:text-white">
                      {selectedCall.notes}
                    </p>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end space-x-3 pt-6 border-t border-gray-200 dark:border-gray-700">
                <Button
                  variant="outline"
                  onClick={() => setSelectedCall(null)}
                >
                  Close
                </Button>

                {selectedCall.recordingUrl && (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => handlePlayRecording(selectedCall)}
                    >
                      <Play size={16} className="mr-2" />
                      Play Recording
                    </Button>

                    <Button
                      onClick={() => handleDownloadRecording(selectedCall)}
                    >
                      <Download size={16} className="mr-2" />
                      Download
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
};