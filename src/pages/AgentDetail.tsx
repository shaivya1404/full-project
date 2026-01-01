import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../components/DashboardLayout';
import {
  Mail,
  Phone,
  Calendar,
  ChevronLeft,
  Award,
  ShieldCheck,
  Settings
} from 'lucide-react';
import { Button } from '../components/Button';
import { Badge } from '../components/Badge';
import { useAgent, useAgentStatus, useUpdateAgentStatus, useAgentSkills, useAgentSchedule, useAgentPerformance, useAgentActivityLog, useAgentQueue, useAddAgentSkill } from '../api/agents';
import { AgentAvailabilityWidget } from '../components/agents/AgentAvailabilityWidget';
import { AgentSkillsPanel } from '../components/agents/AgentSkillsPanel';
import { AgentPerformanceCard } from '../components/agents/AgentPerformanceCard';
import { AgentSchedulePanel } from '../components/agents/AgentSchedulePanel';
import { AgentQueuePanel } from '../components/agents/AgentQueuePanel';
import { AgentActivityLog } from '../components/agents/AgentActivityLog';
import { AgentTeamPanel } from '../components/agents/AgentTeamPanel';
import { AgentCertificationsPanel } from '../components/agents/AgentCertificationsPanel';
import { AgentQualityScores } from '../components/agents/AgentQualityScores';
import toast from 'react-hot-toast';

export const AgentDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'overview' | 'skills' | 'schedule' | 'activity' | 'team'>('overview');

  const { data: agent, isLoading: isAgentLoading } = useAgent(id);
  useAgentStatus(id!);
  const { data: skills } = useAgentSkills(id!);
  const { data: schedule } = useAgentSchedule(id!);
  const { data: performance, isLoading: isPerfLoading } = useAgentPerformance(id!);
  const { data: activityLog } = useAgentActivityLog(id!);
  const { data: queue } = useAgentQueue(id!);

  const updateStatusMutation = useUpdateAgentStatus();
  const addSkillMutation = useAddAgentSkill();

  const handleStatusChange = async (newStatus: any) => {
    try {
      await updateStatusMutation.mutateAsync({ agentId: id!, status: newStatus });
      toast.success(`Status updated to ${newStatus}`);
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const handleAddSkill = async (skillData: any) => {
    try {
      await addSkillMutation.mutateAsync({ agentId: id!, skillData });
      toast.success('Skill added successfully');
    } catch (error) {
      toast.error('Failed to add skill');
    }
  };

  if (isAgentLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  if (!agent) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-gray-500">Agent not found.</p>
          <Button onClick={() => navigate('/dashboard/agents')} className="mt-4">
            Back to Agents
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mb-6">
        <button
          onClick={() => navigate('/dashboard/agents')}
          className="flex items-center text-sm text-gray-500 hover:text-primary transition-colors"
        >
          <ChevronLeft size={16} className="mr-1" /> Back to Agents
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Profile Summary */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex flex-col items-center text-center">
              <div className="h-24 w-24 rounded-full bg-primary/10 flex items-center justify-center text-primary text-3xl font-bold mb-4">
                {agent.firstName[0]}{agent.lastName[0]}
              </div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">{agent.firstName} {agent.lastName}</h2>
              <p className="text-gray-500 dark:text-gray-400 capitalize">{agent.role.replace('_', ' ')}</p>

              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <Badge variant={agent.status === 'online' ? 'success' : 'neutral'}>
                  {agent.status.charAt(0).toUpperCase() + agent.status.slice(1)}
                </Badge>
                <Badge variant="primary">{agent.department || 'No Department'}</Badge>
              </div>
            </div>

            <div className="mt-8 space-y-4">
              <div className="flex items-center text-sm">
                <Mail size={16} className="text-gray-400 mr-3" />
                <span className="text-gray-600 dark:text-gray-300">{agent.email}</span>
              </div>
              <div className="flex items-center text-sm">
                <Phone size={16} className="text-gray-400 mr-3" />
                <span className="text-gray-600 dark:text-gray-300">{agent.phone || 'N/A'}</span>
              </div>
              <div className="flex items-center text-sm">
                <ShieldCheck size={16} className="text-gray-400 mr-3" />
                <span className="text-gray-600 dark:text-gray-300">ID: {agent.employeeId || 'N/A'}</span>
              </div>
              <div className="flex items-center text-sm">
                <Calendar size={16} className="text-gray-400 mr-3" />
                <span className="text-gray-600 dark:text-gray-300">Hired: {agent.hireDate ? new Date(agent.hireDate).toLocaleDateString() : 'N/A'}</span>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-700">
              <Button variant="secondary" className="w-full justify-center">
                <Settings size={16} className="mr-2" /> Edit Profile
              </Button>
            </div>
          </div>

          <AgentAvailabilityWidget
            agent={agent}
            onStatusChange={handleStatusChange}
            loading={updateStatusMutation.isPending}
          />

          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
              <Award size={18} className="mr-2 text-primary" /> Certifications
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-2 rounded bg-gray-50 dark:bg-gray-900/50">
                <span className="text-sm font-medium">Advanced Support</span>
                <Badge variant="success">Active</Badge>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-gray-50 dark:bg-gray-900/50">
                <span className="text-sm font-medium">Compliance 2024</span>
                <Badge variant="success">Active</Badge>
              </div>
            </div>
            <Button variant="secondary" size="sm" className="w-full mt-4">View All</Button>
          </div>
        </div>

        {/* Right Column - Main Content Tabs */}
        <div className="lg:col-span-2 space-y-6">
          {/* Tabs */}
          <div className="flex border-b border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'overview'
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('skills')}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'skills'
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
            >
              Skills & Training
            </button>
            <button
              onClick={() => setActiveTab('schedule')}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'schedule'
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
            >
              Schedule
            </button>
            <button
              onClick={() => setActiveTab('activity')}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'activity'
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
            >
              Activity Log
            </button>
            <button
              onClick={() => setActiveTab('team')}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'team'
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
            >
              Team
            </button>
          </div>

          {activeTab === 'overview' && (
            <div className="space-y-6">
              <AgentPerformanceCard
                performance={performance ? performance[0] : null}
                loading={isPerfLoading}
              />
              <AgentQualityScores data={[]} />
              <AgentQueuePanel
                queue={queue || []}
                onAccept={(id) => toast.success(`Accepted call ${id}`)}
                onDecline={(id) => toast.success(`Declined call ${id}`)}
              />
            </div>
          )}

          {activeTab === 'skills' && (
            <div className="space-y-6">
              <AgentSkillsPanel
                agentId={agent.id}
                skills={skills || []}
                onAddSkill={handleAddSkill}
                onRemoveSkill={() => toast.success('Skill removed')}
                onUpdateSkill={() => toast.success('Skill updated')}
              />
              <AgentCertificationsPanel
                certifications={[]}
                onRemove={() => { }}
              />
            </div>
          )}

          {activeTab === 'schedule' && (
            <AgentSchedulePanel
              schedule={schedule || []}
              onRemoveShift={() => toast.success('Shift removed')}
            />
          )}

          {activeTab === 'activity' && (
            <AgentActivityLog
              activities={activityLog || []}
            />
          )}

          {activeTab === 'team' && (
            <AgentTeamPanel
              agent={agent}
            />
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};
