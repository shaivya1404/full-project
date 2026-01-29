import { DashboardLayout, Card, Button, Input } from '../components';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getTeam, updateTeamSettings, deleteTeam, getTeamApiKeys, createTeamApiKey, deleteTeamApiKey } from '../services/api';
import { useState, useEffect } from 'react';
import type { TeamSettings as TeamSettingsType } from '../types';
import toast from 'react-hot-toast';
import { Save, Trash2, Copy, Plus, Key, AlertTriangle, Camera } from 'lucide-react';

export const TeamSettingsPage = () => {
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState<TeamSettingsType>({
    name: '',
    description: '',
    avatarUrl: '',
    notifications: {
      email: true,
      inApp: true,
      memberAdded: true,
      memberRemoved: true,
    },
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [apiKeyName, setApiKeyName] = useState('');
  const [isCreatingKey, setIsCreatingKey] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const { data: team, isLoading: teamLoading } = useQuery({
    queryKey: ['team'],
    queryFn: getTeam,
  });

  useEffect(() => {
    if (team) {
      setSettings({
        name: team.name,
        description: team.description || '',
        avatarUrl: team.avatarUrl || '',
        notifications: {
          email: true,
          inApp: true,
          memberAdded: true,
          memberRemoved: true,
        },
      });
    }
  }, [team]);

  const { data: apiKeys } = useQuery({
    queryKey: ['team-api-keys'],
    queryFn: getTeamApiKeys,
  });

  const updateSettingsMutation = useMutation({
    mutationFn: updateTeamSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team'] });
      toast.success('Team settings updated successfully');
    },
    onError: () => {
      toast.error('Failed to update team settings');
    },
  });

  const deleteTeamMutation = useMutation({
    mutationFn: deleteTeam,
    onSuccess: () => {
      toast.success('Team deleted successfully');
      window.location.href = '/dashboard';
    },
    onError: () => {
      toast.error('Failed to delete team');
    },
  });

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      await updateSettingsMutation.mutateAsync(settings);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteTeam = async () => {
    setIsDeleting(true);
    try {
      await deleteTeamMutation.mutateAsync();
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCreateApiKey = async () => {
    if (!apiKeyName.trim()) {
      toast.error('Please enter a name for the API key');
      return;
    }
    setIsCreatingKey(true);
    try {
      await createTeamApiKey(apiKeyName, ['read', 'write']);
      queryClient.invalidateQueries({ queryKey: ['team-api-keys'] });
      toast.success('API key created successfully');
      setApiKeyName('');
    } catch {
      toast.error('Failed to create API key');
    } finally {
      setIsCreatingKey(false);
    }
  };

  const handleDeleteApiKey = async (keyId: string) => {
    try {
      await deleteTeamApiKey(keyId);
      queryClient.invalidateQueries({ queryKey: ['team-api-keys'] });
      toast.success('API key deleted');
    } catch {
      toast.error('Failed to delete API key');
    }
  };

  const copyToClipboard = (key: string, keyId: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKey(keyId);
    toast.success('API key copied to clipboard');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error('File size must be less than 2MB');
      return;
    }

    try {
      const { uploadAvatar } = await import('../services/api');
      const { avatarUrl } = await uploadAvatar(file);
      setSettings({ ...settings, avatarUrl });
      toast.success('Avatar uploaded successfully');
    } catch {
      toast.error('Failed to upload avatar');
    }
  };

  if (teamLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-12">
          <svg className="animate-spin h-8 w-8 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Team Settings
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage your team configuration and API keys
          </p>
        </div>

        <Card className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Team Information
          </h2>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="relative">
                {settings.avatarUrl ? (
                  <img
                    src={settings.avatarUrl}
                    alt="Team Avatar"
                    className="w-24 h-24 rounded-lg object-cover"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-lg bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center">
                    <span className="text-3xl font-bold text-white">
                      {settings.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
                <label className="absolute bottom-0 right-0 p-1 bg-white dark:bg-gray-800 rounded-full shadow-md cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700">
                  <Camera size={16} className="text-gray-600 dark:text-gray-400" />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    className="hidden"
                  />
                </label>
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  Upload a team logo or avatar. Recommended size: 200x200px, max 2MB.
                </p>
              </div>
            </div>

            <Input
              label="Team Name"
              value={settings.name}
              onChange={(e) => setSettings({ ...settings, name: e.target.value })}
              placeholder="Enter team name"
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Description
              </label>
              <textarea
                value={settings.description}
                onChange={(e) => setSettings({ ...settings, description: e.target.value })}
                placeholder="Enter team description"
                rows={3}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              />
            </div>

            <div className="pt-4">
              <Button onClick={handleSaveSettings} isLoading={isSaving}>
                <Save size={18} className="mr-2" />
                Save Changes
              </Button>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Notification Preferences
          </h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Email Notifications</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Receive notifications via email</p>
              </div>
              <button
                onClick={() => setSettings({
                  ...settings,
                  notifications: { ...settings.notifications, email: !settings.notifications.email }
                })}
                className={`w-12 h-6 rounded-full transition-colors ${
                  settings.notifications.email ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'
                }`}
              >
                <div
                  className={`w-5 h-5 bg-white rounded-full shadow transform transition-transform ${
                    settings.notifications.email ? 'translate-x-6' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900 dark:text-white">In-App Notifications</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Show notifications in the app</p>
              </div>
              <button
                onClick={() => setSettings({
                  ...settings,
                  notifications: { ...settings.notifications, inApp: !settings.notifications.inApp }
                })}
                className={`w-12 h-6 rounded-full transition-colors ${
                  settings.notifications.inApp ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'
                }`}
              >
                <div
                  className={`w-5 h-5 bg-white rounded-full shadow transform transition-transform ${
                    settings.notifications.inApp ? 'translate-x-6' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Member Added</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Notify when a new member joins</p>
              </div>
              <button
                onClick={() => setSettings({
                  ...settings,
                  notifications: { ...settings.notifications, memberAdded: !settings.notifications.memberAdded }
                })}
                className={`w-12 h-6 rounded-full transition-colors ${
                  settings.notifications.memberAdded ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'
                }`}
              >
                <div
                  className={`w-5 h-5 bg-white rounded-full shadow transform transition-transform ${
                    settings.notifications.memberAdded ? 'translate-x-6' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Member Removed</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Notify when a member is removed</p>
              </div>
              <button
                onClick={() => setSettings({
                  ...settings,
                  notifications: { ...settings.notifications, memberRemoved: !settings.notifications.memberRemoved }
                })}
                className={`w-12 h-6 rounded-full transition-colors ${
                  settings.notifications.memberRemoved ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'
                }`}
              >
                <div
                  className={`w-5 h-5 bg-white rounded-full shadow transform transition-transform ${
                    settings.notifications.memberRemoved ? 'translate-x-6' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Key size={20} />
            API Keys
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Generate API keys for integrating with your team's data. Keep these keys secure and never share them publicly.
          </p>

          <div className="flex gap-3 mb-6">
            <Input
              placeholder="API key name"
              value={apiKeyName}
              onChange={(e) => setApiKeyName(e.target.value)}
              className="flex-1"
            />
            <Button onClick={handleCreateApiKey} isLoading={isCreatingKey}>
              <Plus size={18} className="mr-2" />
              Create Key
            </Button>
          </div>

          <div className="space-y-3">
            {apiKeys?.map((key) => (
              <div
                key={key.id}
                className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
              >
                <div className="flex-1">
                  <p className="font-medium text-gray-900 dark:text-white">{key.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="text-xs bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded">
                      {key.key.slice(0, 8)}...{key.key.slice(-4)}
                    </code>
                    <button
                      onClick={() => copyToClipboard(key.key, key.id)}
                      className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                    >
                      {copiedKey === key.id ? (
                        <span className="text-xs text-green-600">Copied!</span>
                      ) : (
                        <Copy size={14} />
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Created {new Date(key.createdAt).toLocaleDateString()}
                    {key.lastUsed && ` • Last used ${new Date(key.lastUsed).toLocaleDateString()}`}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteApiKey(key.id)}
                >
                  <Trash2 size={16} className="text-red-500" />
                </Button>
              </div>
            ))}

            {(!apiKeys || apiKeys.length === 0) && (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                No API keys created yet
              </div>
            )}
          </div>
        </Card>

        <Card className="p-6 border border-red-200 dark:border-red-800">
          <h2 className="text-lg font-semibold text-red-900 dark:text-red-300 mb-4 flex items-center gap-2">
            <AlertTriangle size={20} />
            Danger Zone
          </h2>
          <div className="space-y-4">
            <div>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Once you delete a team, there is no going back. Please be certain.
              </p>
              {!showDeleteConfirm ? (
                <Button variant="danger" onClick={() => setShowDeleteConfirm(true)}>
                  Delete Team
                </Button>
              ) : (
                <div className="flex gap-3">
                  <Button variant="ghost" onClick={() => setShowDeleteConfirm(false)}>
                    Cancel
                  </Button>
                  <Button variant="danger" onClick={handleDeleteTeam} isLoading={isDeleting}>
                    Yes, Delete Team
                  </Button>
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
};
