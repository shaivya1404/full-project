import { MoreVertical, User, Edit, PhoneOff, Trash2, Shield, MessageSquare, Briefcase } from 'lucide-react';
import { useState } from 'react';
import type { Agent } from '../../types';

type AgentManagementMenuProps = {
  agent: Agent;
  onEdit: (agent: Agent) => void;
  onDelete: (agent: Agent) => void;
  onStatusChange: (agent: Agent, status: Agent['status']) => void;
};

export const AgentManagementMenu = ({ agent, onEdit, onDelete, onStatusChange }: AgentManagementMenuProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const actions = [
    { label: 'View Profile', icon: User, onClick: () => {} },
    { label: 'Edit Profile', icon: Edit, onClick: () => onEdit(agent) },
    { label: 'Manage Skills', icon: Briefcase, onClick: () => {} },
    { label: 'Send Message', icon: MessageSquare, onClick: () => {} },
    { label: 'Assign Team', icon: Shield, onClick: () => {} },
    { label: 'Set Offline', icon: PhoneOff, onClick: () => onStatusChange(agent, 'offline'), danger: true },
    { label: 'Terminate', icon: Trash2, onClick: () => onDelete(agent), danger: true },
  ];

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
      >
        <MoreVertical size={18} />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)}></div>
          <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-20 overflow-hidden">
            <div className="py-1">
              {actions.map((action, index) => (
                <button
                  key={index}
                  onClick={() => {
                    action.onClick();
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center px-4 py-2.5 text-left text-sm transition-colors ${
                    action.danger
                      ? 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <action.icon size={16} className="mr-3" />
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
