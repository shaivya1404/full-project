import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  ArrowLeft, 
  BarChart2, 
  Users, 
  Settings, 
  Calendar, 
  MessageSquare,
  Play,
  Pause,
  RefreshCw
} from 'lucide-react';
import { toast } from 'react-hot-toast';

import { 
  getCampaignById, 
  updateCampaign, 
  getCampaignAnalytics,
  getCampaignCallTrends,
  getCampaignContactStatus,
  getContacts,
  updateContact,
  deleteContact,
  bulkUpdateContacts,
  bulkDeleteContacts,
  uploadContactList,
  pauseCampaign,
  resumeCampaign
} from '../services/api';
import { 
  CampaignAnalytics, 
  ContactManagement, 
  CampaignConfiguration, 
  CampaignScheduler, 
  PromptEditor,
  ContactListUpload
} from '../components/campaigns';
import { Button, Badge, DashboardLayout } from '../components';
import type { Campaign, CampaignContact } from '../types';

type TabType = 'analytics' | 'contacts' | 'config' | 'scheduler' | 'prompt';

export const CampaignDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabType>('analytics');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  // Queries
  const { data: campaign, isLoading: isLoadingCampaign } = useQuery({
    queryKey: ['campaign', id],
    queryFn: () => getCampaignById(id!),
    enabled: !!id,
  });

  const { data: analytics, isLoading: isLoadingAnalytics } = useQuery({
    queryKey: ['campaign-analytics', id],
    queryFn: () => getCampaignAnalytics(id!),
    enabled: !!id && activeTab === 'analytics',
  });

  const { data: trends } = useQuery({
    queryKey: ['campaign-trends', id],
    queryFn: () => getCampaignCallTrends(id!),
    enabled: !!id && activeTab === 'analytics',
  });

  const { data: contactStatuses } = useQuery({
    queryKey: ['campaign-contact-status', id],
    queryFn: () => getCampaignContactStatus(id!),
    enabled: !!id && activeTab === 'analytics',
  });

  const { data: contactsData, isLoading: isLoadingContacts } = useQuery({
    queryKey: ['campaign-contacts', id],
    queryFn: () => getContacts(id!, 100, 0), // Simplification: get first 100
    enabled: !!id && activeTab === 'contacts',
  });

  // Mutations
  const updateMutation = useMutation({
    mutationFn: (data: Partial<Campaign>) => updateCampaign(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign', id] });
      toast.success('Campaign updated successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update campaign');
    },
  });

  const pauseResumeMutation = useMutation({
    mutationFn: () => 
      campaign?.status === 'active' ? pauseCampaign(id!) : resumeCampaign(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign', id] });
      toast.success(`Campaign ${campaign?.status === 'active' ? 'paused' : 'resumed'} successfully`);
    },
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadContactList(id!, file),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['campaign-contacts', id] });
      queryClient.invalidateQueries({ queryKey: ['campaign', id] });
      setIsUploadModalOpen(false);
      toast.success(`Successfully imported ${data.imported} contacts`);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to upload contacts');
    },
  });

  const updateContactMutation = useMutation({
    mutationFn: ({ contactId, data }: { contactId: string; data: Partial<CampaignContact> }) => 
      updateContact(contactId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign-contacts', id] });
      toast.success('Contact updated');
    },
  });

  const deleteContactMutation = useMutation({
    mutationFn: (contactId: string) => deleteContact(contactId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign-contacts', id] });
      toast.success('Contact deleted');
    },
  });

  if (isLoadingCampaign) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Campaign not found</h2>
        <Button variant="ghost" className="mt-4" onClick={() => navigate('/dashboard/campaigns')}>
          <ArrowLeft size={18} className="mr-2" />
          Back to Campaigns
        </Button>
      </div>
    );
  }

  const tabs: { id: TabType; label: string; icon: any }[] = [
    { id: 'analytics', label: 'Analytics', icon: BarChart2 },
    { id: 'contacts', label: 'Contacts', icon: Users },
    { id: 'config', label: 'Configuration', icon: Settings },
    { id: 'scheduler', label: 'Scheduler', icon: Calendar },
    { id: 'prompt', label: 'AI Prompt', icon: MessageSquare },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('/dashboard/campaigns')}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              <ArrowLeft size={20} className="text-gray-500" />
            </button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{campaign.name}</h1>
                <Badge variant={campaign.status === 'active' ? 'success' : campaign.status === 'paused' ? 'warning' : 'default'}>
                  {campaign.status}
                </Badge>
                <Badge variant="info">{campaign.type}</Badge>
              </div>
              <p className="text-gray-500 dark:text-gray-400 mt-1">{campaign.description || 'No description provided'}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button 
              variant={campaign.status === 'active' ? 'ghost' : 'primary'} 
              onClick={() => pauseResumeMutation.mutate()}
              isLoading={pauseResumeMutation.isPending}
            >
              {campaign.status === 'active' ? (
                <><Pause size={18} className="mr-2" /> Pause</>
              ) : (
                <><Play size={18} className="mr-2" /> Resume</>
              )}
            </Button>
            <Button variant="ghost" onClick={() => queryClient.invalidateQueries({ queryKey: ['campaign', id] })}>
              <RefreshCw size={18} />
            </Button>
          </div>
        </div>

        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="flex gap-8">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 py-4 border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                <tab.icon size={18} />
                <span className="font-medium">{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="pb-12">
          {activeTab === 'analytics' && analytics && (
            <CampaignAnalytics 
              analytics={analytics} 
              callTrends={trends || []}
              contactStatus={contactStatuses || []}
              onExport={(format) => toast.success(`Exporting as ${format}...`)}
              loading={isLoadingAnalytics}
            />
          )}

          {activeTab === 'contacts' && (
            <ContactManagement 
              contacts={contactsData?.data || []}
              loading={isLoadingContacts}
              onUpdate={(contactId, data) => updateContactMutation.mutate({ contactId, data })}
              onDelete={(contactId) => deleteContactMutation.mutate(contactId)}
              onBulkUpdate={(ids, data) => bulkUpdateContacts(id!, ids, data)}
              onBulkDelete={(ids) => bulkDeleteContacts(id!, ids)}
              onAddContact={() => setIsUploadModalOpen(true)}
            />
          )}

          {activeTab === 'config' && (
            <CampaignConfiguration 
              campaign={campaign} 
              onUpdate={(data) => updateMutation.mutate(data)}
              loading={updateMutation.isPending}
            />
          )}

          {activeTab === 'scheduler' && (
            <CampaignScheduler 
              campaign={campaign} 
              onStartManual={() => toast.success('Campaign manually triggered')}
            />
          )}

          {activeTab === 'prompt' && (
            <PromptEditor 
              initialPrompt={campaign.prompt}
              onSave={(prompt) => updateMutation.mutate({ prompt })}
              loading={updateMutation.isPending}
            />
          )}
        </div>

        <ContactListUpload 
          isOpen={isUploadModalOpen}
          onClose={() => setIsUploadModalOpen(false)}
          onImport={(file) => uploadMutation.mutate(file)}
          loading={uploadMutation.isPending}
        />
      </div>
    </DashboardLayout>
  );
};
