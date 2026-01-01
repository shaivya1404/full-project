import { Users, UserPlus, Shield } from 'lucide-react';
import type { Agent } from '../../types';
import { Button } from '../Button';

type AgentTeamPanelProps = {
  agent: Agent;
};

export const AgentTeamPanel = ({ agent }: AgentTeamPanelProps) => {
  const teamMembers = [
    { id: '1', name: 'Alice Smith', role: 'Supervisor', online: true },
    { id: '2', name: 'Bob Johnson', role: 'Agent', online: true },
    { id: '3', name: 'Charlie Brown', role: 'Agent', online: false },
  ];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
          <Users size={20} className="mr-2 text-primary" />
          Team & Hierarchy
        </h3>
        <Button size="sm" variant="secondary">
          Change Team
        </Button>
      </div>

      <div className="p-6">
        <div className="mb-6">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Current Team</p>
          <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
            <h4 className="font-bold text-primary text-lg">{agent.department || 'General Support'}</h4>
            <p className="text-sm text-primary/70 mt-1">Managed by Sarah Williams</p>
          </div>
        </div>

        <div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">Team Members</p>
          <div className="space-y-3">
            {teamMembers.map((member) => (
              <div key={member.id} className="flex items-center justify-between p-2 hover:bg-gray-50 dark:hover:bg-gray-900/50 rounded-lg transition-colors">
                <div className="flex items-center">
                  <div className="relative">
                    <div className="h-8 w-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xs font-bold">
                      {member.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    {member.online && (
                      <div className="absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 bg-green-500 border-2 border-white dark:border-gray-800 rounded-full"></div>
                    )}
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{member.name}</p>
                    <p className="text-xs text-gray-500">{member.role}</p>
                  </div>
                </div>
                {member.role === 'Supervisor' && <Shield size={14} className="text-primary" />}
              </div>
            ))}
          </div>
        </div>

        <Button variant="secondary" className="w-full mt-6">
          <UserPlus size={16} className="mr-2" /> Invite to Team
        </Button>
      </div>
    </div>
  );
};
