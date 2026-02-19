import { useState } from 'react';
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
  RefreshCw,
  X,
  Plus,
  Trash2,
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
  addContacts,
  bulkUpdateContacts,
  bulkDeleteContacts,
  uploadContactList,
  pauseCampaign,
  resumeCampaign,
  startCampaign
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
  const [isAddContactOpen, setIsAddContactOpen] = useState(false);
  const [newContacts, setNewContacts] = useState([{ name: '', phone: '', email: '' }]);

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

  const startCampaignMutation = useMutation({
    mutationFn: () => startCampaign(id!),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['campaign', id] });
      toast.success(`Campaign started — ${data.callsMade} call(s) initiated`);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to start campaign');
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

  const addContactsMutation = useMutation({
    mutationFn: (contacts: Array<{ name: string; phone: string; email?: string }>) =>
      addContacts(id!, contacts),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['campaign-contacts', id] });
      setIsAddContactOpen(false);
      setNewContacts([{ name: '', phone: '', email: '' }]);
      toast.success(`Added ${data.data?.added ?? 0} contact(s) successfully`);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to add contacts');
    },
  });

  const handleAddContactsSubmit = () => {
    const valid = newContacts.filter(c => c.name.trim() && c.phone.trim());
    if (valid.length === 0) {
      toast.error('Please enter at least one contact with name and phone');
      return;
    }
    addContactsMutation.mutate(valid.map(c => ({
      name: c.name.trim(),
      phone: c.phone.trim(),
      email: c.email.trim() || undefined,
    })));
  };

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
                className={`flex items - center gap - 2 py - 4 border - b - 2 transition - colors ${activeTab === tab.id
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  } `}
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
            <>
              <div className="flex justify-end gap-2 mb-4">
                <Button variant="ghost" size="sm" onClick={() => setIsUploadModalOpen(true)}>
                  Import CSV
                </Button>
                <Button variant="primary" size="sm" onClick={() => setIsAddContactOpen(true)}>
                  <Plus size={16} className="mr-1" /> Add Contact
                </Button>
              </div>
              <ContactManagement
                contacts={contactsData?.data || []}
                loading={isLoadingContacts}
                onUpdate={(contactId, data) => updateContactMutation.mutate({ contactId, data })}
                onDelete={(contactId) => deleteContactMutation.mutate(contactId)}
                onBulkUpdate={(ids, data) => bulkUpdateContacts(id!, ids, data)}
                onBulkDelete={(ids) => bulkDeleteContacts(id!, ids)}
              />
            </>
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
              onStartManual={() => startCampaignMutation.mutate()}
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

        {/* Add Contact Modal */}
        {isAddContactOpen && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg">
              <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Add Contacts</h2>
                <button onClick={() => { setIsAddContactOpen(false); setNewContacts([{ name: '', phone: '', email: '' }]); }}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                  <X size={20} />
                </button>
              </div>
              <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
                {newContacts.map((contact, idx) => (
                  <div key={idx} className="flex gap-2 items-start">
                    <div className="flex-1 grid grid-cols-3 gap-2">
                      <input
                        placeholder="Name *"
                        value={contact.name}
                        onChange={e => setNewContacts(prev => prev.map((c, i) => i === idx ? { ...c, name: e.target.value } : c))}
                        className="col-span-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                      <input
                        placeholder="Phone * (+91...)"
                        value={contact.phone}
                        onChange={e => setNewContacts(prev => prev.map((c, i) => i === idx ? { ...c, phone: e.target.value } : c))}
                        className="col-span-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                      <input
                        placeholder="Email (optional)"
                        value={contact.email}
                        onChange={e => setNewContacts(prev => prev.map((c, i) => i === idx ? { ...c, email: e.target.value } : c))}
                        className="col-span-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    {newContacts.length > 1 && (
                      <button onClick={() => setNewContacts(prev => prev.filter((_, i) => i !== idx))}
                        className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded">
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  onClick={() => setNewContacts(prev => [...prev, { name: '', phone: '', email: '' }])}
                  className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
                >
                  <Plus size={16} /> Add another row
                </button>
              </div>
              <div className="flex justify-end gap-2 p-4 border-t border-gray-200 dark:border-gray-700">
                <Button variant="ghost" onClick={() => { setIsAddContactOpen(false); setNewContacts([{ name: '', phone: '', email: '' }]); }}>
                  Cancel
                </Button>
                <Button variant="primary" onClick={handleAddContactsSubmit} isLoading={addContactsMutation.isPending}>
                  Add Contacts
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};
