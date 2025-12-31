import { Modal, Button, Input, Select } from '../index';
import { useState } from 'react';
import type { Campaign } from '../../types';

type CreateCampaignModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (data: Partial<Campaign>) => void;
  loading?: boolean;
};

const campaignTypeOptions = [
  { value: 'inbound', label: 'Inbound' },
  { value: 'outbound', label: 'Outbound' },
];

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

export const CreateCampaignModal = ({
  isOpen,
  onClose,
  onCreate,
  loading,
}: CreateCampaignModalProps) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<'inbound' | 'outbound'>('outbound');
  const [status, setStatus] = useState<'active' | 'paused' | 'draft'>('active');
  const [callLimit, setCallLimit] = useState<string>('100');
  const [retryCount, setRetryCount] = useState<string>('3');
  const [retryDelay, setRetryDelay] = useState<string>('60');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const [timezone, setTimezone] = useState('UTC');
  const [prompt, setPrompt] = useState('');
  
  const [nameError, setNameError] = useState('');

  const handleSubmit = () => {
    if (!name.trim()) {
      setNameError('Campaign name is required');
      return;
    }

    setNameError('');

    onCreate({
      name: name.trim(),
      description: description.trim() || undefined,
      type,
      status,
      callLimit: parseInt(callLimit) || 0,
      retryCount: parseInt(retryCount) || 0,
      retryDelay: parseInt(retryDelay) || 0,
      operatingHours: {
        startTime,
        endTime,
        timezone,
      },
      prompt: prompt.trim() || undefined,
    });

    // Reset form
    setName('');
    setDescription('');
    setType('outbound');
    setStatus('active');
    setCallLimit('100');
    setRetryCount('3');
    setRetryDelay('60');
    setStartTime('09:00');
    setEndTime('17:00');
    setTimezone('UTC');
    setPrompt('');
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create New Campaign"
      size="xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} isLoading={loading}>
            Create Campaign
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <Input
            label="Campaign Name"
            placeholder="e.g., Insurance Sales Q1"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (nameError) setNameError('');
            }}
            error={nameError}
            required
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter campaign description"
              rows={3}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <Select
            label="Campaign Type"
            value={type}
            onChange={(e) => setType(e.target.value as 'inbound' | 'outbound')}
            options={campaignTypeOptions}
          />

          <Select
            label="Initial Status"
            value={status}
            onChange={(e) => setStatus(e.target.value as 'active' | 'paused' | 'draft')}
            options={[
              { value: 'active', label: 'Active' },
              { value: 'paused', label: 'Paused' },
              { value: 'draft', label: 'Draft' },
            ]}
          />
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Max Calls Per Day"
              type="number"
              value={callLimit}
              onChange={(e) => setCallLimit(e.target.value)}
            />
            <Input
              label="Max Retries"
              type="number"
              value={retryCount}
              onChange={(e) => setRetryCount(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Retry Delay (min)"
              type="number"
              value={retryDelay}
              onChange={(e) => setRetryDelay(e.target.value)}
            />
            <Select
              label="Timezone"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              options={timezoneOptions}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Start Time"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
            <Input
              label="End Time"
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              IVR Instructions / Prompt
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g., You are a pizza ordering assistant. Be polite and helpful..."
              rows={3}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
        </div>
      </div>
    </Modal>
  );
};
