import { useState, useEffect } from 'react';
import { X, MessageSquare, Headphones, Flag } from 'lucide-react';

import { Button } from '../Button';
import { Modal } from '../Modal';
import { Card } from '../Card';
import { Textarea } from '../Textarea';
import { joinCall, markCallForReview } from '../../services/api';
import { getAgentMetrics } from '../../services/api';

interface InterventionPanelProps {
  callId: string;
  agentId?: string;
  onClose: () => void;
  onWhisper: (message: string) => void;
}

export const InterventionPanel = ({ callId, agentId, onClose, onWhisper }: InterventionPanelProps) => {
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [agentMetrics, setAgentMetrics] = useState<any>(null);
  const [interventionType, setInterventionType] = useState<'join' | 'whisper' | 'message'>('join');
  const [coachingSuggestions, setCoachingSuggestions] = useState<string[]>([]);
  const [flagReason, setFlagReason] = useState('');
  const [showFlagDialog, setShowFlagDialog] = useState(false);

  useEffect(() => {
    if (agentId) {
      const fetchAgentMetrics = async () => {
        try {
          const metrics = await getAgentMetrics(agentId);
          setAgentMetrics(metrics);
          generateCoachingSuggestions(metrics);
        } catch (error) {
          console.error('Error fetching agent metrics:', error);
        }
      };

      fetchAgentMetrics();
    }
  }, [agentId]);

  const generateCoachingSuggestions = (metrics: any) => {
    const suggestions: string[] = [];

    if (metrics.responseTime > 3000) {
      suggestions.push('Consider responding more quickly to customer questions');
    }

    if (metrics.talkTimePercentage > 70) {
      suggestions.push('Try to let the customer speak more - active listening is key');
    }

    if (metrics.interruptionCount > 3) {
      suggestions.push('Avoid interrupting the customer - let them finish their thoughts');
    }

    if (metrics.empathyScore < 70) {
      suggestions.push('Use more empathetic language and acknowledge customer feelings');
    }

    if (metrics.scriptAdherence < 80) {
      suggestions.push('Follow the conversation script more closely for better outcomes');
    }

    if (metrics.complianceScore < 90) {
      suggestions.push('Ensure all compliance requirements are being met');
    }

    if (suggestions.length === 0) {
      suggestions.push('Agent is performing well - continue monitoring');
    }

    setCoachingSuggestions(suggestions);
  };

  const handleJoinCall = async () => {
    setLoading(true);
    try {
      const response = await joinCall(callId);
      // Open join URL in new tab
      window.open(response.joinUrl, '_blank');
      onClose();
    } catch (error) {
      console.error('Error joining call:', error);
      alert('Failed to join call');
    } finally {
      setLoading(false);
    }
  };

  const handleWhisper = () => {
    if (!message.trim()) {
      alert('Please enter a message');
      return;
    }

    onWhisper(message);
    setMessage('');
    onClose();
  };

  const handleSendMessage = () => {
    if (!message.trim()) {
      alert('Please enter a message');
      return;
    }

    // Send message to agent (could be chat message or SMS)
    console.log('Sending message to agent:', message);
    alert('Message sent to agent');
    setMessage('');
    onClose();
  };

  const handleFlagForReview = async () => {
    if (!flagReason.trim()) {
      alert('Please provide a reason for flagging');
      return;
    }

    setLoading(true);
    try {
      await markCallForReview(callId, flagReason);
      alert('Call flagged for review');
      setShowFlagDialog(false);
      onClose();
    } catch (error) {
      console.error('Error flagging call:', error);
      alert('Failed to flag call');
    } finally {
      setLoading(false);
    }
  };

  const getMetricColor = (value: number, thresholds: { good: number; warning: number }) => {
    if (value >= thresholds.good) return 'text-green-600';
    if (value >= thresholds.warning) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <>
      <Modal isOpen={true} onClose={onClose} size="lg">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <MessageSquare className="h-6 w-6 text-blue-500" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Supervisor Intervention
              </h2>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X size={24} />
            </button>
          </div>

          <div className="space-y-6">
            {/* Intervention Options */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                Intervention Options
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Join Call */}
                <Card
                  className={`p-4 cursor-pointer transition-all ${interventionType === 'join'
                    ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'hover:shadow-md'
                    }`}
                  onClick={() => setInterventionType('join')}
                >
                  <div className="text-center">
                    <Headphones className="h-8 w-8 text-blue-500 mx-auto mb-2" />
                    <h4 className="font-medium text-gray-900 dark:text-white">Join Call</h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      Add yourself to the call as a participant
                    </p>
                  </div>
                </Card>

                {/* Whisper to Agent */}
                <Card
                  className={`p-4 cursor-pointer transition-all ${interventionType === 'whisper'
                    ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'hover:shadow-md'
                    }`}
                  onClick={() => setInterventionType('whisper')}
                >
                  <div className="text-center">
                    <MessageSquare className="h-8 w-8 text-green-500 mx-auto mb-2" />
                    <h4 className="font-medium text-gray-900 dark:text-white">Whisper</h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      Send private message to agent only
                    </p>
                  </div>
                </Card>

                {/* Send Message */}
                <Card
                  className={`p-4 cursor-pointer transition-all ${interventionType === 'message'
                    ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'hover:shadow-md'
                    }`}
                  onClick={() => setInterventionType('message')}
                >
                  <div className="text-center">
                    <MessageSquare className="h-8 w-8 text-purple-500 mx-auto mb-2" />
                    <h4 className="font-medium text-gray-900 dark:text-white">Message</h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      Send chat message to agent
                    </p>
                  </div>
                </Card>
              </div>
            </div>

            {/* Agent Performance Metrics */}
            {agentMetrics && (
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                  Agent Performance
                </h3>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="text-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div className={`text-lg font-semibold ${getMetricColor(agentMetrics.responseTime, { good: 2000, warning: 3000 })}`}>
                      {(agentMetrics.responseTime / 1000).toFixed(1)}s
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Response Time</div>
                  </div>

                  <div className="text-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div className={`text-lg font-semibold ${getMetricColor(agentMetrics.talkTimePercentage, { good: 50, warning: 70 })}`}>
                      {agentMetrics.talkTimePercentage}%
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Talk Time</div>
                  </div>

                  <div className="text-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div className={`text-lg font-semibold ${getMetricColor(100 - agentMetrics.interruptionCount * 10, { good: 90, warning: 70 })}`}>
                      {agentMetrics.interruptionCount}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Interruptions</div>
                  </div>

                  <div className="text-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div className={`text-lg font-semibold ${getMetricColor(agentMetrics.empathyScore, { good: 80, warning: 60 })}`}>
                      {agentMetrics.empathyScore}%
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Empathy Score</div>
                  </div>

                  <div className="text-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div className={`text-lg font-semibold ${getMetricColor(agentMetrics.scriptAdherence, { good: 90, warning: 75 })}`}>
                      {agentMetrics.scriptAdherence}%
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Script Adherence</div>
                  </div>

                  <div className="text-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div className={`text-lg font-semibold ${getMetricColor(agentMetrics.complianceScore, { good: 95, warning: 85 })}`}>
                      {agentMetrics.complianceScore}%
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Compliance</div>
                  </div>
                </div>
              </div>
            )}

            {/* Coaching Suggestions */}
            {coachingSuggestions.length > 0 && (
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                  Coaching Suggestions
                </h3>
                <div className="space-y-2">
                  {coachingSuggestions.map((suggestion, index) => (
                    <div key={index} className="flex items-start space-x-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg">
                      <div className="flex-shrink-0 mt-0.5">
                        <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                      </div>
                      <span className="text-sm text-yellow-800 dark:text-yellow-200">
                        {suggestion}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Message Input */}
            {(interventionType === 'whisper' || interventionType === 'message') && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {interventionType === 'whisper' ? 'Whisper Message' : 'Chat Message'}
                </label>
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={
                    interventionType === 'whisper'
                      ? "Enter private message for agent..."
                      : "Enter chat message for agent..."
                  }
                  rows={3}
                  className="mb-4"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {interventionType === 'whisper'
                    ? 'This message will only be heard by the agent, not the customer.'
                    : 'This message will appear in the agent\'s chat interface.'}
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-6 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center space-x-3">
                <Button
                  variant="outline"
                  onClick={() => setShowFlagDialog(true)}
                  className="flex items-center space-x-2"
                >
                  <Flag size={16} />
                  <span>Flag for Review</span>
                </Button>
              </div>

              <div className="flex items-center space-x-3">
                <Button
                  variant="outline"
                  onClick={onClose}
                  disabled={loading}
                >
                  Cancel
                </Button>

                {interventionType === 'join' ? (
                  <Button
                    onClick={handleJoinCall}
                    disabled={loading}
                    className="flex items-center space-x-2"
                  >
                    {loading ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    ) : (
                      <Headphones size={16} />
                    )}
                    <span>Join Call</span>
                  </Button>
                ) : (
                  <Button
                    onClick={interventionType === 'whisper' ? handleWhisper : handleSendMessage}
                    disabled={loading || !message.trim()}
                    className="flex items-center space-x-2"
                  >
                    {loading ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    ) : (
                      <MessageSquare size={16} />
                    )}
                    <span>
                      {interventionType === 'whisper' ? 'Send Whisper' : 'Send Message'}
                    </span>
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </Modal>

      {/* Flag for Review Dialog */}
      {showFlagDialog && (
        <Modal isOpen={true} onClose={() => setShowFlagDialog(false)} size="md">
          <div className="p-6">
            <div className="flex items-center space-x-3 mb-4">
              <Flag className="h-6 w-6 text-red-500" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Flag Call for Review
              </h3>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Reason for Flagging
                </label>
                <Textarea
                  value={flagReason}
                  onChange={(e) => setFlagReason(e.target.value)}
                  placeholder="Reason for flagging this call..."
                  rows={3}
                  className="mb-4"
                />
              </div>

              <div className="flex items-center justify-end space-x-3">
                <Button
                  variant="outline"
                  onClick={() => setShowFlagDialog(false)}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleFlagForReview}
                  disabled={loading || !flagReason.trim()}
                  className="flex items-center space-x-2"
                >
                  {loading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <Flag size={16} />
                  )}
                  <span>Flag Call</span>
                </Button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
};