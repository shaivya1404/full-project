import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Filter } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

import { 
  CampaignsTable, 
  CreateCampaignModal 
} from '../components/campaigns';
import { Button, Input, Select, DashboardLayout } from '../components';
import { 
  getCampaigns, 
  createCampaign, 
  deleteCampaign, 
  pauseCampaign, 
  resumeCampaign 
} from '../services/api';
import { useAuthStore } from '../store/authStore';
import type { Campaign } from '../types';

export const CampaignsPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const teamId = 'team-1'; // In a real app, get this from auth or context

  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Queries
  const { data, isLoading } = useQuery({
    queryKey: ['campaigns', teamId, page, limit, search, typeFilter, statusFilter],
    queryFn: () => getCampaigns(teamId, limit, (page - 1) * limit, { 
      search, 
      type: typeFilter || undefined, 
      status: statusFilter || undefined 
    }),
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: Partial<Campaign>) => createCampaign(teamId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      setIsCreateModalOpen(false);
      toast.success('Campaign created successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create campaign');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteCampaign(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      toast.success('Campaign deleted successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete campaign');
    },
  });

  const pauseResumeMutation = useMutation({
    mutationFn: (campaign: Campaign) => 
      campaign.status === 'active' ? pauseCampaign(campaign.id) : resumeCampaign(campaign.id),
    onSuccess: (_, campaign) => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      toast.success(`Campaign ${campaign.status === 'active' ? 'paused' : 'resumed'} successfully`);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Operation failed');
    },
  });

  const handleEdit = (campaign: Campaign) => {
    navigate(`/dashboard/campaigns/${campaign.id}`);
  };

  const handleViewDetails = (campaign: Campaign) => {
    navigate(`/dashboard/campaigns/${campaign.id}`);
  };

  const handleDelete = (campaign: Campaign) => {
    if (confirm(`Are you sure you want to delete the campaign "${campaign.name}"?`)) {
      deleteMutation.mutate(campaign.id);
    }
  };

  const handlePauseResume = (campaign: Campaign) => {
    pauseResumeMutation.mutate(campaign);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Campaign Management</h1>
            <p className="text-gray-500 dark:text-gray-400">Create and monitor calling campaigns</p>
          </div>
          <Button variant="primary" onClick={() => setIsCreateModalOpen(true)}>
            <Plus size={18} className="mr-2" />
            Create Campaign
          </Button>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <Input
              placeholder="Search campaigns..."
              className="pl-10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <div className="w-40">
              <Select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                options={[
                  { value: '', label: 'All Types' },
                  { value: 'inbound', label: 'Inbound' },
                  { value: 'outbound', label: 'Outbound' },
                ]}
              />
            </div>
            <div className="w-40">
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                options={[
                  { value: '', label: 'All Status' },
                  { value: 'active', label: 'Active' },
                  { value: 'paused', label: 'Paused' },
                  { value: 'completed', label: 'Completed' },
                  { value: 'draft', label: 'Draft' },
                ]}
              />
            </div>
          </div>
        </div>

        <CampaignsTable
          campaigns={data?.data || []}
          loading={isLoading}
          page={page}
          limit={limit}
          total={data?.total || 0}
          onPageChange={setPage}
          onEdit={handleEdit}
          onViewDetails={handleViewDetails}
          onDelete={handleDelete}
          onPauseResume={handlePauseResume}
        />

        <CreateCampaignModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onCreate={(data) => createMutation.mutate(data)}
          loading={createMutation.isPending}
        />
      </div>
    </DashboardLayout>
  );
};
