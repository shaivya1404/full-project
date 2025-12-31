import { useState } from 'react';
import { DashboardLayout } from '../components/DashboardLayout';
import { AgentsTable } from '../components/agents/AgentsTable';
import { AgentFiltersPanel } from '../components/agents/AgentFiltersPanel';
import { AddAgentModal } from '../components/agents/AddAgentModal';
import { EditAgentModal } from '../components/agents/EditAgentModal';
import { useAgents, useCreateAgent, useUpdateAgent, useDeleteAgent, useUpdateAgentStatus } from '../api/agents';
import { Users, UserPlus, Download, RefreshCw } from 'lucide-react';
import { Button } from '../components/Button';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';
import type { Agent } from '../types';

export const AgentsPage = () => {
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({
    status: '',
    role: '',
    department: '',
  });

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);

  // Get current user's team ID (mocked for now or from store)
  const user = useAuthStore((state) => state.user);
  const teamId = 'team-123'; // In a real app, this would come from user profile

  const { data, isLoading, isError, refetch } = useAgents(teamId, limit, (page - 1) * limit, {
    search,
    status: filters.status,
    role: filters.role,
  });

  const createAgentMutation = useCreateAgent();
  const updateAgentMutation = useUpdateAgent();
  const deleteAgentMutation = useDeleteAgent();
  const updateStatusMutation = useUpdateAgentStatus();

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleFilterChange = (name: string, value: string) => {
    setFilters((prev) => ({ ...prev, [name]: value }));
    setPage(1);
  };

  const handleResetFilters = () => {
    setSearch('');
    setFilters({ status: '', role: '', department: '' });
    setPage(1);
  };

  const handleAddAgent = async (data: Partial<Agent>) => {
    try {
      await createAgentMutation.mutateAsync({ teamId, data });
      toast.success('Agent created successfully');
      setIsAddModalOpen(false);
    } catch (error) {
      toast.error('Failed to create agent');
    }
  };

  const handleUpdateAgent = async (id: string, data: Partial<Agent>) => {
    try {
      await updateAgentMutation.mutateAsync({ id, data });
      toast.success('Agent updated successfully');
      setEditingAgent(null);
    } catch (error) {
      toast.error('Failed to update agent');
    }
  };

  const handleDeleteAgent = async (agent: Agent) => {
    if (window.confirm(`Are you sure you want to terminate ${agent.firstName} ${agent.lastName}?`)) {
      try {
        await deleteAgentMutation.mutateAsync(agent.id);
        toast.success('Agent terminated successfully');
      } catch (error) {
        toast.error('Failed to terminate agent');
      }
    }
  };

  const handleStatusChange = async (agent: Agent, status: Agent['status']) => {
    try {
      await updateStatusMutation.mutateAsync({ agentId: agent.id, status });
      toast.success(`Agent status changed to ${status}`);
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  return (
    <DashboardLayout title="Agent Management">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Agents</h1>
          <p className="text-gray-500 dark:text-gray-400">Manage your team's profiles, availability, and performance.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => refetch()}>
            <RefreshCw size={18} className="mr-2" /> Refresh
          </Button>
          <Button variant="secondary">
            <Download size={18} className="mr-2" /> Export
          </Button>
          <Button variant="primary" onClick={() => setIsAddModalOpen(true)}>
            <UserPlus size={18} className="mr-2" /> Add Agent
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
              <Users size={20} />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Total Agents</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{data?.total || 0}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-lg">
              <div className="h-2.5 w-2.5 rounded-full bg-green-500 animate-pulse"></div>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Online Now</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">12</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 rounded-lg">
              <RefreshCw size={20} />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">On Calls</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">8</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-lg">
              <Users size={20} />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Avg. CSAT</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">4.8</p>
            </div>
          </div>
        </div>
      </div>

      <AgentFiltersPanel
        search={search}
        onSearchChange={handleSearchChange}
        filters={filters}
        onFilterChange={handleFilterChange}
        onReset={handleResetFilters}
      />

      <AgentsTable
        agents={data?.data || []}
        loading={isLoading}
        page={page}
        limit={limit}
        total={data?.total || 0}
        onPageChange={setPage}
        onEdit={setEditingAgent}
        onDelete={handleDeleteAgent}
        onStatusChange={handleStatusChange}
      />

      <AddAgentModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAdd={handleAddAgent}
        loading={createAgentMutation.isPending}
      />

      <EditAgentModal
        isOpen={!!editingAgent}
        onClose={() => setEditingAgent(null)}
        agent={editingAgent}
        onUpdate={handleUpdateAgent}
        loading={updateAgentMutation.isPending}
      />
    </DashboardLayout>
  );
};
