import { Button, Input, Select } from '../index';
import { useState } from 'react';
import type { Campaign } from '../../types';
import { Save, RefreshCw } from 'lucide-react';

type CampaignConfigurationProps = {
  campaign: Campaign;
  onUpdate: (data: Partial<Campaign>) => void;
  loading?: boolean;
};

const timezoneOptions = [
  { value: 'UTC', label: 'UTC' },
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'Europe/London', label: 'London (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Paris (CET/CEST)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
  { value: 'Asia/Shanghai', label: 'Shanghai (CST)' },
];

export const CampaignConfiguration = ({
  campaign,
  onUpdate,
  loading,
}: CampaignConfigurationProps) => {
  const [formData, setFormData] = useState<Partial<Campaign>>({
    name: campaign.name,
    description: campaign.description || '',
    callLimit: campaign.callLimit || 100,
    retryCount: campaign.retryCount || 3,
    retryDelay: campaign.retryDelay || 60,
    operatingHours: campaign.operatingHours || {
      startTime: '09:00',
      endTime: '17:00',
      timezone: 'UTC',
    },
    prompt: campaign.prompt || '',
  });

  const [hasChanges, setHasChanges] = useState(false);

  const handleChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleOperatingHoursChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      operatingHours: {
        ...prev.operatingHours!,
        [field]: value,
      },
    }));
    setHasChanges(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdate(formData);
    setHasChanges(false);
  };

  const handleReset = () => {
    setFormData({
      name: campaign.name,
      description: campaign.description || '',
      callLimit: campaign.callLimit || 100,
      retryCount: campaign.retryCount || 3,
      retryDelay: campaign.retryDelay || 60,
      operatingHours: campaign.operatingHours || {
        startTime: '09:00',
        endTime: '17:00',
        timezone: 'UTC',
      },
      prompt: campaign.prompt || '',
    });
    setHasChanges(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">General Settings</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Campaign Name"
            value={formData.name}
            onChange={(e) => handleChange('name', e.target.value)}
          />
          <Input
            label="Campaign Description"
            value={formData.description}
            onChange={(e) => handleChange('description', e.target.value)}
          />
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Call & Retry Policy</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input
            label="Max Calls Per Day"
            type="number"
            value={formData.callLimit?.toString()}
            onChange={(e) => handleChange('callLimit', parseInt(e.target.value) || 0)}
          />
          <Input
            label="Retry Count"
            type="number"
            value={formData.retryCount?.toString()}
            onChange={(e) => handleChange('retryCount', parseInt(e.target.value) || 0)}
          />
          <Input
            label="Retry Delay (minutes)"
            type="number"
            value={formData.retryDelay?.toString()}
            onChange={(e) => handleChange('retryDelay', parseInt(e.target.value) || 0)}
          />
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Operating Hours</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input
            label="Start Time"
            type="time"
            value={formData.operatingHours?.startTime}
            onChange={(e) => handleOperatingHoursChange('startTime', e.target.value)}
          />
          <Input
            label="End Time"
            type="time"
            value={formData.operatingHours?.endTime}
            onChange={(e) => handleOperatingHoursChange('endTime', e.target.value)}
          />
          <Select
            label="Timezone"
            value={formData.operatingHours?.timezone}
            onChange={(e) => handleOperatingHoursChange('timezone', e.target.value)}
            options={timezoneOptions}
          />
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">AI Prompt & Instructions</h3>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            System Prompt
          </label>
          <textarea
            value={formData.prompt}
            onChange={(e) => handleChange('prompt', e.target.value)}
            rows={6}
            className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none font-mono text-sm"
            placeholder="Enter the AI system prompt..."
          />
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            Use variables like {'{customer_name}'} and {'{product_name}'} to personalize the prompt.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 sticky bottom-0 bg-gray-50 dark:bg-gray-900 p-4 border-t border-gray-200 dark:border-gray-700 rounded-b-lg">
        <Button
          variant="ghost"
          onClick={handleReset}
          disabled={!hasChanges || loading}
        >
          <RefreshCw size={18} className="mr-2" />
          Discard Changes
        </Button>
        <Button
          variant="primary"
          type="submit"
          disabled={!hasChanges || loading}
          isLoading={loading}
        >
          <Save size={18} className="mr-2" />
          Save Changes
        </Button>
      </div>
    </form>
  );
};
