import { useState, useEffect } from 'react';
import { X, Users, Clock, User, ArrowRight, AlertCircle } from 'lucide-react';
import type { AgentAvailability } from '../../types';
import { Button } from '../Button';
import { Input } from '../Input';
import { Select } from '../Select';
import { Modal } from '../Modal';
import { getAvailableAgents, transferCall } from '../../services/api';

interface CallTransferDialogProps {
  callId: string;
  onClose: () => void;
}

export const CallTransferDialog = ({ callId, onClose }: CallTransferDialogProps) => {
  const [agents, setAgents] = useState<AgentAvailability[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [transferNote, setTransferNote] = useState('');
  const [warmTransfer, setWarmTransfer] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAgents = async () => {
      try {
        const availableAgents = await getAvailableAgents('team-id-placeholder'); // Would get from context
        setAgents(availableAgents.filter(agent => agent.status === 'available'));
      } catch (error) {
        console.error('Error fetching agents:', error);
      }
    };

    fetchAgents();
  }, []);

  const handleTransfer = async () => {
    if (!selectedAgentId) {
      setError('Please select an agent');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await transferCall({
        callId,
        targetAgentId: selectedAgentId,
        note: transferNote,
        warmTransfer
      });

      alert('Transfer initiated successfully');
      onClose();
    } catch (error) {
      setError('Failed to transfer call. Please try again.');
      console.error('Error transferring call:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: AgentAvailability['status']) => {
    switch (status) {
      case 'available': return 'text-green-600 bg-green-50';
      case 'busy': return 'text-yellow-600 bg-yellow-50';
      case 'in-call': return 'text-red-600 bg-red-50';
      case 'offline': return 'text-gray-600 bg-gray-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getSkillBadgeColor = (skill: string) => {
    const colors = [
      'bg-blue-50 text-blue-700 border-blue-200',
      'bg-purple-50 text-purple-700 border-purple-200',
      'bg-green-50 text-green-700 border-green-200',
      'bg-orange-50 text-orange-700 border-orange-200',
      'bg-pink-50 text-pink-700 border-pink-200',
    ];
    const index = skill.length % colors.length;
    return colors[index];
  };

  return (
    <Modal isOpen={true} onClose={onClose} size="lg">
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <Users className="h-6 w-6 text-blue-500" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Transfer Call
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
          {/* Agent Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Select Agent
            </label>
            
            {agents.length === 0 ? (
              <div className="text-center py-8 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <User className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
                  No Available Agents
                </h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  All agents are currently busy or offline.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 max-h-64 overflow-y-auto">
                {agents.map((agent) => (
                  <div
                    key={agent.agentId}
                    className={`p-4 border rounded-lg cursor-pointer transition-all ${
                      selectedAgentId === agent.agentId
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                    }`}
                    onClick={() => setSelectedAgentId(agent.agentId)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="flex-shrink-0">
                          <div className="w-10 h-10 bg-gray-200 dark:bg-gray-600 rounded-full flex items-center justify-center">
                            <User className="h-5 w-5 text-gray-500" />
                          </div>
                        </div>
                        
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {agent.agentName}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {agent.currentCalls} active call{agent.currentCalls !== 1 ? 's' : ''}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(agent.status)}`}>
                          {agent.status}
                        </span>
                        
                        {agent.queuePosition && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            Queue: #{agent.queuePosition}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    {/* Skills */}
                    {agent.skillTags && agent.skillTags.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {agent.skillTags.slice(0, 3).map((skill) => (
                          <span
                            key={skill}
                            className={`px-2 py-1 text-xs rounded border ${getSkillBadgeColor(skill)}`}
                          >
                            {skill}
                          </span>
                        ))}
                        {agent.skillTags.length > 3 && (
                          <span className="px-2 py-1 text-xs text-gray-500 dark:text-gray-400">
                            +{agent.skillTags.length - 3} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Transfer Options */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Transfer Note (Optional)
              </label>
              <Input
                placeholder="Add context for the receiving agent..."
                value={transferNote}
                onChange={(e) => setTransferNote(e.target.value)}
                rows={3}
              />
            </div>

            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Transfer Type
              </label>
              
              <div className="space-y-3">
                <label className="flex items-center space-x-3">
                  <input
                    type="radio"
                    name="transferType"
                    value="warm"
                    checked={warmTransfer}
                    onChange={(e) => setWarmTransfer(e.target.value === 'warm')}
                    className="text-blue-600"
                  />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      Warm Transfer
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      Stay on the call while introducing the customer to the new agent
                    </div>
                  </div>
                </label>
                
                <label className="flex items-center space-x-3">
                  <input
                    type="radio"
                    name="transferType"
                    value="cold"
                    checked={!warmTransfer}
                    onChange={(e) => setWarmTransfer(e.target.value === 'warm')}
                    className="text-blue-600"
                  />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      Cold Transfer
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      Transfer directly to the new agent without staying on the call
                    </div>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="flex items-center space-x-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg">
              <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
              <span className="text-sm text-red-700 dark:text-red-300">{error}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end space-x-3 pt-6 border-t border-gray-200 dark:border-gray-700">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </Button>
            
            <Button
              onClick={handleTransfer}
              disabled={loading || !selectedAgentId}
              className="flex items-center space-x-2"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <ArrowRight size={16} />
              )}
              <span>Transfer Call</span>
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};